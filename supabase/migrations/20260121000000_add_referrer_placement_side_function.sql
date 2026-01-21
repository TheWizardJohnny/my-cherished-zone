-- Function to calculate which side of the referrer's tree a user is placed in
-- This traces upward through the binary tree from the user to find their position relative to their referrer

CREATE OR REPLACE FUNCTION get_placement_side_relative_to_referrer(
    p_user_id UUID
)
RETURNS TEXT AS $$
DECLARE
    v_referrer_id UUID;
    v_current_user_id UUID;
    v_upline_id UUID;
    v_position TEXT;
    v_iteration_count INTEGER := 0;
    v_max_iterations INTEGER := 50; -- Safety limit to prevent infinite loops
BEGIN
    -- Get the user's referrer from the referrals table
    SELECT referrer_id INTO v_referrer_id
    FROM referrals
    WHERE referred_user_id = p_user_id;
    
    -- If no referrer found, return null
    IF v_referrer_id IS NULL THEN
        RETURN NULL;
    END IF;
    
    -- Get the user's placement info
    SELECT upline_id, position INTO v_upline_id, v_position
    FROM placements
    WHERE user_id = p_user_id;
    
    -- If no placement, return null
    IF v_upline_id IS NULL THEN
        RETURN NULL;
    END IF;
    
    -- If the immediate upline is the referrer, return the position
    IF v_upline_id = v_referrer_id THEN
        RETURN v_position;
    END IF;
    
    -- Otherwise, trace upward through the tree until we find the referrer
    v_current_user_id := v_upline_id;
    
    WHILE v_current_user_id IS NOT NULL AND v_iteration_count < v_max_iterations LOOP
        v_iteration_count := v_iteration_count + 1;
        
        -- Get the current node's upline and position
        SELECT upline_id, position INTO v_upline_id, v_position
        FROM placements
        WHERE user_id = v_current_user_id;
        
        -- If the upline is the referrer, we found the direct child
        IF v_upline_id = v_referrer_id THEN
            RETURN v_position;
        END IF;
        
        -- Move up to the next level
        v_current_user_id := v_upline_id;
    END LOOP;
    
    -- If we couldn't find the referrer in the upline chain, return null
    -- This might happen if the user is placed under someone else's tree
    RETURN NULL;
    
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION get_placement_side_relative_to_referrer(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_placement_side_relative_to_referrer(UUID) TO anon;

-- Add helpful comment
COMMENT ON FUNCTION get_placement_side_relative_to_referrer(UUID) IS 
'Returns which side (left or right) of the referrer''s tree a user is placed in. 
Traces upward through the binary tree from the user to their referrer.';
