-- Add functions to handle different placement strategies for binary tree

-- Function to find the deepest left position under a given upline
CREATE OR REPLACE FUNCTION find_extreme_left_position(referrer_profile_id UUID)
RETURNS TABLE(upline_id UUID, pos TEXT) AS $$
DECLARE
  current_node UUID;
  left_child UUID;
BEGIN
  -- Start from the referrer
  current_node := referrer_profile_id;
  
  -- Keep going left until we find an empty left slot
  LOOP
    -- Check if current node has a left child
    SELECT p.user_id INTO left_child
    FROM placements p
    WHERE p.upline_id = current_node AND p.position = 'left'
    LIMIT 1;
    
    -- If no left child, this is the spot
    IF left_child IS NULL THEN
      RETURN QUERY SELECT current_node, 'left'::TEXT;
      RETURN;
    END IF;
    
    -- Move to the left child and continue
    current_node := left_child;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Function to find the deepest right position under a given upline
CREATE OR REPLACE FUNCTION find_extreme_right_position(referrer_profile_id UUID)
RETURNS TABLE(upline_id UUID, pos TEXT) AS $$
DECLARE
  current_node UUID;
  right_child UUID;
BEGIN
  -- Start from the referrer
  current_node := referrer_profile_id;
  
  -- Keep going right until we find an empty right slot
  LOOP
    -- Check if current node has a right child
    SELECT p.user_id INTO right_child
    FROM placements p
    WHERE p.upline_id = current_node AND p.position = 'right'
    LIMIT 1;
    
    -- If no right child, this is the spot
    IF right_child IS NULL THEN
      RETURN QUERY SELECT current_node, 'right'::TEXT;
      RETURN;
    END IF;
    
    -- Move to the right child and continue
    current_node := right_child;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Function to find next available position using breadth-first search (auto placement)
CREATE OR REPLACE FUNCTION find_auto_placement_position(referrer_profile_id UUID)
RETURNS TABLE(upline_id UUID, pos TEXT) AS $$
DECLARE
  queue UUID[] := ARRAY[referrer_profile_id];
  current_node UUID;
  left_child UUID;
  right_child UUID;
BEGIN
  -- Breadth-first search to find the first available slot
  WHILE array_length(queue, 1) > 0 LOOP
    -- Dequeue the first node
    current_node := queue[1];
    queue := queue[2:array_length(queue, 1)];
    
    -- Check for left child
    SELECT p.user_id INTO left_child
    FROM placements p
    WHERE p.upline_id = current_node AND p.position = 'left'
    LIMIT 1;
    
    -- If no left child, place here
    IF left_child IS NULL THEN
      RETURN QUERY SELECT current_node, 'left'::TEXT;
      RETURN;
    END IF;
    
    -- Check for right child
    SELECT p.user_id INTO right_child
    FROM placements p
    WHERE p.upline_id = current_node AND p.position = 'right'
    LIMIT 1;
    
    -- If no right child, place here
    IF right_child IS NULL THEN
      RETURN QUERY SELECT current_node, 'right'::TEXT;
      RETURN;
    END IF;
    
    -- Both slots filled, add children to queue
    queue := array_append(queue, left_child);
    queue := array_append(queue, right_child);
  END LOOP;
  
  -- Should never reach here, but return NULL if we do
  RETURN;
END;
$$ LANGUAGE plpgsql;

-- Main function to place a user in the binary tree
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
BEGIN
  -- Check if user already has a placement
  SELECT id INTO existing_placement
  FROM placements
  WHERE user_id = user_profile_id
  LIMIT 1;
  
  -- If already placed, return false
  IF existing_placement IS NOT NULL THEN
    RAISE EXCEPTION 'User already has a placement in the binary tree';
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
GRANT EXECUTE ON FUNCTION find_extreme_left_position(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION find_extreme_right_position(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION find_auto_placement_position(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION place_user_in_binary_tree(UUID, UUID, TEXT) TO authenticated;
