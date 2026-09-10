-- Server-side rate limiting for community submissions. Client-side checks
-- are trivial to bypass, so the real limit lives here as a trigger that
-- runs inside the same transaction as the insert (§31 spam protection).
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
  if tg_table_name = 'colors' then
    select count(*) into recent_count
    from public.colors
    where discovered_by = new.discovered_by
      and created_at > now() - interval '1 hour';
  elsif tg_table_name = 'color_names' then
    select count(*) into recent_count
    from public.color_names
    where proposed_by = new.proposed_by
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

drop trigger if exists colors_rate_limit on public.colors;
create trigger colors_rate_limit
  before insert on public.colors
  for each row execute function public.enforce_submission_rate_limit();

drop trigger if exists color_names_rate_limit on public.color_names;
create trigger color_names_rate_limit
  before insert on public.color_names
  for each row execute function public.enforce_submission_rate_limit();
