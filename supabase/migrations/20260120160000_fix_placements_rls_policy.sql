-- Fix RLS policies on placements table to allow users to view their own placements
-- Users should be able to read their own placement record to see their upline

-- Drop existing restrictive policies
DROP POLICY IF EXISTS "Users can view their own placements and downlines" ON placements;
DROP POLICY IF EXISTS "Only admins can insert placements" ON placements;
DROP POLICY IF EXISTS "Only admins can update placements" ON placements;
DROP POLICY IF EXISTS "Only admins can delete placements" ON placements;

-- Create corrected RLS Policies with better logic
-- Users can SELECT their own placement or any placement where they are the upline, or admins can see all
CREATE POLICY "Users can view placements they are involved in"
  ON placements FOR SELECT
  USING (
    auth.uid() = user_id
    OR auth.uid() = upline_id
    OR EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );

-- Only admins can insert
CREATE POLICY "Only admins can insert placements"
  ON placements FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin'));

-- Only admins can update
CREATE POLICY "Only admins can update placements"
  ON placements FOR UPDATE
  USING (EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin'));

-- Only admins can delete
CREATE POLICY "Only admins can delete placements"
  ON placements FOR DELETE
  USING (EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin'));
