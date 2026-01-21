-- Fix handle_new_user to capture and save full_name from signup metadata
-- Issue: Full name entered during signup was not being saved to profiles table

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user CASCADE;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  rid text;
  new_profile_id uuid;
  referrer_profile_id uuid;
  provided_referral_id text;
  provided_full_name text;
BEGIN
  -- Generate unique referral ID for the new user
  rid := public.generate_random_8char_id();
  
  -- Extract full_name and referral_id from signup metadata
  provided_full_name := NEW.raw_user_meta_data->>'full_name';
  provided_referral_id := NEW.raw_user_meta_data->>'referral_id';
  
  -- Insert new profile with full_name, referral_id, status, and rank
  INSERT INTO public.profiles (user_id, email, full_name, referral_id, status, rank)
  VALUES (NEW.id, NEW.email, provided_full_name, rid, 'active', 'member')
  RETURNING id INTO new_profile_id;
  
  -- If a referral code was provided in signup metadata, create referral relationship
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
