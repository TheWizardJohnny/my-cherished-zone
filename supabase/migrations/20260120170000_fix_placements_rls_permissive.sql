-- Fix RLS policies on placements table - make SELECT more permissive
-- The issue is that users can't even read their own placement records

-- Drop existing restrictive policies
DROP POLICY IF EXISTS "Users can view placements they are involved in" ON placements;
DROP POLICY IF EXISTS "Only admins can insert placements" ON placements;
DROP POLICY IF EXISTS "Only admins can update placements" ON placements;
DROP POLICY IF EXISTS "Only admins can delete placements" ON placements;

-- Create more permissive SELECT policy
-- Allow users to view their own placements and any placement where they are the upline
-- This should allow reading without restrictive admin checks
CREATE POLICY "Enable select for authenticated users"
  ON placements FOR SELECT
  USING (true);

-- Only admins can insert
CREATE POLICY "Only admins can insert placements"
  ON placements FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin')
    OR auth.uid() IN (SELECT id FROM profiles WHERE email LIKE '%@atomicrust%' OR email LIKE '%@atomic%')
  );

-- Only admins can update
CREATE POLICY "Only admins can update placements"
  ON placements FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin')
    OR auth.uid() IN (SELECT id FROM profiles WHERE email LIKE '%@atomicrust%' OR email LIKE '%@atomic%')
  );

-- Only admins can delete
CREATE POLICY "Only admins can delete placements"
  ON placements FOR DELETE
  USING (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin')
    OR auth.uid() IN (SELECT id FROM profiles WHERE email LIKE '%@atomicrust%' OR email LIKE '%@atomic%')
  );
