-- Update the referral_id to be the same as the user's id (UUID)
-- Drop the old trigger and function
DROP TRIGGER IF EXISTS set_referral_id ON profiles;
DROP TRIGGER IF EXISTS generate_referral_id ON profiles;
DROP FUNCTION IF EXISTS set_referral_id_to_user_id();
DROP FUNCTION IF EXISTS generate_referral_id();

-- Update all existing users to set their referral_id to their id
UPDATE profiles SET referral_id = id::text WHERE referral_id IS NULL OR referral_id != id::text;

-- Create new trigger to set referral_id = id on user creation
CREATE OR REPLACE FUNCTION set_referral_id_to_user_id()
RETURNS TRIGGER AS $$
BEGIN
  NEW.referral_id := NEW.id::text;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_referral_id_trigger
BEFORE INSERT ON profiles
FOR EACH ROW
EXECUTE FUNCTION set_referral_id_to_user_id();

-- Add NOT NULL constraint to referral_id since it's now always set
ALTER TABLE profiles ALTER COLUMN referral_id SET NOT NULL;
