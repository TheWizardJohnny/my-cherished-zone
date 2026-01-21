-- Debug: Check if current user has admin role
SELECT 
    ur.user_id,
    ur.role,
    u.email,
    public.is_admin() as is_admin_result
FROM public.user_roles ur
JOIN auth.users u ON ur.user_id = u.id
WHERE ur.role = 'admin';

-- Also check the is_admin function definition
SELECT pg_get_functiondef(oid)
FROM pg_proc
WHERE proname = 'is_admin';
