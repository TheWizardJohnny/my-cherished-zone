-- Ensure users can view referrals they've made and the profiles of referred users
-- Date: 2026-01-19

-- Enable RLS on referrals if not already
ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view referrals they made (as referrer)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy WHERE polname = 'Users can view referrals they made' AND polrelid = 'public.referrals'::regclass
  ) THEN
    CREATE POLICY "Users can view referrals they made" ON public.referrals
      FOR SELECT USING (
        EXISTS (
          SELECT 1 FROM public.profiles p
          WHERE p.user_id = auth.uid() AND p.id = referrer_id
        )
      );
  END IF;
END $$;

-- Policy: Users can view referrals about them (as referred)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy WHERE polname = 'Users can view referrals about them' AND polrelid = 'public.referrals'::regclass
  ) THEN
    CREATE POLICY "Users can view referrals about them" ON public.referrals
      FOR SELECT USING (
        EXISTS (
          SELECT 1 FROM public.profiles p
          WHERE p.user_id = auth.uid() AND p.id = referred_user_id
        )
      );
  END IF;
END $$;

-- Profiles policy: Users can view profiles they referred
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy WHERE polname = 'Users can view profiles they referred' AND polrelid = 'public.profiles'::regclass
  ) THEN
    CREATE POLICY "Users can view profiles they referred" ON public.profiles
      FOR SELECT USING (
        EXISTS (
          SELECT 1
          FROM public.referrals r
          JOIN public.profiles me ON me.user_id = auth.uid()
          WHERE r.referrer_id = me.id
            AND r.referred_user_id = public.profiles.id
        )
      );
  END IF;
END $$;
