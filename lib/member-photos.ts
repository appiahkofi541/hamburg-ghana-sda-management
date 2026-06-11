import type { SupabaseClient } from "@supabase/supabase-js";

const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
const maxSize = 4 * 1024 * 1024;
const maxImageDimension = 1600;

function extension(file: File) {
  if (file.type === "image/png") return "png";
  if (file.type === "image/webp") return "webp";
  return "jpg";
}

export function validateMemberPhoto(file: File) {
  if (!allowedTypes.includes(file.type)) return "Profile photos must be JPG, JPEG, PNG, or WEBP.";
  if (file.size > maxSize) return "Profile photo must be 4 MB or smaller.";
  return "";
}

export async function createThumbnail(file: File, size = 240) {
  return resizeImage(file, size, size, "image/jpeg", 0.82, true);
}

async function loadImage(file: File) {
  const imageUrl = URL.createObjectURL(file);
  try {
    return await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("Unable to read the selected image."));
      img.src = imageUrl;
    });
  } finally {
    URL.revokeObjectURL(imageUrl);
  }
}

async function resizeImage(file: File, maxWidth: number, maxHeight: number, type = file.type, quality = 0.86, squareCrop = false) {
  const image = await loadImage(file);
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Unable to resize the selected image.");

  if (squareCrop) {
    const canvas = document.createElement("canvas");
    canvas.width = maxWidth;
    canvas.height = maxHeight;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Unable to generate image thumbnail.");
    const shortest = Math.min(image.width, image.height);
    const sx = (image.width - shortest) / 2;
    const sy = (image.height - shortest) / 2;
    context.drawImage(image, sx, sy, shortest, shortest, 0, 0, maxWidth, maxHeight);
    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("Unable to generate image thumbnail.")), type, quality);
    });
  }

  const scale = Math.min(1, maxWidth / image.width, maxHeight / image.height);
  if (scale === 1) return file;

  canvas.width = Math.round(image.width * scale);
  canvas.height = Math.round(image.height * scale);
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("Unable to resize the selected image.")), type, quality);
  });
}

export async function uploadMemberPhoto(supabase: SupabaseClient, memberId: string, file: File) {
  const validationError = validateMemberPhoto(file);
  if (validationError) throw new Error(validationError);

  const stamp = Date.now();
  const originalPath = `${memberId}/profile-${stamp}.${extension(file)}`;
  const thumbnailPath = `${memberId}/thumbnail-${stamp}.jpg`;
  const [resizedPhoto, thumbnail] = await Promise.all([
    resizeImage(file, maxImageDimension, maxImageDimension),
    createThumbnail(file),
  ]);

  const { data: existingMember } = await supabase.from("members").select("photo_path, photo_thumbnail_path").eq("id", memberId).maybeSingle();

  const originalUpload = await supabase.storage.from("member-photos").upload(originalPath, resizedPhoto, { cacheControl: "3600", contentType: resizedPhoto.type || file.type, upsert: true });
  if (originalUpload.error) throw new Error(originalUpload.error.message);

  const thumbnailUpload = await supabase.storage.from("member-photos").upload(thumbnailPath, thumbnail, { cacheControl: "3600", contentType: "image/jpeg", upsert: true });
  if (thumbnailUpload.error) throw new Error(thumbnailUpload.error.message);

  const photoUrl = supabase.storage.from("member-photos").getPublicUrl(originalPath).data.publicUrl;
  const thumbnailUrl = supabase.storage.from("member-photos").getPublicUrl(thumbnailPath).data.publicUrl;

  const { error } = await supabase.rpc("update_member_profile_photo", {
    target_member_id: memberId,
    new_photo_url: photoUrl,
    new_photo_thumbnail_url: thumbnailUrl,
    new_photo_path: originalPath,
    new_photo_thumbnail_path: thumbnailPath,
  });
  if (error) throw new Error(error.message);

  const oldPaths = [existingMember?.photo_path, existingMember?.photo_thumbnail_path].filter((path): path is string => Boolean(path));
  if (oldPaths.length) await supabase.storage.from("member-photos").remove(oldPaths);

  return { photoUrl, thumbnailUrl, photoPath: originalPath, thumbnailPath };
}

export async function removeMemberPhoto(supabase: SupabaseClient, memberId: string) {
  const { data: existingMember } = await supabase.from("members").select("photo_path, photo_thumbnail_path").eq("id", memberId).maybeSingle();
  const { error } = await supabase.rpc("remove_member_profile_photo", { target_member_id: memberId });
  if (error) throw new Error(error.message);

  const oldPaths = [existingMember?.photo_path, existingMember?.photo_thumbnail_path].filter((path): path is string => Boolean(path));
  if (oldPaths.length) await supabase.storage.from("member-photos").remove(oldPaths);
}
