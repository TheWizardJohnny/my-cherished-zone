-- Temporarily allow NULL for referral_id to prevent signup failures
-- The trigger will still generate the ID, but won't fail if there's a race condition

ALTER TABLE profiles ALTER COLUMN referral_id DROP NOT NULL;
