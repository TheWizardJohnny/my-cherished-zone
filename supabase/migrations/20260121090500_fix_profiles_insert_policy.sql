-- Fix RLS INSERT policy on profiles table for new user signup
-- Use user_id instead of id in the WITH CHECK clause

DROP POLICY IF EXISTS "Enable insert for authenticated users" ON profiles;

CREATE POLICY "Enable insert for authenticated users"
  ON profiles FOR INSERT
  WITH CHECK (auth.uid() = user_id);
