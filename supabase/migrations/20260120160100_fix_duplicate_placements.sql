-- Fix duplicate placements issue
-- This migration cleans up any duplicate placement records and ensures data consistency

-- First, let's see what we have
DO $$
DECLARE
    duplicate_count INTEGER;
BEGIN
    -- Count duplicate placements
    SELECT COUNT(*) INTO duplicate_count
    FROM (
        SELECT user_id, COUNT(*) as cnt
        FROM placements
        GROUP BY user_id
        HAVING COUNT(*) > 1
    ) duplicates;
    
    RAISE NOTICE 'Found % users with duplicate placements', duplicate_count;
    
    -- If there are duplicates, keep only the oldest placement for each user
    IF duplicate_count > 0 THEN
        -- Delete duplicate placements, keeping only the first one (oldest by created_at)
        DELETE FROM placements
        WHERE id NOT IN (
            SELECT DISTINCT ON (user_id) id
            FROM placements
            ORDER BY user_id, created_at ASC
        );
        
        RAISE NOTICE 'Cleaned up duplicate placements';
    END IF;
END $$;

-- Add a unique constraint to prevent future duplicates
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'placements_user_id_unique'
    ) THEN
        ALTER TABLE placements 
        ADD CONSTRAINT placements_user_id_unique UNIQUE (user_id);
        RAISE NOTICE 'Added unique constraint on user_id';
    END IF;
END $$;

-- Log the current state
DO $$
DECLARE
    total_placements INTEGER;
    total_users INTEGER;
BEGIN
    SELECT COUNT(*) INTO total_placements FROM placements;
    SELECT COUNT(DISTINCT user_id) INTO total_users FROM placements;
    
    RAISE NOTICE 'Current state: % placements for % unique users', total_placements, total_users;
END $$;
