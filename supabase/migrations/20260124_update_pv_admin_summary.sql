-- Migration: Update pv_admin_summary function to ensure PV values are recalculated from pv_ledger
-- Date: 2026-01-24

create or replace function public.pv_admin_summary()
returns table (
  total_pv numeric,
  left_pv numeric,
  right_pv numeric,
  personal_pv numeric,
  total_entries integer
)
language sql
as $$
  select
    coalesce(sum(amount), 0) as total_pv,
    coalesce(sum(amount) filter (where leg_side = 'left'), 0) as left_pv,
    coalesce(sum(amount) filter (where leg_side = 'right'), 0) as right_pv,
    coalesce(sum(amount) filter (where event_type = 'personal'), 0) as personal_pv,
    count(*) as total_entries
  from pv_ledger;
$$;
