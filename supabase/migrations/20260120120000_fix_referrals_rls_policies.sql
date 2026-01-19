-- Fix RLS policies on referrals table
-- The current policy is checking for a non-existent user_id column
-- This migration corrects the RLS policies to properly check auth.uid()

-- Only proceed if referrals table exists
DO $$
BEGIN
  IF EXISTS (
    SELECT FROM pg_tables
    WHERE schemaname = 'public'
    AND tablename = 'referrals'
  ) THEN
    -- Drop existing policies
    DROP POLICY IF EXISTS "Users can view their own referrals" ON referrals;
    DROP POLICY IF EXISTS "Only admins can insert referrals" ON referrals;
    DROP POLICY IF EXISTS "Only admins can update referrals" ON referrals;
    DROP POLICY IF EXISTS "Only admins can delete referrals" ON referrals;

    -- Create corrected RLS Policies
    CREATE POLICY "Users can view their own referrals"
      ON referrals FOR SELECT
      USING (
        auth.uid() = referred_user_id
        OR auth.uid() = referrer_id
        OR EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin')
      );

    CREATE POLICY "Only admins can insert referrals"
      ON referrals FOR INSERT
      WITH CHECK (EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin'));

    CREATE POLICY "Only admins can update referrals"
      ON referrals FOR UPDATE
      USING (EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin'));

    CREATE POLICY "Only admins can delete referrals"
      ON referrals FOR DELETE
      USING (EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin'));
  END IF;
END $$;
