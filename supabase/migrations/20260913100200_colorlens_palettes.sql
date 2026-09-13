-- ColorLens §9: palettes and their ordered colors.

create table if not exists public.palettes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  description text check (description is null or char_length(description) <= 500),
  cover_image_url text,
  -- Which generator produced it, so a palette can be regenerated or explained
  -- later. Free text rather than an enum: the harmony engine already owns the
  -- list of schemes, and duplicating it here would mean a migration every time
  -- a scheme is added.
  source_scheme text,
  is_public boolean not null default false,
  created_at timestamptz not null default now()
);

comment on table public.palettes is 'A saved palette (ColorLens §9). Private by default.';

create index if not exists palettes_user_id_idx on public.palettes (user_id, created_at desc);
create index if not exists palettes_public_idx on public.palettes (created_at desc) where is_public;

-- Colors belonging to a palette, in display order.
--
-- hex is duplicated from colors.hex on purpose. A palette must keep rendering
-- correctly after the user deletes the source color from their library, and
-- must also be able to hold a generated color that was never saved on its own
-- — which is why color_id is nullable.
create table if not exists public.palette_colors (
  palette_id uuid not null references public.palettes (id) on delete cascade,
  position smallint not null check (position >= 0),
  color_id uuid references public.colors (id) on delete set null,
  hex text not null check (hex ~ '^#[0-9a-f]{6}$'),
  role text check (role in ('dominant', 'secondary', 'accent', 'light', 'dark', 'neutral')),
  primary key (palette_id, position)
);

comment on column public.palette_colors.hex is
  'Denormalised so the palette survives deletion of the source color, and can hold generated colors that were never saved individually.';

alter table public.palettes enable row level security;
alter table public.palette_colors enable row level security;

create policy "Users read their own palettes"
  on public.palettes for select
  using (user_id = auth.uid());

create policy "Anyone reads palettes explicitly made public"
  on public.palettes for select
  using (is_public);

create policy "Users insert their own palettes"
  on public.palettes for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and not exists (select 1 from public.profiles where id = auth.uid() and banned_at is not null)
  );

create policy "Users update their own palettes"
  on public.palettes for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "Users delete their own palettes"
  on public.palettes for delete
  using (user_id = auth.uid());

-- palette_colors has no user_id of its own; visibility is entirely inherited
-- from the parent palette. Writing the rule this way means a palette can never
-- leak its colors by being reachable through a different path.
create policy "Palette colors follow the palette's visibility"
  on public.palette_colors for select
  using (
    exists (
      select 1 from public.palettes p
      where p.id = palette_id and (p.user_id = auth.uid() or p.is_public)
    )
  );

create policy "Users write colors only into their own palettes"
  on public.palette_colors for all
  to authenticated
  using (
    exists (select 1 from public.palettes p where p.id = palette_id and p.user_id = auth.uid())
  )
  with check (
    exists (select 1 from public.palettes p where p.id = palette_id and p.user_id = auth.uid())
  );
