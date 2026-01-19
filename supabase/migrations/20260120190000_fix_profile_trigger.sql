-- Fix profile creation trigger to always set a unique referral_id
-- This trigger will set referral_id to the new profile's id (UUID as text)
-- and ensure all required fields are set

DROP FUNCTION IF EXISTS public.handle_new_user();
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  -- Insert new profile with referral_id set to id::text
  INSERT INTO public.profiles (user_id, email, referral_id)
  VALUES (NEW.id, NEW.email, NEW.id::text);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_user();

-- If you want referral_id to be random, replace NEW.id::text with a random generator function
-- Example: generate_random_8char_id() if you have that function
-- INSERT INTO public.profiles (user_id, email, referral_id)
-- VALUES (NEW.id, NEW.email, generate_random_8char_id());
