-- Create role enum
CREATE TYPE public.app_role AS ENUM ('admin', 'moderator', 'user');

-- Create user_roles table
CREATE TABLE public.user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    role app_role NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE (user_id, role)
);

-- Enable RLS
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Create security definer function to check roles
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Create security definer function to check if current user is admin
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = auth.uid()
      AND role = 'admin'
  )
$$;

-- RLS Policies for user_roles table
-- Admins can view all roles
CREATE POLICY "Admins can view all roles"
ON public.user_roles FOR SELECT
USING (public.is_admin());

-- Users can view their own roles
CREATE POLICY "Users can view own roles"
ON public.user_roles FOR SELECT
USING (user_id = auth.uid());

-- Only admins can insert roles
CREATE POLICY "Admins can insert roles"
ON public.user_roles FOR INSERT
WITH CHECK (public.is_admin());

-- Only admins can update roles
CREATE POLICY "Admins can update roles"
ON public.user_roles FOR UPDATE
USING (public.is_admin());

-- Only admins can delete roles
CREATE POLICY "Admins can delete roles"
ON public.user_roles FOR DELETE
USING (public.is_admin());

-- Add admin-only policies to other tables for management

-- Admins can view all profiles
CREATE POLICY "Admins can view all profiles"
ON public.profiles FOR SELECT
USING (public.is_admin());

-- Admins can update all profiles
CREATE POLICY "Admins can update all profiles"
ON public.profiles FOR UPDATE
USING (public.is_admin());

-- Admins can manage products
CREATE POLICY "Admins can insert products"
ON public.products FOR INSERT
WITH CHECK (public.is_admin());

CREATE POLICY "Admins can update products"
ON public.products FOR UPDATE
USING (public.is_admin());

CREATE POLICY "Admins can delete products"
ON public.products FOR DELETE
USING (public.is_admin());

-- Admins can view all commissions
CREATE POLICY "Admins can view all commissions"
ON public.commissions FOR SELECT
USING (public.is_admin());

-- Admins can insert commissions (for manual adjustments)
CREATE POLICY "Admins can insert commissions"
ON public.commissions FOR INSERT
WITH CHECK (public.is_admin());

-- Admins can update commissions
CREATE POLICY "Admins can update commissions"
ON public.commissions FOR UPDATE
USING (public.is_admin());

-- Admins can view all orders
CREATE POLICY "Admins can view all orders"
ON public.orders FOR SELECT
USING (public.is_admin());

-- Admins can update orders
CREATE POLICY "Admins can update orders"
ON public.orders FOR UPDATE
USING (public.is_admin());

-- Admins can view all withdrawals
CREATE POLICY "Admins can view all withdrawals"
ON public.withdrawals FOR SELECT
USING (public.is_admin());

-- Admins can update withdrawals (for processing)
CREATE POLICY "Admins can update withdrawals"
ON public.withdrawals FOR UPDATE
USING (public.is_admin());

-- Admins can manage announcements
CREATE POLICY "Admins can insert announcements"
ON public.announcements FOR INSERT
WITH CHECK (public.is_admin());

CREATE POLICY "Admins can update announcements"
ON public.announcements FOR UPDATE
USING (public.is_admin());

CREATE POLICY "Admins can delete announcements"
ON public.announcements FOR DELETE
USING (public.is_admin());