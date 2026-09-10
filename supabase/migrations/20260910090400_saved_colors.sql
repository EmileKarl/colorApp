-- A user's private collection of saved colors (MVP2). Independent from the
-- public "colors" table so saving a scan never requires it to be published
-- to the community first.
create table if not exists public.saved_colors (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  color_id uuid references public.colors (id) on delete set null,
  hex text not null check (hex ~ '^#[0-9a-f]{6}$'),
  label text,
  source_image_url text,
  created_at timestamptz not null default now()
);

comment on table public.saved_colors is
  'Private per-user collection. Not readable by other users, unlike the public colors/color_names tables.';

create index if not exists saved_colors_user_id_idx on public.saved_colors (user_id, created_at desc);

alter table public.saved_colors enable row level security;

create policy "Users manage only their own saved colors"
  on public.saved_colors for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
