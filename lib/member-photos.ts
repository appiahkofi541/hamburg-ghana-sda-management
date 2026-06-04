import type { SupabaseClient } from "@supabase/supabase-js";

const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
const maxSize = 2 * 1024 * 1024;

function extension(file: File) {
  if (file.type === "image/png") return "png";
  if (file.type === "image/webp") return "webp";
  return "jpg";
}

export function validateMemberPhoto(file: File) {
  if (!allowedTypes.includes(file.type)) return "Profile photos must be JPG, JPEG, PNG, or WEBP.";
  if (file.size > maxSize) return "Profile photo must be 2 MB or smaller.";
  return "";
}

export async function createThumbnail(file: File, size = 240) {
  const imageUrl = URL.createObjectURL(file);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("Unable to read the selected image."));
      img.src = imageUrl;
    });
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Unable to generate image thumbnail.");
    const shortest = Math.min(image.width, image.height);
    const sx = (image.width - shortest) / 2;
    const sy = (image.height - shortest) / 2;
    context.drawImage(image, sx, sy, shortest, shortest, 0, 0, size, size);
    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("Unable to generate image thumbnail.")), "image/jpeg", 0.82);
    });
  } finally {
    URL.revokeObjectURL(imageUrl);
  }
}

export async function uploadMemberPhoto(supabase: SupabaseClient, memberId: string, file: File) {
  const validationError = validateMemberPhoto(file);
  if (validationError) throw new Error(validationError);

  const stamp = Date.now();
  const originalPath = `${memberId}/profile-${stamp}.${extension(file)}`;
  const thumbnailPath = `${memberId}/thumbnail-${stamp}.jpg`;
  const thumbnail = await createThumbnail(file);

  const originalUpload = await supabase.storage.from("member-photos").upload(originalPath, file, { cacheControl: "3600", upsert: true });
  if (originalUpload.error) throw new Error(originalUpload.error.message);

  const thumbnailUpload = await supabase.storage.from("member-photos").upload(thumbnailPath, thumbnail, { cacheControl: "3600", contentType: "image/jpeg", upsert: true });
  if (thumbnailUpload.error) throw new Error(thumbnailUpload.error.message);

  const photoUrl = supabase.storage.from("member-photos").getPublicUrl(originalPath).data.publicUrl;
  const thumbnailUrl = supabase.storage.from("member-photos").getPublicUrl(thumbnailPath).data.publicUrl;

  const { error } = await supabase
    .from("members")
    .update({
      photo_url: photoUrl,
      photo_thumbnail_url: thumbnailUrl,
      photo_path: originalPath,
      photo_thumbnail_path: thumbnailPath,
    })
    .eq("id", memberId);
  if (error) throw new Error(error.message);

  return { photoUrl, thumbnailUrl, photoPath: originalPath, thumbnailPath };
}
