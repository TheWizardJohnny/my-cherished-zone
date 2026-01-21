-- Comprehensive fix: Remove ALL conflicting policies and rebuild from scratch
-- This ensures no old policies are interfering

-- Drop ALL policies on products table
DO $$ 
DECLARE
    r RECORD;
BEGIN
    FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = 'products') LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.products', r.policyname);
    END LOOP;
END $$;

-- Update is_admin_by_email to be more explicit
CREATE OR REPLACE FUNCTION public.is_admin_by_email()
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    user_email TEXT;
    is_admin_result BOOLEAN := FALSE;
BEGIN
    -- Get current user's email
    SELECT email INTO user_email FROM auth.users WHERE id = auth.uid();
    
    -- Check if email is atomictrust@protonmail.com
    IF user_email = 'atomictrust@protonmail.com' THEN
        RETURN TRUE;
    END IF;
    
    -- Check user_roles table
    IF EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin') THEN
        RETURN TRUE;
    END IF;
    
    -- Check profiles table
    IF EXISTS (SELECT 1 FROM public.profiles WHERE user_id = auth.uid() AND is_admin = TRUE) THEN
        RETURN TRUE;
    END IF;
    
    RETURN FALSE;
END;
$$;

-- Recreate ALL policies on products table with explicit permissions
CREATE POLICY "Anyone can view active products"
ON public.products FOR SELECT
TO public
USING (active = TRUE);

CREATE POLICY "Admins can view all products"
ON public.products FOR SELECT
TO authenticated
USING (public.is_admin_by_email());

CREATE POLICY "Admins can insert products"
ON public.products FOR INSERT
TO authenticated
WITH CHECK (public.is_admin_by_email());

CREATE POLICY "Admins can update products"
ON public.products FOR UPDATE
TO authenticated
USING (public.is_admin_by_email())
WITH CHECK (public.is_admin_by_email());

CREATE POLICY "Admins can delete products"
ON public.products FOR DELETE
TO authenticated
USING (public.is_admin_by_email());

-- Grant all necessary permissions
GRANT EXECUTE ON FUNCTION public.is_admin_by_email() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin_by_email() TO anon;
GRANT EXECUTE ON FUNCTION public.is_admin_by_email() TO public;
