-- Add referral_id column to profiles table
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS referral_id TEXT UNIQUE;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_profiles_referral_id ON public.profiles(referral_id);

-- Generate unique referral IDs for existing users (using first 8 chars of UUID)
UPDATE public.profiles 
SET referral_id = UPPER(SUBSTRING(REPLACE(id::text, '-', ''), 1, 8))
WHERE referral_id IS NULL;

-- Create function to generate referral ID on profile creation
CREATE OR REPLACE FUNCTION generate_referral_id()
RETURNS TRIGGER AS $$
BEGIN
  -- Generate a unique 8-character referral ID from UUID
  NEW.referral_id := UPPER(SUBSTRING(REPLACE(NEW.id::text, '-', ''), 1, 8));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-generate referral_id for new profiles
DROP TRIGGER IF EXISTS set_referral_id ON public.profiles;
CREATE TRIGGER set_referral_id
  BEFORE INSERT ON public.profiles
  FOR EACH ROW
  WHEN (NEW.referral_id IS NULL)
  EXECUTE FUNCTION generate_referral_id();

-- Add function to handle user registration with referral
CREATE OR REPLACE FUNCTION public.handle_new_user_with_referral()
RETURNS TRIGGER AS $$
DECLARE
  sponsor_profile_id UUID;
  ref_id TEXT;
BEGIN
  -- Extract referral_id from user metadata if exists
  ref_id := NEW.raw_user_meta_data->>'referral_id';
  
  -- If referral_id exists, find the sponsor
  IF ref_id IS NOT NULL AND ref_id != '' THEN
    SELECT id INTO sponsor_profile_id
    FROM public.profiles
    WHERE referral_id = ref_id
    LIMIT 1;
  END IF;
  
  -- Create profile with sponsor_id if found
  INSERT INTO public.profiles (user_id, email, full_name, sponsor_id)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    sponsor_profile_id
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update the trigger to use the new function
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user_with_referral();
