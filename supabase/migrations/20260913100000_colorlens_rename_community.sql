-- ColorLens §9 defines a `colors` table that is *personal*: one row per color
-- a user captured, with user_id, source_image_url and is_public. The existing
-- `colors` table is something else entirely — a shared community catalogue,
-- one row per distinct hue, deduplicated by perceptual proximity, which the
-- community names and votes on.
--
-- Merging them would break community voting, which §13 forbids doing without
-- justification. So the community catalogue is renamed out of the way and the
-- ColorLens `colors` table is created fresh in the next migration. Postgres
-- rewrites foreign keys, indexes and view definitions automatically on
-- rename; only the two places that reference the name as a *string* need
-- updating by hand, and both are below.

alter table if exists public.colors rename to community_colors;

comment on table public.community_colors is
  'Shared community catalogue: one row per distinct hue, deduplicated by perceptual proximity, named and voted on by the community. Distinct from public.colors, which is a user''s own captured colors (ColorLens §9).';

-- 1. The rate-limit trigger dispatches on tg_table_name, which now reports
--    'community_colors'. Without this the limit would silently stop applying
--    to community submissions — a spam protection failing open.
create or replace function public.enforce_submission_rate_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  recent_count int;
  max_per_hour constant int := 20;
begin
  if tg_table_name = 'community_colors' then
    select count(*) into recent_count
    from public.community_colors
    where discovered_by = new.discovered_by
      and created_at > now() - interval '1 hour';
  elsif tg_table_name = 'color_names' then
    select count(*) into recent_count
    from public.color_names
    where proposed_by = new.proposed_by
      and created_at > now() - interval '1 hour';
  elsif tg_table_name = 'colors' then
    select count(*) into recent_count
    from public.colors
    where user_id = new.user_id
      and created_at > now() - interval '1 hour';
  else
    return new;
  end if;

  if recent_count >= max_per_hour then
    raise exception 'rate_limit_exceeded: too many submissions in the last hour, try again later';
  end if;

  return new;
end;
$$;

-- 2. The trigger itself was named after the old table.
drop trigger if exists colors_rate_limit on public.community_colors;
create trigger community_colors_rate_limit
  before insert on public.community_colors
  for each row execute function public.enforce_submission_rate_limit();

-- The ranking view survived the rename with its definition rewritten, but is
-- recreated explicitly so that reading this file tells the whole story rather
-- than requiring the reader to know that Postgres tracks views by OID.
drop view if exists public.color_name_rankings;
create view public.color_name_rankings as
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
join public.community_colors c on c.id = cn.color_id
left join public.votes v on v.color_name_id = cn.id
where cn.status = 'approved' and c.status = 'active'
group by cn.id, c.hex, c.family;

comment on view public.color_name_rankings is
  'Public leaderboard source for approved color names, used by the Explorer community section.';
