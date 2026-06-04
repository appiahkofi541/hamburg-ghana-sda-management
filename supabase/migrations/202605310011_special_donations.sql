-- Add a dedicated finance category for special donations.
alter type public.contribution_type add value if not exists 'special_donation';
