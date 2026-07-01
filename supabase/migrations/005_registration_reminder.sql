alter table public.registrations
  add column if not exists reminder_sent_at timestamptz;
