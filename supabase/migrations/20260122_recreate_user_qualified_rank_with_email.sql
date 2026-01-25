-- Migration: Drop and recreate user_qualified_rank view with email and referral_id
-- Date: 2026-01-22

-- 1. Drop dependent views
DROP VIEW IF EXISTS user_commission_eligibility CASCADE;
DROP VIEW IF EXISTS user_qualified_rank CASCADE;

CREATE VIEW user_qualified_rank AS
SELECT
  p.id AS profile_id,
  p.user_id,
  p.email,
  p.referral_id,
  p.rank,
  p.status,
  p.personal_volume,
  p.total_left_volume,
  p.total_right_volume
FROM public.profiles p;

-- Add any additional columns needed for your dashboard below
-- Example: commission_eligible, total_orders, etc.
-- ALTER VIEW user_qualified_rank ...
