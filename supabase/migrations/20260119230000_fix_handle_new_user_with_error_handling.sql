-- Fix handle_new_user trigger - ensure it bypasses RLS and handles all cases properly
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  sponsor_profile_id UUID;
  ref_id TEXT;
BEGIN
  -- Extract full_name and referral_id from user metadata
  ref_id := NEW.raw_user_meta_data->>'referral_id';
  
  -- Try to find sponsor by referral_id if provided
  IF ref_id IS NOT NULL AND ref_id != '' THEN
    BEGIN
      SELECT id INTO sponsor_profile_id
      FROM public.profiles
      WHERE referral_id = ref_id
      LIMIT 1;
    EXCEPTION WHEN OTHERS THEN
      -- If sponsor lookup fails, just continue without sponsor
      sponsor_profile_id := NULL;
    END;
  END IF;
  
  -- Insert profile with all provided data
  INSERT INTO public.profiles (
    user_id, 
    email, 
    full_name, 
    sponsor_id
  )
  VALUES (
    NEW.id, 
    NEW.email,
    NEW.raw_user_meta_data->>'full_name',
    sponsor_profile_id
  );
  
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Log the error and continue - the referral_id trigger will handle it
  RAISE WARNING 'Error in handle_new_user: %', SQLERRM;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
