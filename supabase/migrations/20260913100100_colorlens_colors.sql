-- ColorLens §9: `colors` — a user's own captured colors.
--
-- hex is the single source of truth. The rgb/hsl/hsv/lab columns the spec
-- lists are stored alongside it as jsonb rather than recomputed on read,
-- because they are what the capture actually measured: recomputing lab from
-- the rounded hex would silently discard the sub-integer precision the color
-- engine produced. They are written by the client from the same engine that
-- measured the color, never by a language model (§8).
create table if not exists public.colors (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  name text check (name is null or char_length(name) between 1 and 60),
  hex text not null check (hex ~ '^#[0-9a-f]{6}$'),
  rgb jsonb,
  hsl jsonb,
  hsv jsonb,
  lab jsonb,
  -- Denormalised for filtering; the client derives it with the same function
  -- the search screen uses, so a filter and a label can never disagree.
  family text check (family in (
    'red','orange','yellow','green','cyan','blue','purple','pink','brown','gray','black','white'
  )),
  source_image_url text,
  source_type text not null default 'camera'
    check (source_type in ('camera', 'gallery', 'manual', 'mix', 'palette')),
  -- The measured uncertainty, in ΔE00, carried from the color engine. Kept so
  -- a color's reliability travels with it instead of being lost at save time.
  uncertainty real check (uncertainty is null or uncertainty >= 0),
  -- §11: "projets privés par défaut", "publication jamais automatique".
  is_public boolean not null default false,
  community_color_id uuid references public.community_colors (id) on delete set null,
  created_at timestamptz not null default now()
);

comment on table public.colors is
  'A user''s own captured colors (ColorLens §9). Private by default; community_color_id optionally links to the shared named-color catalogue.';

create index if not exists colors_user_id_idx on public.colors (user_id, created_at desc);
create index if not exists colors_public_idx on public.colors (created_at desc) where is_public;
create index if not exists colors_family_idx on public.colors (family);

alter table public.colors enable row level security;

create policy "Users read their own colors"
  on public.colors for select
  using (user_id = auth.uid());

-- Two separate select policies rather than one OR'd condition: Postgres
-- combines permissive policies with OR anyway, and splitting them makes the
-- public-exposure rule auditable on its own line.
create policy "Anyone reads colors explicitly made public"
  on public.colors for select
  using (is_public);

create policy "Users insert their own colors"
  on public.colors for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and not exists (select 1 from public.profiles where id = auth.uid() and banned_at is not null)
  );

create policy "Users update their own colors"
  on public.colors for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "Users delete their own colors"
  on public.colors for delete
  using (user_id = auth.uid());

drop trigger if exists colors_rate_limit on public.colors;
create trigger colors_rate_limit
  before insert on public.colors
  for each row execute function public.enforce_submission_rate_limit();

-- Migrate the old private collection into the new table. saved_colors and
-- colors hold the same thing under ColorLens, so keeping both would leave two
-- places to look for a user's colors. Copy first, drop second — an empty
-- select here is fine (a project with no data yet).
insert into public.colors (id, user_id, name, hex, source_image_url, source_type, created_at, community_color_id)
select
  s.id,
  s.user_id,
  s.label,
  s.hex,
  s.source_image_url,
  'camera',
  s.created_at,
  s.color_id
from public.saved_colors s
on conflict (id) do nothing;

drop table if exists public.saved_colors;
