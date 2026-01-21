-- Fix products UPDATE policy to include WITH CHECK clause
-- This allows admins to update products including the 'active' field

DROP POLICY IF EXISTS "Admins can update products" ON public.products;

CREATE POLICY "Admins can update products"
ON public.products FOR UPDATE
USING (public.is_admin())
WITH CHECK (public.is_admin());
