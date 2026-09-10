-- One vote per (voter, color_name). Value is +1 or -1; a user can change
-- their vote (upsert) but not vote twice, which is what actually protects
-- the ranking from trivial ballot-stuffing (real bot resistance still needs
-- Supabase's auth rate limiting + captcha at signup, see docs).
create table if not exists public.votes (
  id uuid primary key default gen_random_uuid(),
  color_name_id uuid not null references public.color_names (id) on delete cascade,
  voter_id uuid not null references public.profiles (id) on delete cascade,
  value smallint not null check (value in (-1, 1)),
  created_at timestamptz not null default now(),
  unique (color_name_id, voter_id)
);

create index if not exists votes_color_name_id_idx on public.votes (color_name_id);

alter table public.votes enable row level security;

create policy "Vote tallies are publicly readable"
  on public.votes for select
  using (true);

create policy "Authenticated non-banned users can vote once per name"
  on public.votes for insert
  to authenticated
  with check (
    voter_id = auth.uid()
    and not exists (select 1 from public.profiles where id = auth.uid() and banned_at is not null)
    and exists (select 1 from public.color_names where id = color_name_id and status = 'approved')
  );

create policy "Users can change or remove their own vote"
  on public.votes for update
  using (voter_id = auth.uid())
  with check (voter_id = auth.uid());

create policy "Users can remove their own vote"
  on public.votes for delete
  using (voter_id = auth.uid());

-- Public ranking view: approved names ordered by net score.
create or replace view public.color_name_rankings as
select
  cn.id as color_name_id,
  cn.color_id,
  cn.name,
  cn.proposed_by,
  c.hex,
  c.family,
  coalesce(sum(v.value), 0)::int as score,
  count(*) filter (where v.value = 1) as upvotes,
  count(*) filter (where v.value = -1) as downvotes
from public.color_names cn
join public.colors c on c.id = cn.color_id
left join public.votes v on v.color_name_id = cn.id
where cn.status = 'approved' and c.status = 'active'
group by cn.id, c.hex, c.family;

comment on view public.color_name_rankings is
  'Public leaderboard source for approved color names, used by the community feed/ranking screens.';
