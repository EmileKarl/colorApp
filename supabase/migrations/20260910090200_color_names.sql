-- Proposed names for a color. A color can have several proposed names;
-- only 'approved' ones are shown publicly and eligible for voting/ranking.
create table if not exists public.color_names (
  id uuid primary key default gen_random_uuid(),
  color_id uuid not null references public.colors (id) on delete cascade,
  name text not null check (char_length(trim(name)) between 2 and 40),
  proposed_by uuid references public.profiles (id) on delete set null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  moderated_by uuid references public.profiles (id) on delete set null,
  moderated_at timestamptz,
  moderation_reason text,
  created_at timestamptz not null default now()
);

comment on table public.color_names is
  'Community-submitted names for a color. Goes through moderation before becoming publicly visible (§31).';

-- Prevent the exact same name text being submitted twice for the same color.
create unique index if not exists color_names_unique_per_color
  on public.color_names (color_id, lower(trim(name)));

create index if not exists color_names_color_id_idx on public.color_names (color_id);
create index if not exists color_names_status_idx on public.color_names (status);

alter table public.color_names enable row level security;

create policy "Approved names are public; authors and moderators see all statuses"
  on public.color_names for select
  using (
    status = 'approved'
    or proposed_by = auth.uid()
    or public.is_moderator(auth.uid())
  );

create policy "Authenticated non-banned users can propose a name"
  on public.color_names for insert
  to authenticated
  with check (
    proposed_by = auth.uid()
    and not exists (select 1 from public.profiles where id = auth.uid() and banned_at is not null)
  );

create policy "Moderators approve or reject proposed names"
  on public.color_names for update
  using (public.is_moderator(auth.uid()))
  with check (public.is_moderator(auth.uid()));
