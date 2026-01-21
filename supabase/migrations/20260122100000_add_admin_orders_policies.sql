-- Add admin DELETE policy for orders table
-- This allows admins to delete orders that are stuck or need to be removed

-- Drop existing DELETE policies on orders (should be none, but be safe)
DO $$ 
DECLARE
    r RECORD;
BEGIN
    FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = 'orders') LOOP
        -- Only drop DELETE policies
        IF r.policyname LIKE '%delete%' OR r.policyname LIKE '%Delete%' OR r.policyname LIKE '%DELETE%' THEN
            EXECUTE format('DROP POLICY IF EXISTS %I ON public.orders', r.policyname);
        END IF;
    END LOOP;
END $$;

-- Add admin DELETE policy for orders
CREATE POLICY "Admins can delete orders"
ON public.orders FOR DELETE
TO authenticated
USING (public.is_admin_by_email());

