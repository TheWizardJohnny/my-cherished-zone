-- Remove all placements for user SDMARIPU to allow re-placement
DELETE FROM placements
WHERE user_id IN (
    SELECT id FROM profiles 
    WHERE referral_id = 'SDMARIPU' OR email = 'whalecomofficial@gmail.com'
);
