-- Simplified approach: just create profile with user_id and email during signup
-- Don't try to set up sponsor relationship during creation
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  -- Simply create the profile with user_id, email, and full_name from metadata
  -- The referral_id trigger will handle generating the ID
  -- The sponsor relationship can be set up later via a separate function if needed
  INSERT INTO public.profiles (
    user_id, 
    email, 
    full_name
  )
  VALUES (
    NEW.id, 
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', '')
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
