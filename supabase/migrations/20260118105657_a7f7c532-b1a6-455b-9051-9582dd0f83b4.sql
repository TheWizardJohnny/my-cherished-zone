-- Create security definer function to get own profile id
CREATE OR REPLACE FUNCTION public.get_own_profile_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM profiles WHERE user_id = auth.uid()
$$;

-- Create policy for viewing downline using security definer function
CREATE POLICY "Users can view downline basic info"
ON public.profiles FOR SELECT
USING (
  sponsor_id = public.get_own_profile_id()
  OR placement_id = public.get_own_profile_id()
);

-- Add policy to prevent direct commission inserts (only via backend)
CREATE POLICY "Prevent direct commission inserts"
ON public.commissions FOR INSERT
WITH CHECK (false);