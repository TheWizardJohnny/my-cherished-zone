-- Migration: Fix admin PV ledger RLS policy
-- Ensure admins can view all PV ledger entries
DROP POLICY IF EXISTS "Admins can view pv ledger" ON public.pv_ledger;
CREATE POLICY "Admins can view pv ledger" ON public.pv_ledger
FOR SELECT USING (public.is_admin());