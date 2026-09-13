-- ColorLens §9: the object mockup catalogue.
--
-- Unlike every other table here, rows are *content*, not user data: they are
-- authored by the project and read by everyone. So the table is world-readable
-- and has no insert/update/delete policy at all — new objects are added by
-- migration or from the Supabase dashboard, never by the app.
create table if not exists public.objects (
  id text primary key check (id ~ '^[a-z0-9_-]+$'),
  name text not null,
  category text not null check (category in (
    'fashion', 'shoes', 'automotive', 'home', 'accessories', 'design'
  )),
  -- 'vector' models ship inside the app bundle and work offline; 'raster'
  -- models are photographic mockups with PNG mask layers, downloaded and
  -- cached on demand. One table serves both so a photographic model can
  -- replace a vector one without touching any client code (audit, decision 1).
  kind text not null default 'vector' check (kind in ('vector', 'raster')),
  thumbnail_url text,
  preview_url text,
  model_3d_url text,
  -- Zones, materials, views and layer URLs. Shaped by src/objects/types.ts;
  -- kept as jsonb because the shape differs per object kind and a column per
  -- field would mean a migration for every new material parameter.
  configuration jsonb not null default '{}'::jsonb,
  sort_order smallint not null default 100,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

comment on table public.objects is
  'Catalogue of recolorable object mockups (ColorLens §6, §9). Project-authored content: publicly readable, never writable from the app.';

create index if not exists objects_category_idx on public.objects (category, sort_order) where is_active;

alter table public.objects enable row level security;

create policy "Object catalogue is publicly readable"
  on public.objects for select
  using (is_active);

-- Per-user favourites over the catalogue (§9 page 10, "ajouter aux favoris").
create table if not exists public.object_favorites (
  user_id uuid not null references public.profiles (id) on delete cascade,
  object_id text not null references public.objects (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, object_id)
);

alter table public.object_favorites enable row level security;

create policy "Users manage only their own object favourites"
  on public.object_favorites for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
