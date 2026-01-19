-- Fix profile creation trigger and enforce stable referral_id generation
-- Uses short 8-char referral codes and keeps referral_id unique/immutable

BEGIN;

-- 1) Helper to generate a unique 8-char referral_id
DROP FUNCTION IF EXISTS public.generate_random_8char_id CASCADE;
CREATE OR REPLACE FUNCTION public.generate_random_8char_id()
RETURNS text AS $$
DECLARE
  chars text := 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  rid text := '';
  i int;
BEGIN
  LOOP
    rid := '';
    FOR i IN 1..8 LOOP
      rid := rid || substr(chars, floor(random() * 36)::int + 1, 1);
    END LOOP;
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.profiles WHERE referral_id = rid);
  END LOOP;
  RETURN rid;
END;
$$ LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public;

-- 2) Normalize existing referral_id values to avoid constraint failures
--    - Fill NULL/blank referral_id with the profile's UUID text (unique)
--    - For duplicates, reset to the profile UUID
WITH duplicates AS (
  SELECT referral_id
  FROM public.profiles
  WHERE referral_id IS NOT NULL AND btrim(referral_id) <> ''
  GROUP BY referral_id
  HAVING COUNT(*) > 1
)
UPDATE public.profiles p
SET referral_id = p.id::text
WHERE p.referral_id IS NULL OR btrim(p.referral_id) = ''
   OR p.referral_id IN (SELECT referral_id FROM duplicates);

-- 3) Rebuild constraint + immutability trigger
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS unique_referral_id;
ALTER TABLE public.profiles ADD CONSTRAINT unique_referral_id UNIQUE(referral_id);
ALTER TABLE public.profiles ALTER COLUMN referral_id SET NOT NULL;

-- Drop any existing triggers before dropping the function
DROP TRIGGER IF EXISTS prevent_referral_id_update_trigger ON public.profiles;
DROP TRIGGER IF EXISTS prevent_referral_id_update ON public.profiles;
DROP FUNCTION IF EXISTS public.prevent_referral_id_update;
CREATE OR REPLACE FUNCTION public.prevent_referral_id_update()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.referral_id IS DISTINCT FROM OLD.referral_id THEN
    RAISE EXCEPTION 'Referral ID cannot be changed';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER prevent_referral_id_update_trigger
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.prevent_referral_id_update();

-- 4) Recreate handle_new_user trigger to always set referral_id
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user CASCADE;
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  rid text;
BEGIN
  rid := public.generate_random_8char_id();
  INSERT INTO public.profiles (user_id, email, referral_id, status, rank)
  VALUES (NEW.id, NEW.email, rid, 'active', 'member');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

COMMIT;
