-- ColorLens §9: creations (a recolored object) and likes.

create table if not exists public.creations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  object_id text not null references public.objects (id) on delete restrict,
  name text not null check (char_length(name) between 1 and 80),
  description text check (description is null or char_length(description) <= 1000),
  source_color_id uuid references public.colors (id) on delete set null,
  palette_id uuid references public.palettes (id) on delete set null,
  preview_url text,
  -- Everything needed to reopen the creation in the Studio exactly as it was:
  -- per-zone colors, materials, lighting, background, render settings,
  -- variants. jsonb rather than columns because the shape depends on the
  -- object, and because a remix needs to copy the whole thing atomically.
  project_data jsonb not null default '{}'::jsonb,
  tags text[] not null default '{}',
  -- §11: private by default, publication never automatic.
  is_public boolean not null default false,
  -- Set when this creation was made by remixing someone else's (page 22).
  remixed_from uuid references public.creations (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.creations is
  'A recolored object (ColorLens §9, page 18). project_data holds the full Studio state so a creation can be reopened or remixed.';

comment on column public.creations.object_id is
  'on delete restrict: retiring an object from the catalogue must not silently destroy the creations built on it.';

create index if not exists creations_user_id_idx on public.creations (user_id, created_at desc);
create index if not exists creations_public_idx on public.creations (created_at desc) where is_public;
create index if not exists creations_object_idx on public.creations (object_id);
create index if not exists creations_remix_idx on public.creations (remixed_from) where remixed_from is not null;

drop trigger if exists creations_set_updated_at on public.creations;
create trigger creations_set_updated_at
  before update on public.creations
  for each row execute function public.set_updated_at();

alter table public.creations enable row level security;

create policy "Users read their own creations"
  on public.creations for select
  using (user_id = auth.uid());

create policy "Anyone reads creations explicitly made public"
  on public.creations for select
  using (is_public);

create policy "Users insert their own creations"
  on public.creations for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and not exists (select 1 from public.profiles where id = auth.uid() and banned_at is not null)
  );

create policy "Users update their own creations"
  on public.creations for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "Users delete their own creations"
  on public.creations for delete
  using (user_id = auth.uid());

-- Likes (§9). A like is only meaningful on a creation the liker can see, and
-- the insert policy enforces exactly that: you cannot like something private
-- by guessing its id, which would otherwise leak the existence of the row.
create table if not exists public.likes (
  user_id uuid not null references public.profiles (id) on delete cascade,
  creation_id uuid not null references public.creations (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, creation_id)
);

create index if not exists likes_creation_idx on public.likes (creation_id);

alter table public.likes enable row level security;

create policy "Likes on visible creations are readable"
  on public.likes for select
  using (
    exists (
      select 1 from public.creations c
      where c.id = creation_id and (c.is_public or c.user_id = auth.uid())
    )
  );

create policy "Users like only creations they can see"
  on public.likes for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.creations c
      where c.id = creation_id and (c.is_public or c.user_id = auth.uid())
    )
  );

create policy "Users remove their own likes"
  on public.likes for delete
  using (user_id = auth.uid());

-- Public like counts without exposing who liked what.
create view public.creation_like_counts as
select creation_id, count(*)::int as likes
from public.likes
group by creation_id;

comment on view public.creation_like_counts is
  'Aggregate like counts. Reading this never reveals individual likers.';
