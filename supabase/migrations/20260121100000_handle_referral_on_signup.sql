-- Update handle_new_user trigger to automatically create referral relationship
-- when a user signs up with a referral code

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user CASCADE;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  rid text;
  new_profile_id uuid;
  referrer_profile_id uuid;
  provided_referral_id text;
BEGIN
  -- Generate unique referral ID for the new user
  rid := public.generate_random_8char_id();
  
  -- Insert new profile with referral_id
  INSERT INTO public.profiles (user_id, email, referral_id, status, rank)
  VALUES (NEW.id, NEW.email, rid, 'active', 'member')
  RETURNING id INTO new_profile_id;
  
  -- Check if a referral code was provided in signup metadata
  provided_referral_id := NEW.raw_user_meta_data->>'referral_id';
  
  IF provided_referral_id IS NOT NULL AND btrim(provided_referral_id) <> '' THEN
    -- Find the referrer's profile by their referral_id
    SELECT id INTO referrer_profile_id
    FROM public.profiles
    WHERE referral_id = btrim(provided_referral_id)
    LIMIT 1;
    
    -- If referrer found, create the referral relationship
    IF referrer_profile_id IS NOT NULL THEN
      INSERT INTO public.referrals (referred_user_id, referrer_id)
      VALUES (new_profile_id, referrer_profile_id)
      ON CONFLICT DO NOTHING;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
