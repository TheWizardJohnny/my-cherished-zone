-- Simplify referral ID generation to prevent signup errors
-- Drop the existing complex trigger
DROP TRIGGER IF EXISTS generate_referral_id_trigger ON profiles;
DROP TRIGGER IF EXISTS prevent_referral_id_update_trigger ON profiles;
DROP FUNCTION IF EXISTS set_random_referral_id();
DROP FUNCTION IF EXISTS prevent_referral_id_update();
DROP FUNCTION IF EXISTS generate_random_referral_id();

-- Create a simpler, more robust random ID generator
CREATE OR REPLACE FUNCTION generate_random_referral_id()
RETURNS TEXT AS $$
DECLARE
  new_id TEXT;
  i INT;
BEGIN
  new_id := '';
  FOR i IN 1..8 LOOP
    new_id := new_id || CHR(65 + (RANDOM() * 25)::INT);
  END LOOP;
  RETURN new_id;
END;
$$ LANGUAGE plpgsql;

-- Create a simple trigger that just generates an ID if not provided
CREATE OR REPLACE FUNCTION set_referral_id_on_insert()
RETURNS TRIGGER AS $$
BEGIN
  -- If referral_id is null or empty, generate one
  IF NEW.referral_id IS NULL OR NEW.referral_id = '' THEN
    NEW.referral_id := generate_random_referral_id();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER referral_id_trigger
BEFORE INSERT ON profiles
FOR EACH ROW
EXECUTE FUNCTION set_referral_id_on_insert();

-- Recreate the immutability trigger
CREATE OR REPLACE FUNCTION prevent_referral_id_update()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.referral_id IS DISTINCT FROM OLD.referral_id THEN
    RAISE EXCEPTION 'Referral ID cannot be changed';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER prevent_referral_id_update_trigger
BEFORE UPDATE ON profiles
FOR EACH ROW
EXECUTE FUNCTION prevent_referral_id_update();
