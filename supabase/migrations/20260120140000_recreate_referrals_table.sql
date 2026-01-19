-- Recreate referrals table if it doesn't exist (fix for remote database)
-- This handles the case where the table was marked as migrated but doesn't actually exist

-- Drop and recreate the table to ensure it exists with correct structure
DROP TABLE IF EXISTS referrals CASCADE;

-- Create Referrals table for tracking who referred each user (commission structure)
CREATE TABLE referrals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referred_user_id UUID NOT NULL UNIQUE REFERENCES profiles(id) ON DELETE CASCADE,
  referrer_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Create indexes for faster lookups
CREATE INDEX idx_referrals_referred_user_id ON referrals(referred_user_id);
CREATE INDEX idx_referrals_referrer_id ON referrals(referrer_id);

-- Enable RLS
ALTER TABLE referrals ENABLE ROW LEVEL SECURITY;

-- RLS Policies with corrected logic
CREATE POLICY "Users can view their own referrals"
  ON referrals FOR SELECT
  USING (
    auth.uid() = referred_user_id
    OR auth.uid() = referrer_id
    OR EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Only admins can insert referrals"
  ON referrals FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin'));

CREATE POLICY "Only admins can update referrals"
  ON referrals FOR UPDATE
  USING (EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin'));

CREATE POLICY "Only admins can delete referrals"
  ON referrals FOR DELETE
  USING (EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin'));

-- Function to ensure each user has only one referrer
CREATE OR REPLACE FUNCTION check_single_referrer()
RETURNS TRIGGER AS $$
BEGIN
  -- Check if this user already has a referrer
  IF EXISTS (
    SELECT 1 FROM referrals WHERE referred_user_id = NEW.referred_user_id AND id != NEW.id
  ) THEN
    RAISE EXCEPTION 'User can only have one referrer';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER validate_single_referrer
BEFORE INSERT OR UPDATE ON referrals
FOR EACH ROW
EXECUTE FUNCTION check_single_referrer();
