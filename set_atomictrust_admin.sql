-- Make atomictrust@protonmail.com an admin
-- Method 1: Add to user_roles table
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin'::app_role FROM auth.users 
WHERE email = 'atomictrust@protonmail.com'
ON CONFLICT (user_id, role) DO NOTHING;

-- Method 2: Set is_admin flag in profiles
UPDATE public.profiles
SET is_admin = TRUE
WHERE user_id IN (
  SELECT id FROM auth.users WHERE email = 'atomictrust@protonmail.com'
);

-- Verify it worked
SELECT 
  u.email,
  p.is_admin as profile_is_admin,
  ur.role as user_role
FROM auth.users u
LEFT JOIN public.profiles p ON p.user_id = u.id
LEFT JOIN public.user_roles ur ON ur.user_id = u.id
WHERE u.email = 'atomictrust@protonmail.com';
