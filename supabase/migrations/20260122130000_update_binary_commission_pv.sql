-- Migration: Update Binary Commission Qualification to 100 PV
-- Date: 2026-01-22

-- Update commission_qualifications for binary_matching
UPDATE public.commission_qualifications
SET min_personal_volume = 100
WHERE type = 'binary_matching';

-- Documentation:
-- The requirement for binary commission is now 100 PV points (was previously $50 spend or 200 PV).
-- This change is reflected in Supabase and will be used by the qualification views and UI.
