-- ColorLens §9 and page 20: named collections that can hold colors, palettes
-- or creations side by side ("Couleurs de voitures", "Palette de ma chambre").

create table if not exists public.collections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  description text check (description is null or char_length(description) <= 500),
  cover_url text,
  is_public boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.collections is
  'User-named collection (ColorLens page 20). Heterogeneous: holds colors, palettes and creations together.';

create index if not exists collections_user_id_idx on public.collections (user_id, created_at desc);
create index if not exists collections_public_idx on public.collections (created_at desc) where is_public;

drop trigger if exists collections_set_updated_at on public.collections;
create trigger collections_set_updated_at
  before update on public.collections
  for each row execute function public.set_updated_at();

-- Items are polymorphic: (item_type, item_id) rather than three nullable
-- foreign keys. The trade-off is deliberate — no referential integrity from
-- the database, in exchange for a single ordered list the "réorganiser" of
-- page 20 can reorder without caring what each row points at. The cleanup
-- trigger below covers the integrity the foreign key would have given.
create table if not exists public.collection_items (
  collection_id uuid not null references public.collections (id) on delete cascade,
  item_type text not null check (item_type in ('color', 'palette', 'creation')),
  item_id uuid not null,
  position smallint not null default 0,
  created_at timestamptz not null default now(),
  primary key (collection_id, item_type, item_id)
);

create index if not exists collection_items_order_idx
  on public.collection_items (collection_id, position);

-- Deleting a color, palette or creation must not leave a dangling entry that
-- renders as a blank tile. Postgres cannot express this as a foreign key
-- across a polymorphic column, so it is a trigger on each source table.
create or replace function public.cleanup_collection_items()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.collection_items
  where item_id = old.id
    and item_type = case tg_table_name
      when 'colors' then 'color'
      when 'palettes' then 'palette'
      when 'creations' then 'creation'
    end;
  return old;
end;
$$;

drop trigger if exists colors_cleanup_collection_items on public.colors;
create trigger colors_cleanup_collection_items
  after delete on public.colors
  for each row execute function public.cleanup_collection_items();

drop trigger if exists palettes_cleanup_collection_items on public.palettes;
create trigger palettes_cleanup_collection_items
  after delete on public.palettes
  for each row execute function public.cleanup_collection_items();

drop trigger if exists creations_cleanup_collection_items on public.creations;
create trigger creations_cleanup_collection_items
  after delete on public.creations
  for each row execute function public.cleanup_collection_items();

alter table public.collections enable row level security;
alter table public.collection_items enable row level security;

create policy "Users read their own collections"
  on public.collections for select
  using (user_id = auth.uid());

create policy "Anyone reads collections explicitly made public"
  on public.collections for select
  using (is_public);

create policy "Users insert their own collections"
  on public.collections for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and not exists (select 1 from public.profiles where id = auth.uid() and banned_at is not null)
  );

create policy "Users update their own collections"
  on public.collections for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "Users delete their own collections"
  on public.collections for delete
  using (user_id = auth.uid());

create policy "Collection items follow the collection's visibility"
  on public.collection_items for select
  using (
    exists (
      select 1 from public.collections c
      where c.id = collection_id and (c.user_id = auth.uid() or c.is_public)
    )
  );

create policy "Users write items only into their own collections"
  on public.collection_items for all
  to authenticated
  using (
    exists (select 1 from public.collections c where c.id = collection_id and c.user_id = auth.uid())
  )
  with check (
    exists (select 1 from public.collections c where c.id = collection_id and c.user_id = auth.uid())
  );
