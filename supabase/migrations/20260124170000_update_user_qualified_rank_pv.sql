-- Migration: Update user_qualified_rank to calculate PV from pv_ledger
-- Date: 2026-01-24

DROP VIEW IF EXISTS user_qualified_rank CASCADE;

CREATE VIEW user_qualified_rank AS
SELECT
  p.id AS profile_id,
  p.user_id,
  p.email,
  p.referral_id,
  p.rank,
  p.status,
  COALESCE((SELECT SUM(l.amount) FROM public.pv_ledger l WHERE l.user_id = p.id AND l.leg_side = 'personal'), 0) AS personal_volume,
  COALESCE((SELECT SUM(l.amount) FROM public.pv_ledger l WHERE l.user_id = p.id AND l.leg_side = 'left'), 0) AS total_left_volume,
  COALESCE((SELECT SUM(l.amount) FROM public.pv_ledger l WHERE l.user_id = p.id AND l.leg_side = 'right'), 0) AS total_right_volume
FROM public.profiles p;

-- This view now dynamically calculates PV from the pv_ledger table for each user.
