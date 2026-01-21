-- Quick check: counts of profiles missing or blank referral_id, and duplicate referral_ids
\pset format aligned

SELECT COUNT(*) AS total_profiles FROM public.profiles;
SELECT COUNT(*) AS missing_referral_id FROM public.profiles WHERE referral_id IS NULL OR btrim(referral_id) = '';
SELECT referral_id, COUNT(*) AS dup_count
FROM public.profiles
WHERE referral_id IS NOT NULL AND btrim(referral_id) <> ''
GROUP BY referral_id
HAVING COUNT(*) > 1
ORDER BY dup_count DESC, referral_id
LIMIT 20;
