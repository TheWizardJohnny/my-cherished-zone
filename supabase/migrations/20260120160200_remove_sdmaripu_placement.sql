-- Remove placement for user SDMARIPU to allow proper re-placement
-- This is a one-time fix for whalecomofficial@gmail.com

DO $$
DECLARE
    user_profile_id UUID;
    placement_count INTEGER;
BEGIN
    -- Get the user's profile ID
    SELECT id INTO user_profile_id
    FROM profiles 
    WHERE referral_id = 'SDMARIPU' OR email = 'whalecomofficial@gmail.com'
    LIMIT 1;
    
    IF user_profile_id IS NOT NULL THEN
        -- Count existing placements
        SELECT COUNT(*) INTO placement_count
        FROM placements
        WHERE user_id = user_profile_id;
        
        IF placement_count > 0 THEN
            -- Delete the placement
            DELETE FROM placements
            WHERE user_id = user_profile_id;
            
            RAISE NOTICE 'Removed % placement(s) for user SDMARIPU (%) to allow re-placement', placement_count, user_profile_id;
        ELSE
            RAISE NOTICE 'User SDMARIPU (%) has no placements to remove', user_profile_id;
        END IF;
    ELSE
        RAISE NOTICE 'User SDMARIPU not found';
    END IF;
END $$;
