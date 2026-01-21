-- Debug placement status for user SDMARIPU (whalecomofficial@gmail.com)

-- First, find the profile
SELECT 
    id as profile_id,
    user_id,
    email,
    referral_id,
    created_at
FROM profiles 
WHERE referral_id = 'SDMARIPU' OR email = 'whalecomofficial@gmail.com';

-- Check if they have any placements
SELECT 
    p.id as placement_id,
    p.user_id,
    p.upline_id,
    p.position,
    p.status,
    p.created_at,
    prof.email,
    prof.referral_id
FROM placements p
JOIN profiles prof ON p.user_id = prof.id
WHERE prof.referral_id = 'SDMARIPU' OR prof.email = 'whalecomofficial@gmail.com';

-- Check for duplicate or orphaned placements
SELECT 
    user_id,
    COUNT(*) as placement_count,
    array_agg(id) as placement_ids,
    array_agg(status) as statuses
FROM placements
WHERE user_id IN (
    SELECT id FROM profiles 
    WHERE referral_id = 'SDMARIPU' OR email = 'whalecomofficial@gmail.com'
)
GROUP BY user_id;

-- Check their referral record
SELECT 
    r.id,
    r.referred_user_id,
    r.referrer_id,
    r.created_at,
    ref_prof.email as referrer_email,
    ref_prof.referral_id as referrer_code
FROM referrals r
JOIN profiles ref_prof ON r.referrer_id = ref_prof.id
WHERE r.referred_user_id IN (
    SELECT id FROM profiles 
    WHERE referral_id = 'SDMARIPU' OR email = 'whalecomofficial@gmail.com'
);
