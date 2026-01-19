-- Check for users without valid referral_ids
SELECT id, referral_id, email, created_at 
FROM profiles 
WHERE referral_id IS NULL OR referral_id = ''
ORDER BY created_at DESC;

-- If there are users without referral_ids, generate them
-- This query will show you which users need fixing
-- You can then use the generate_random_referral_id() function to create ids for them
