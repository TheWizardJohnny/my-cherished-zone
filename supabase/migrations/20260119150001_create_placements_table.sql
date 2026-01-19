-- Create Placements table for Binary MLM structure
CREATE TABLE IF NOT EXISTS placements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES profiles(id) ON DELETE CASCADE,
  upline_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  position VARCHAR(10) CHECK (position IN ('left', 'right')), -- Position in binary tree (left or right of upline)
  status VARCHAR(20) NOT NULL DEFAULT 'unplaced' CHECK (status IN ('unplaced', 'placed')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Create index for faster lookups
CREATE INDEX idx_placements_upline_id ON placements(upline_id);
CREATE INDEX idx_placements_user_id ON placements(user_id);
CREATE INDEX idx_placements_status ON placements(status);

-- Create trigger to update updated_at timestamp
CREATE TRIGGER update_placements_updated_at
BEFORE UPDATE ON placements
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Enable RLS
ALTER TABLE placements ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Public can view placement info if it's their own profile or they're an admin
CREATE POLICY "Users can view their own placement"
  ON placements FOR SELECT
  USING (
    auth.uid()::text = (SELECT user_id::text FROM profiles WHERE id = user_id)
    OR EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );

-- Only admins can insert/update/delete placements
CREATE POLICY "Only admins can manage placements"
  ON placements FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin'));

CREATE POLICY "Only admins can update placements"
  ON placements FOR UPDATE
  USING (EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin'));

CREATE POLICY "Only admins can delete placements"
  ON placements FOR DELETE
  USING (EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin'));

-- Function to validate binary structure (max 2 direct downlines per user)
CREATE OR REPLACE FUNCTION check_binary_placement_limit()
RETURNS TRIGGER AS $$
BEGIN
  -- Check if upline already has 2 placements (one left, one right)
  IF NEW.upline_id IS NOT NULL AND NEW.status = 'placed' THEN
    IF (
      SELECT COUNT(*) FROM placements 
      WHERE upline_id = NEW.upline_id AND status = 'placed'
    ) >= 2 THEN
      RAISE EXCEPTION 'User can only have 2 direct placements (left and right) in binary structure';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER validate_binary_placement
BEFORE INSERT OR UPDATE ON placements
FOR EACH ROW
EXECUTE FUNCTION check_binary_placement_limit();
