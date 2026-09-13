-- ColorLens page 23: profile fields and statistics.

alter table public.profiles
  add column if not exists bio text check (bio is null or char_length(bio) <= 300);

comment on column public.profiles.bio is 'Short public bio (ColorLens page 23).';

-- Profile statistics, computed rather than counted into a column.
--
-- §34/§35 of the earlier spec forbid fabricating statistics, and a stored
-- counter is the usual way they end up wrong: it drifts the moment a delete
-- misses its decrement. Counting on read is slower and always true. If this
-- ever becomes a bottleneck the fix is a materialised view refreshed on a
-- schedule, not hand-maintained counters.
create or replace view public.profile_stats as
select
  p.id as user_id,
  (select count(*) from public.colors c where c.user_id = p.id)::int as colors_captured,
  (select count(*) from public.palettes pa where pa.user_id = p.id)::int as palettes_created,
  (select count(*) from public.creations cr where cr.user_id = p.id)::int as creations_made,
  (select count(*) from public.creations cr where cr.user_id = p.id and cr.is_public)::int
    as creations_shared,
  (select count(*) from public.creations cr where cr.user_id = p.id and cr.remixed_from is not null)::int
    as remixes_made,
  (select count(*) from public.collections co where co.user_id = p.id)::int as collections_count,
  -- "Couleur la plus utilisée" (page 23): the family the user captures most,
  -- not a single hex — two captures of the same wall rarely land on the exact
  -- same hex, so a hex-level mode would almost always report 1.
  (
    select c.family
    from public.colors c
    where c.user_id = p.id and c.family is not null
    group by c.family
    order by count(*) desc, c.family asc
    limit 1
  ) as most_used_family
from public.profiles p;

comment on view public.profile_stats is
  'Live profile statistics (ColorLens page 23). Counted on read so they cannot drift out of sync.';

-- The view runs with the querying user's privileges, so RLS on the underlying
-- tables still applies: another user's private colors are never counted into
-- what you can see. security_invoker is what guarantees that — without it the
-- view would run as its owner and bypass RLS entirely.
alter view public.profile_stats set (security_invoker = on);
alter view public.creation_like_counts set (security_invoker = on);
alter view public.color_name_rankings set (security_invoker = on);
