-- Fix placement functions to handle case where referrer is not yet placed in tree
-- If the referrer has no placement, they become the root of their own subtree

DROP FUNCTION IF EXISTS place_user_in_binary_tree(UUID, UUID, TEXT);

CREATE OR REPLACE FUNCTION place_user_in_binary_tree(
  user_profile_id UUID,
  referrer_profile_id UUID,
  placement_strategy TEXT -- 'left', 'right', or 'auto'
)
RETURNS BOOLEAN AS $$
DECLARE
  target_upline_id UUID;
  target_pos TEXT;
  existing_placement UUID;
  referrer_placement UUID;
BEGIN
  -- Check if user already has a placement
  SELECT id INTO existing_placement
  FROM placements
  WHERE user_id = user_profile_id
  LIMIT 1;
  
  -- If already placed, raise exception
  IF existing_placement IS NOT NULL THEN
    RAISE EXCEPTION 'User already has a placement in the binary tree';
  END IF;
  
  -- Check if referrer has a placement in the binary tree
  SELECT id INTO referrer_placement
  FROM placements
  WHERE user_id = referrer_profile_id
  LIMIT 1;
  
  -- If referrer is not placed yet, place them as a root first
  IF referrer_placement IS NULL THEN
    INSERT INTO placements (user_id, upline_id, position, status)
    VALUES (referrer_profile_id, NULL, '', 'placed');
  END IF;
  
  -- Find the placement position based on strategy
  IF placement_strategy = 'left' THEN
    SELECT p.upline_id, p.pos INTO target_upline_id, target_pos
    FROM find_extreme_left_position(referrer_profile_id) p;
  ELSIF placement_strategy = 'right' THEN
    SELECT p.upline_id, p.pos INTO target_upline_id, target_pos
    FROM find_extreme_right_position(referrer_profile_id) p;
  ELSIF placement_strategy = 'auto' THEN
    SELECT p.upline_id, p.pos INTO target_upline_id, target_pos
    FROM find_auto_placement_position(referrer_profile_id) p;
  ELSE
    RAISE EXCEPTION 'Invalid placement strategy. Use left, right, or auto';
  END IF;
  
  -- Insert the placement
  INSERT INTO placements (user_id, upline_id, position, status)
  VALUES (user_profile_id, target_upline_id, target_pos, 'placed');
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION place_user_in_binary_tree(UUID, UUID, TEXT) TO authenticated;
