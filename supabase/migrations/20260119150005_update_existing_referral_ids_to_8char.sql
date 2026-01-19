-- Update all existing users with random 8-character A-Z referral IDs
CREATE OR REPLACE FUNCTION generate_random_8char_id()
RETURNS TEXT AS $$
DECLARE
  new_id TEXT;
  characters TEXT := 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  char_length INT := LENGTH(characters);
  i INT;
BEGIN
  LOOP
    new_id := '';
    FOR i IN 1..8 LOOP
      new_id := new_id || SUBSTR(characters, (FLOOR(RANDOM() * char_length)::INT + 1), 1);
    END LOOP;
    -- Check if this ID already exists
    IF NOT EXISTS(SELECT 1 FROM profiles WHERE referral_id = new_id) THEN
      EXIT;
    END IF;
  END LOOP;
  RETURN new_id;
END;
$$ LANGUAGE plpgsql;

-- Temporarily disable the prevent update trigger
DROP TRIGGER IF EXISTS prevent_referral_id_update_trigger ON profiles;

-- Update all existing users with new 8-character IDs
UPDATE profiles 
SET referral_id = generate_random_8char_id()
WHERE LENGTH(referral_id) > 8 OR referral_id NOT SIMILAR TO '[A-Z]{8}';

-- Verify all referral_ids are now 8 characters
UPDATE profiles 
SET referral_id = generate_random_8char_id()
WHERE referral_id IS NULL OR LENGTH(referral_id) != 8;

-- Recreate the prevent update trigger (but only for future updates, not during migrations)
CREATE OR REPLACE FUNCTION prevent_referral_id_update()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.referral_id != OLD.referral_id THEN
    RAISE EXCEPTION 'Referral ID cannot be changed';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER prevent_referral_id_update_trigger
BEFORE UPDATE ON profiles
FOR EACH ROW
EXECUTE FUNCTION prevent_referral_id_update();
