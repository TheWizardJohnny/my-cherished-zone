-- Check RLS policies on referrals table
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  qual,
  with_check
FROM pg_policies
WHERE tablename = 'referrals'
ORDER BY policyname;

-- If no policies exist or admin can't access, we need to add a policy
-- This query should be run to see what policies exist

-- If needed, add policy for admin access:
-- ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY "admin_can_view_all_referrals" ON public.referrals
--   FOR SELECT
--   USING (auth.uid() IN (SELECT id FROM profiles WHERE role = 'admin'));
