create policy "Members can cancel their pending online giving"
on public.online_giving_payments for delete to authenticated
using (donor_id = auth.uid() and status = 'pending');
