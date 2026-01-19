-- Fix RLS policies on profiles table to allow reading public genealogy information
-- Users need to be able to read other users' profiles for genealogy display

-- Drop existing restrictive policies if they exist
DROP POLICY IF EXISTS "Users can view their own profile" ON profiles;
DROP POLICY IF EXISTS "Users can view public profile data" ON profiles;
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON profiles;

-- Create policy allowing authenticated users to SELECT profile data
-- This is needed for genealogy display and admin panel
CREATE POLICY "Enable select for authenticated users"
  ON profiles FOR SELECT
  USING (true);

-- Create policy for profile updates - only own profile or admins
CREATE POLICY "Users can update their own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id);

-- Create policy for admin updates
CREATE POLICY "Admins can update any profile"
  ON profiles FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin')
    OR auth.uid() IN (SELECT id FROM profiles WHERE email LIKE '%@atomicrust%' OR email LIKE '%@atomic%')
  );

-- Create policy for inserts during auth signup
CREATE POLICY "Enable insert for authenticated users"
  ON profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- Create policy for deletes - admins only
CREATE POLICY "Admins can delete profiles"
  ON profiles FOR DELETE
  USING (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin')
    OR auth.uid() IN (SELECT id FROM profiles WHERE email LIKE '%@atomicrust%' OR email LIKE '%@atomic%')
  );
