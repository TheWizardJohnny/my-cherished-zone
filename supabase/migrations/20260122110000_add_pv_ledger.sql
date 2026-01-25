-- PV ledger for auditable volume tracking
CREATE TABLE public.pv_ledger (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    source_user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
    amount NUMERIC(12,2) NOT NULL CHECK (amount >= 0),
    leg_side TEXT NOT NULL CHECK (leg_side IN ('personal', 'left', 'right', 'other')),
    event_type TEXT NOT NULL DEFAULT 'order' CHECK (event_type IN ('order', 'adjustment', 'bonus')),
    note TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX pv_ledger_user_created_idx ON public.pv_ledger (user_id, created_at DESC);
CREATE INDEX pv_ledger_order_idx ON public.pv_ledger (order_id);

ALTER TABLE public.pv_ledger ENABLE ROW LEVEL SECURITY;

-- RLS: users see their own ledger rows
CREATE POLICY "Users can view their own pv ledger" ON public.pv_ledger
FOR SELECT USING (
  user_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
);

-- RLS: admins see all
CREATE POLICY "Admins can view pv ledger" ON public.pv_ledger
FOR SELECT USING (public.is_admin_by_email());

-- Allow admins to insert adjustments/entries
CREATE POLICY "Admins can insert pv ledger" ON public.pv_ledger
FOR INSERT WITH CHECK (public.is_admin_by_email());

-- Summary for admins
CREATE OR REPLACE FUNCTION public.pv_admin_summary()
RETURNS TABLE (
  total_pv NUMERIC,
  left_pv NUMERIC,
  right_pv NUMERIC,
  personal_pv NUMERIC,
  total_entries BIGINT
) AS $$
BEGIN
  IF NOT public.is_admin_by_email() THEN
    RAISE EXCEPTION 'Admin privileges required';
  END IF;

  RETURN QUERY
  SELECT
    COALESCE(SUM(amount), 0) AS total_pv,
    COALESCE(SUM(CASE WHEN leg_side = 'left' THEN amount END), 0) AS left_pv,
    COALESCE(SUM(CASE WHEN leg_side = 'right' THEN amount END), 0) AS right_pv,
    COALESCE(SUM(CASE WHEN leg_side = 'personal' THEN amount END), 0) AS personal_pv,
    COUNT(*) AS total_entries
  FROM public.pv_ledger;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Summary for a specific user (profile id)
CREATE OR REPLACE FUNCTION public.pv_user_summary(p_profile_id UUID)
RETURNS TABLE (
  total_pv NUMERIC,
  left_pv NUMERIC,
  right_pv NUMERIC,
  personal_pv NUMERIC,
  total_entries BIGINT
) AS $$
DECLARE
  is_self BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = p_profile_id AND p.user_id = auth.uid()
  ) INTO is_self;

  IF NOT is_self AND NOT public.is_admin_by_email() THEN
    RAISE EXCEPTION 'Access denied for this profile';
  END IF;

  RETURN QUERY
  SELECT
    COALESCE(SUM(amount), 0) AS total_pv,
    COALESCE(SUM(CASE WHEN leg_side = 'left' THEN amount END), 0) AS left_pv,
    COALESCE(SUM(CASE WHEN leg_side = 'right' THEN amount END), 0) AS right_pv,
    COALESCE(SUM(CASE WHEN leg_side = 'personal' THEN amount END), 0) AS personal_pv,
    COUNT(*) AS total_entries
  FROM public.pv_ledger
  WHERE user_id = p_profile_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
