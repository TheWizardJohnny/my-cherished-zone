-- Verify admin setup for atomictrust@protonmail.com
SELECT 
  u.email,
  u.id as auth_user_id,
  p.id as profile_id,
  p.is_admin as profile_is_admin,
  ur.role as user_role,
  ur.id as user_role_id
FROM auth.users u
LEFT JOIN public.profiles p ON p.user_id = u.id
LEFT JOIN public.user_roles ur ON ur.user_id = u.id
WHERE u.email = 'atomictrust@protonmail.com';

-- Test if is_admin() function works
-- (This will only work if you run it while logged in as atomictrust)
SELECT public.is_admin() as is_admin_result;

-- Check all policies on products table
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd
FROM pg_policies 
WHERE tablename = 'products'
ORDER BY cmd, policyname;
