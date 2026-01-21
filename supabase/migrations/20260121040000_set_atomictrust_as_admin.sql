-- Make atomictrust@protonmail.com an admin in the database
-- This migration ensures the admin user has proper permissions

-- Add to user_roles table
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin'::app_role FROM auth.users 
WHERE email = 'atomictrust@protonmail.com'
ON CONFLICT (user_id, role) DO NOTHING;

-- Set is_admin flag in profiles
UPDATE public.profiles
SET is_admin = TRUE
WHERE user_id IN (
  SELECT id FROM auth.users WHERE email = 'atomictrust@protonmail.com'
);
