-- Backfill any profiles missing a referral_id so referral links stay consistent
-- Uses existing generate_random_8char_id helper for unique codes

BEGIN;

DO $$
DECLARE
  rec RECORD;
BEGIN
  FOR rec IN
    SELECT id
    FROM public.profiles
    WHERE referral_id IS NULL OR btrim(referral_id) = ''
  LOOP
    UPDATE public.profiles
    SET referral_id = public.generate_random_8char_id()
    WHERE id = rec.id;
  END LOOP;
END;
$$;

COMMIT;
