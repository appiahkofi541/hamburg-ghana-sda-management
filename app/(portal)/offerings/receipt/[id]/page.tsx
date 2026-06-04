import { FinancePaymentReceipt } from "@/components/finance-payment-receipt";

export default async function FinanceReceiptPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <FinancePaymentReceipt id={id} />;
}
