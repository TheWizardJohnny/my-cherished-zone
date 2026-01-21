-- Manual fix for user SDMARIPU if needed
-- Run this to remove their placement so they can be re-placed

-- First check their current status
SELECT 
    'Profile Info' as section,
    id,
    email,
    referral_id
FROM profiles 
WHERE referral_id = 'SDMARIPU' OR email = 'whalecomofficial@gmail.com'

UNION ALL

SELECT 
    'Placement Info' as section,
    p.id::text,
    p.status,
    p.position
FROM placements p
JOIN profiles prof ON p.user_id = prof.id
WHERE prof.referral_id = 'SDMARIPU' OR prof.email = 'whalecomofficial@gmail.com';

-- If you want to REMOVE the placement to allow re-placement, uncomment below:
/*
DELETE FROM placements
WHERE user_id IN (
    SELECT id FROM profiles 
    WHERE referral_id = 'SDMARIPU' OR email = 'whalecomofficial@gmail.com'
);
*/
