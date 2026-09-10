-- User-submitted moderation reports (offensive names, inappropriate images,
-- abusive profiles). Feeds the moderation queue mentioned in §31/§12.
create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid references public.profiles (id) on delete set null,
  target_type text not null check (target_type in ('color', 'color_name', 'profile')),
  target_id uuid not null,
  reason text not null check (char_length(trim(reason)) between 3 and 300),
  status text not null default 'open' check (status in ('open', 'resolved', 'dismissed')),
  resolved_by uuid references public.profiles (id) on delete set null,
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists reports_status_idx on public.reports (status);

alter table public.reports enable row level security;

create policy "Reporters can see their own reports; moderators see all"
  on public.reports for select
  using (reporter_id = auth.uid() or public.is_moderator(auth.uid()));

create policy "Authenticated users can file a report"
  on public.reports for insert
  to authenticated
  with check (reporter_id = auth.uid());

create policy "Moderators resolve reports"
  on public.reports for update
  using (public.is_moderator(auth.uid()))
  with check (public.is_moderator(auth.uid()));
