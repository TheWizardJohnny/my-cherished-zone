-- Check for duplicate user_id or email in profiles
SELECT user_id, email, COUNT(*)
FROM profiles
GROUP BY user_id, email
HAVING COUNT(*) > 1;

-- Check for NOT NULL or UNIQUE constraints on profiles
SELECT column_name, is_nullable
FROM information_schema.columns
WHERE table_name = 'profiles';
