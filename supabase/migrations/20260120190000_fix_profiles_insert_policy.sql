-- Fix RLS INSERT policy on profiles table for new user signup
-- The issue: INSERT policy was checking auth.uid() = id, but during signup
-- the profile is created with user_id matching auth.uid(), not id

-- Drop the incorrect INSERT policy
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON profiles;

-- Create correct INSERT policy that checks user_id instead of id
CREATE POLICY "Enable insert for authenticated users"
  ON profiles FOR INSERT
  WITH CHECK (auth.uid() = user_id);
