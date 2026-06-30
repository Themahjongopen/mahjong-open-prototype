create table public.commissioner_applications (
  id              uuid primary key default gen_random_uuid(),
  created_at      timestamptz not null default now(),
  full_name       text not null,
  email           text not null,
  phone           text not null,
  proposed_city   text not null,
  socials         text,
  experience      text not null,
  teaches_organize text not null,
  reach_estimate  text not null,
  play_venues     text[],
  motivation      text not null,
  desired_timeline text,
  notes           text,
  status          text not null default 'new',
  source          text
);

alter table public.commissioner_applications enable row level security;

-- No public policies: only the service-role key (server) can insert/select.
