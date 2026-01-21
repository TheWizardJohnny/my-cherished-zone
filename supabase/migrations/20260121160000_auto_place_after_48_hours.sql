-- Auto-place unplaced referrals after 48 hours
-- Creates a function to automatically place users who haven't been manually placed by their referrer

BEGIN;

-- Function to auto-place users after 48 hours
CREATE OR REPLACE FUNCTION public.auto_place_overdue_referrals()
RETURNS TABLE (
  placed_user_id uuid,
  referrer_id uuid,
  user_email text,
  hours_overdue numeric
) AS $$
DECLARE
  referral_record RECORD;
  placement_result jsonb;
BEGIN
  -- Find all referrals created more than 48 hours ago without a placement
  FOR referral_record IN
    SELECT 
      r.id as referral_id,
      r.referred_user_id,
      r.referrer_id,
      r.created_at,
      p.email,
      EXTRACT(EPOCH FROM (NOW() - r.created_at)) / 3600 as hours_since_signup
    FROM public.referrals r
    INNER JOIN public.profiles p ON p.id = r.referred_user_id
    WHERE 
      -- More than 48 hours old
      r.created_at < NOW() - INTERVAL '48 hours'
      -- No placement exists yet
      AND NOT EXISTS (
        SELECT 1 
        FROM public.placements pl 
        WHERE pl.user_id = r.referred_user_id
          AND pl.position IS NOT NULL 
          AND pl.position != ''
      )
    ORDER BY r.created_at ASC
  LOOP
    -- Attempt to place the user using auto strategy
    BEGIN
      SELECT public.place_user_in_binary_tree(
        referral_record.referred_user_id,
        referral_record.referrer_id,
        'auto'
      ) INTO placement_result;
      
      -- Return the placed user info
      placed_user_id := referral_record.referred_user_id;
      referrer_id := referral_record.referrer_id;
      user_email := referral_record.email;
      hours_overdue := referral_record.hours_since_signup - 48;
      
      RETURN NEXT;
      
      RAISE NOTICE 'Auto-placed user % (%) after % hours', 
        referral_record.email, 
        referral_record.referred_user_id,
        referral_record.hours_since_signup;
        
    EXCEPTION WHEN OTHERS THEN
      -- Log error but continue with other placements
      RAISE WARNING 'Failed to auto-place user % (%): %', 
        referral_record.email,
        referral_record.referred_user_id,
        SQLERRM;
    END;
  END LOOP;
  
  RETURN;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Grant execute permission to authenticated users (for manual testing)
GRANT EXECUTE ON FUNCTION public.auto_place_overdue_referrals() TO authenticated;

-- Create a log table to track auto-placements
CREATE TABLE IF NOT EXISTS public.auto_placement_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  referrer_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  placed_at timestamptz DEFAULT NOW(),
  hours_overdue numeric,
  placement_position text,
  created_at timestamptz DEFAULT NOW()
);

-- Enable RLS on auto_placement_logs
ALTER TABLE public.auto_placement_logs ENABLE ROW LEVEL SECURITY;

-- Admin can view all auto-placement logs
CREATE POLICY "Admins can view auto-placement logs"
  ON public.auto_placement_logs
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.user_id = auth.uid()
        AND profiles.is_admin = true
    )
  );

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_referrals_created_at ON public.referrals(created_at);
CREATE INDEX IF NOT EXISTS idx_placements_user_id_position ON public.placements(user_id, position);

COMMIT;
