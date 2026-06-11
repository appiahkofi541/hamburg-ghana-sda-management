import { EventCheckin } from "@/components/event-checkin";

export default async function EventCheckinPage({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;
  return <EventCheckin eventId={eventId} />;
}
