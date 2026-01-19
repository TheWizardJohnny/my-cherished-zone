-- Recreate placements table if it doesn't exist (fix for remote database)
-- This handles the case where the table was marked as migrated but doesn't actually exist

-- Drop and recreate the table to ensure it exists with correct structure
DROP TABLE IF EXISTS placements CASCADE;

-- Create Placements table for binary MLM structure
CREATE TABLE placements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES profiles(id) ON DELETE CASCADE,
  upline_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  position TEXT CHECK (position IN ('left', 'right', '')),
  status TEXT NOT NULL DEFAULT 'unplaced' CHECK (status IN ('placed', 'unplaced')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Create indexes for faster lookups
CREATE INDEX idx_placements_user_id ON placements(user_id);
CREATE INDEX idx_placements_upline_id ON placements(upline_id);

-- Enable RLS
ALTER TABLE placements ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own placements and downlines"
  ON placements FOR SELECT
  USING (
    auth.uid() = user_id
    OR auth.uid() = upline_id
    OR EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Only admins can insert placements"
  ON placements FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin'));

CREATE POLICY "Only admins can update placements"
  ON placements FOR UPDATE
  USING (EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin'));

CREATE POLICY "Only admins can delete placements"
  ON placements FOR DELETE
  USING (EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin'));

-- Function to validate binary placement (max 2 downlines per upline)
CREATE OR REPLACE FUNCTION validate_binary_placement()
RETURNS TRIGGER AS $$
DECLARE
  existing_count INTEGER;
  existing_positions TEXT[];
BEGIN
  -- If no upline, allow (root user)
  IF NEW.upline_id IS NULL THEN
    RETURN NEW;
  END IF;
  
  -- Count existing downlines for this upline
  SELECT COUNT(*), ARRAY_AGG(position)
  INTO existing_count, existing_positions
  FROM placements
  WHERE upline_id = NEW.upline_id AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::UUID);
  
  -- Check if upline already has 2 downlines
  IF existing_count >= 2 THEN
    RAISE EXCEPTION 'Upline already has 2 downlines (binary limit reached)';
  END IF;
  
  -- Check if position is already taken
  IF NEW.position != '' AND NEW.position = ANY(existing_positions) THEN
    RAISE EXCEPTION 'Position % already taken for this upline', NEW.position;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER check_binary_placement
BEFORE INSERT OR UPDATE ON placements
FOR EACH ROW
EXECUTE FUNCTION validate_binary_placement();
