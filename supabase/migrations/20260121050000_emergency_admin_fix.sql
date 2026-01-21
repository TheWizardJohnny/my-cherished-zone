-- Emergency fix: Allow atomictrust@protonmail.com to bypass ALL RLS on products
-- This creates a direct email-based admin check that doesn't rely on user_roles

-- Drop existing policies
DROP POLICY IF EXISTS "Admins can insert products" ON public.products;
DROP POLICY IF EXISTS "Admins can update products" ON public.products;
DROP POLICY IF EXISTS "Admins can delete products" ON public.products;

-- Create a simpler admin check function that checks email directly
CREATE OR REPLACE FUNCTION public.is_admin_by_email()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM auth.users
    WHERE id = auth.uid() 
    AND email IN ('atomictrust@protonmail.com')
  ) OR EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() AND role = 'admin'
  ) OR EXISTS (
    SELECT 1 FROM public.profiles
    WHERE user_id = auth.uid() AND is_admin = TRUE
  )
$$;

-- Recreate policies using the new function
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

-- Grant permissions
GRANT EXECUTE ON FUNCTION public.is_admin_by_email() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin_by_email() TO anon;
