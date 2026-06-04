import { GivingReceipt } from "@/components/giving-receipt";

export default async function GivingReceiptPage({ params }: { params: Promise<{ id: string }> }) {
  return <GivingReceipt id={(await params).id} />;
}
