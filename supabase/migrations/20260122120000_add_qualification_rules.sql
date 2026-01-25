-- Migration: Add Qualification Rules for Ranks and Commissions
-- Date: 2026-01-22

DROP VIEW IF EXISTS public.user_qualified_rank;
-- This table defines the requirements for each rank.
CREATE TABLE IF NOT EXISTS public.rank_qualifications (
  rank TEXT PRIMARY KEY,
  min_personal_volume DECIMAL(10,2) NOT NULL,
  min_left_leg_volume DECIMAL(10,2) NOT NULL,
  min_right_leg_volume DECIMAL(10,2) NOT NULL,
  min_active_referrals INTEGER NOT NULL
);

-- Populate with example data
INSERT INTO public.rank_qualifications (rank, min_personal_volume, min_left_leg_volume, min_right_leg_volume, min_active_referrals) VALUES
  ('member', 0, 0, 0, 0),
  ('bronze', 100, 500, 500, 2),
  ('silver', 200, 2000, 2000, 3),
  ('gold', 400, 5000, 5000, 4),
  ('platinum', 800, 15000, 15000, 5),
  ('diamond', 1600, 50000, 50000, 6),
  ('crown', 3200, 200000, 200000, 8)
ON CONFLICT (rank) DO NOTHING;

DROP VIEW IF EXISTS public.user_commission_eligibility;
-- This table defines requirements for each commission type.
CREATE TABLE IF NOT EXISTS public.commission_qualifications (
  type TEXT PRIMARY KEY,
  min_rank TEXT NOT NULL REFERENCES public.rank_qualifications(rank),
  min_personal_volume DECIMAL(10,2) NOT NULL
);

-- Populate with example data
INSERT INTO public.commission_qualifications (type, min_rank, min_personal_volume) VALUES
  ('retail_profit', 'member', 0),
  ('fast_start', 'bronze', 100),
  ('binary_matching', 'silver', 200),
  ('leadership_matching', 'gold', 400),
  ('rank_pool', 'diamond', 1600)
ON CONFLICT (type) DO NOTHING;

-- ========================================
-- 3. View: Qualified Rank for Each User
-- ========================================
CREATE OR REPLACE VIEW public.user_qualified_rank AS
SELECT
  p.id AS profile_id,
  p.user_id,
  p.personal_volume,
  p.total_left_volume,
  p.total_right_volume,
  p.status,
  p.rank,
  rq.rank AS qualified_rank,
  rq.min_personal_volume,
  rq.min_left_leg_volume,
  rq.min_right_leg_volume,
  rq.min_active_referrals,
  (
    SELECT COUNT(*) FROM public.profiles r
    WHERE r.sponsor_id = p.id AND r.status = 'active'
  ) AS active_referrals
FROM public.profiles p
JOIN public.rank_qualifications rq
  ON p.personal_volume >= rq.min_personal_volume
  AND p.total_left_volume >= rq.min_left_leg_volume
  AND p.total_right_volume >= rq.min_right_leg_volume
  AND (
    SELECT COUNT(*) FROM public.profiles r
    WHERE r.sponsor_id = p.id AND r.status = 'active'
  ) >= rq.min_active_referrals;

-- ========================================
-- 4. View: Commission Eligibility for Each User
-- ========================================
CREATE OR REPLACE VIEW public.user_commission_eligibility AS
SELECT
  p.id AS profile_id,
  p.user_id,
  p.rank,
  p.personal_volume,
  cq.type AS commission_type,
  cq.min_rank,
  cq.min_personal_volume,
  (p.personal_volume >= cq.min_personal_volume AND 
   (SELECT rq.rank FROM public.user_qualified_rank rq WHERE rq.profile_id = p.id LIMIT 1) >= cq.min_rank
  ) AS is_eligible
FROM public.profiles p
CROSS JOIN public.commission_qualifications cq;

-- ========================================
-- 5. Documentation
-- ========================================
-- These tables and views allow backend/frontend to check user qualification for ranks and commissions.
-- You can JOIN user_qualified_rank and user_commission_eligibility to display qualification status in the UI.
