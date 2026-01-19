-- Generate random 8-character referral ID with A-Z only
CREATE OR REPLACE FUNCTION generate_random_referral_id()
RETURNS TEXT AS $$
DECLARE
  new_id TEXT;
  characters TEXT := 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  char_length INT := LENGTH(characters);
  i INT;
BEGIN
  new_id := '';
  FOR i IN 1..8 LOOP
    new_id := new_id || SUBSTR(characters, (FLOOR(RANDOM() * char_length)::INT + 1), 1);
  END LOOP;
  RETURN new_id;
END;
$$ LANGUAGE plpgsql;

-- Drop old trigger and function
DROP TRIGGER IF EXISTS set_referral_id_trigger ON profiles;
DROP FUNCTION IF EXISTS set_referral_id_to_user_id();

-- Create trigger to generate and set referral_id on user creation
CREATE OR REPLACE FUNCTION set_random_referral_id()
RETURNS TRIGGER AS $$
DECLARE
  new_ref_id TEXT;
  id_exists BOOLEAN;
BEGIN
  -- Generate a unique referral ID
  LOOP
    new_ref_id := generate_random_referral_id();
    -- Check if this ID already exists
    SELECT EXISTS(SELECT 1 FROM profiles WHERE referral_id = new_ref_id) INTO id_exists;
    -- Exit loop if ID is unique
    EXIT WHEN NOT id_exists;
  END LOOP;
  
  NEW.referral_id := new_ref_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER generate_referral_id_trigger
BEFORE INSERT ON profiles
FOR EACH ROW
EXECUTE FUNCTION set_random_referral_id();

-- Add UNIQUE constraint to referral_id
ALTER TABLE profiles ADD CONSTRAINT unique_referral_id UNIQUE(referral_id);

-- Add NOT NULL constraint
ALTER TABLE profiles ALTER COLUMN referral_id SET NOT NULL;

-- Prevent updates to referral_id (immutable)
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
