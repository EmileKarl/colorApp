-- Canonical community colors. One row per visually-distinct color the
-- community has discovered (see docs/PRODUCT_DISCOVERY.md §31 for the flow:
-- scan -> existing color? -> yes: show it / no: create + propose a name).
create table if not exists public.colors (
  id uuid primary key default gen_random_uuid(),
  hex text not null unique check (hex ~ '^#[0-9a-f]{6}$'),
  r smallint not null check (r between 0 and 255),
  g smallint not null check (g between 0 and 255),
  b smallint not null check (b between 0 and 255),
  family text not null check (
    family in ('red','orange','yellow','green','cyan','blue','purple','pink','brown','gray','black','white')
  ),
  -- Coarse 16-step RGB bucket, indexed, so "is this color already known?"
  -- can be an indexed lookup (bucket match) followed by a precise
  -- client-side distance check on the small result set, instead of a full
  -- table scan. Exact-hex equality alone would almost never match two
  -- independent camera scans of the "same" real-world color.
  bucket_r smallint generated always as ((r / 16) * 16) stored,
  bucket_g smallint generated always as ((g / 16) * 16) stored,
  bucket_b smallint generated always as ((b / 16) * 16) stored,
  cover_image_url text,
  discovered_by uuid references public.profiles (id) on delete set null,
  status text not null default 'active' check (status in ('active', 'hidden')),
  created_at timestamptz not null default now()
);

comment on table public.colors is
  'Canonical distinct colors. hex is normalized lowercase #rrggbb and is the natural dedup key.';

create index if not exists colors_family_idx on public.colors (family);
create index if not exists colors_created_at_idx on public.colors (created_at desc);
create index if not exists colors_bucket_idx on public.colors (bucket_r, bucket_g, bucket_b);

alter table public.colors enable row level security;

create policy "Active colors are publicly readable"
  on public.colors for select
  using (status = 'active' or public.is_moderator(auth.uid()));

create policy "Authenticated non-banned users can add a new color"
  on public.colors for insert
  to authenticated
  with check (
    discovered_by = auth.uid()
    and not exists (select 1 from public.profiles where id = auth.uid() and banned_at is not null)
  );

create policy "Moderators can hide a color"
  on public.colors for update
  using (public.is_moderator(auth.uid()))
  with check (public.is_moderator(auth.uid()));
