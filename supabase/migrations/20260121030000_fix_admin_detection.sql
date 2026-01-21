-- Add admin users to user_roles table and fix admin detection
-- This ensures both localStorage and database admin checks work

-- First, let's insert admin roles for any users who are currently logged in as admin
-- You'll need to replace 'YOUR_EMAIL_HERE' with your actual admin email

-- Uncomment and update the line below with your admin email:
-- INSERT INTO public.user_roles (user_id, role)
-- SELECT id, 'admin'::app_role FROM auth.users 
-- WHERE email = 'YOUR_EMAIL_HERE'
-- ON CONFLICT (user_id, role) DO NOTHING;

-- Alternative: Make is_admin() function also check for a flag in profiles table
-- This gives us a backup admin check method

-- Add an is_admin column to profiles table if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'profiles' AND column_name = 'is_admin') THEN
    ALTER TABLE public.profiles ADD COLUMN is_admin BOOLEAN DEFAULT FALSE;
  END IF;
END $$;

-- Update is_admin function to check BOTH user_roles table AND profiles.is_admin column
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() AND role = 'admin'
  ) OR EXISTS (
    SELECT 1 FROM public.profiles
    WHERE user_id = auth.uid() AND is_admin = TRUE
  )
$$;

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;
