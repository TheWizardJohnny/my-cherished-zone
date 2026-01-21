-- Weekly Binary/Matching Pool Implementation
-- Rules:
-- - Qualification: matched PV >= 100; minimum 100 PV per leg; user must be "active" (has a completed order in the week)
-- - Carryover: Unmatched PV carries over to next week
-- - Week window: Friday 00:00 to Thursday 23:59:59
-- - Pool contribution: 25% of order total for orders with total_amount >= 50 and payment_status = 'completed'
-- - Payout: Admin approval required; payments go to user's wallet_address; if missing wallet, amount is recycled to next week's pool

-- Enable pg_cron for scheduling (safe if already enabled)
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Week window helper: given a timestamp, return [start_ts, end_ts] for the Friday-Thursday week containing it
CREATE OR REPLACE FUNCTION get_week_window(p_ts TIMESTAMPTZ)
RETURNS TABLE(start_ts TIMESTAMPTZ, end_ts TIMESTAMPTZ)
LANGUAGE sql
STABLE
AS $$
  SELECT
    date_trunc('week', p_ts) + INTERVAL '4 days' AS start_ts,
    (date_trunc('week', p_ts) + INTERVAL '4 days' + INTERVAL '7 days') - INTERVAL '1 second' AS end_ts
$$;

-- Pools master table
CREATE TABLE IF NOT EXISTS weekly_pools (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  week_start TIMESTAMPTZ NOT NULL,
  week_end TIMESTAMPTZ NOT NULL,
  total_contributions NUMERIC(18,2) NOT NULL DEFAULT 0,
  recycled_in NUMERIC(18,2) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'finalized')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_weekly_pools_week ON weekly_pools(week_start, week_end);

-- Contributions per order
CREATE TABLE IF NOT EXISTS weekly_pool_contributions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pool_id UUID NOT NULL REFERENCES weekly_pools(id) ON DELETE CASCADE,
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  buyer_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  amount NUMERIC(18,2) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (pool_id, order_id)
);

CREATE INDEX IF NOT EXISTS idx_weekly_pool_contrib_pool ON weekly_pool_contributions(pool_id);

-- Per-user weekly PV and carryover
CREATE TABLE IF NOT EXISTS weekly_user_pv (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pool_id UUID NOT NULL REFERENCES weekly_pools(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  left_pv NUMERIC(18,2) NOT NULL DEFAULT 0,
  right_pv NUMERIC(18,2) NOT NULL DEFAULT 0,
  carryover_left_in NUMERIC(18,2) NOT NULL DEFAULT 0,
  carryover_right_in NUMERIC(18,2) NOT NULL DEFAULT 0,
  matched_pv NUMERIC(18,2) NOT NULL DEFAULT 0,
  carryover_left_out NUMERIC(18,2) NOT NULL DEFAULT 0,
  carryover_right_out NUMERIC(18,2) NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (pool_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_weekly_user_pv_pool ON weekly_user_pv(pool_id);

-- Ensure a pool exists for the given timestamp; returns pool id
CREATE OR REPLACE FUNCTION ensure_weekly_pool(p_ts TIMESTAMPTZ)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_start TIMESTAMPTZ;
  v_end TIMESTAMPTZ;
  v_pool_id UUID;
BEGIN
  SELECT start_ts, end_ts INTO v_start, v_end FROM get_week_window(p_ts);

  SELECT id INTO v_pool_id FROM weekly_pools WHERE week_start = v_start AND week_end = v_end;
  IF v_pool_id IS NULL THEN
    INSERT INTO weekly_pools(week_start, week_end) VALUES(v_start, v_end) RETURNING id INTO v_pool_id;
  END IF;
  RETURN v_pool_id;
END;
$$;

-- Allocate order contribution (25%) to its week pool upon payment completion
CREATE OR REPLACE FUNCTION allocate_order_to_pool(p_order_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order RECORD;
  v_pool UUID;
  v_amount NUMERIC(18,2);
BEGIN
  SELECT * INTO v_order FROM orders WHERE id = p_order_id;
  IF NOT FOUND THEN RETURN; END IF;
  IF v_order.payment_status IS DISTINCT FROM 'completed' THEN RETURN; END IF;
  IF v_order.total_amount < 50 THEN RETURN; END IF;

  v_pool := ensure_weekly_pool(now()); -- use payment completion time window
  v_amount := ROUND(v_order.total_amount * 0.25, 2);

  INSERT INTO weekly_pool_contributions(pool_id, order_id, buyer_id, amount)
  VALUES(v_pool, v_order.id, v_order.user_id, v_amount)
  ON CONFLICT (pool_id, order_id) DO NOTHING;

  UPDATE weekly_pools SET total_contributions = total_contributions + v_amount WHERE id = v_pool;
END;
$$;

-- Compute PV per user for the week, including carryover from previous week
CREATE OR REPLACE FUNCTION compute_weekly_user_pv(p_pool_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_start TIMESTAMPTZ;
  v_end TIMESTAMPTZ;
BEGIN
  SELECT week_start, week_end INTO v_start, v_end FROM weekly_pools WHERE id = p_pool_id;
  IF v_start IS NULL THEN RAISE EXCEPTION 'Pool not found %', p_pool_id; END IF;

  -- For each user, compute left/right PV using placements tree and orders in window
  -- Left branch descendants
  WITH RECURSIVE tree AS (
    SELECT p.id AS root_id, c.user_id AS child_id, c.position
    FROM profiles p
    LEFT JOIN placements c ON c.upline_id = p.id
    UNION ALL
    SELECT t.root_id, c.user_id, c.position
    FROM tree t
    JOIN placements c ON c.upline_id = t.child_id
  ),
  orders_in_week AS (
    SELECT o.user_id, SUM(o.pv_earned) AS pv
    FROM orders o
    WHERE o.payment_status = 'completed' AND o.created_at >= v_start AND o.created_at <= v_end
    GROUP BY o.user_id
  ),
  left_desc AS (
    SELECT root_id AS user_id, child_id AS desc_id
    FROM tree WHERE position = 'left'
  ),
  right_desc AS (
    SELECT root_id AS user_id, child_id AS desc_id
    FROM tree WHERE position = 'right'
  ),
  left_pv AS (
    SELECT ld.user_id, COALESCE(SUM(oiw.pv), 0) AS pv
    FROM left_desc ld
    LEFT JOIN orders_in_week oiw ON oiw.user_id = ld.desc_id
    GROUP BY ld.user_id
  ),
  right_pv AS (
    SELECT rd.user_id, COALESCE(SUM(oiw.pv), 0) AS pv
    FROM right_desc rd
    LEFT JOIN orders_in_week oiw ON oiw.user_id = rd.desc_id
    GROUP BY rd.user_id
  ),
  active_users AS (
    SELECT DISTINCT o.user_id FROM orders o WHERE o.payment_status = 'completed' AND o.created_at >= v_start AND o.created_at <= v_end
  )
  INSERT INTO weekly_user_pv(pool_id, user_id, left_pv, right_pv, carryover_left_in, carryover_right_in, matched_pv, carryover_left_out, carryover_right_out, is_active)
  SELECT
    p_pool_id,
    u.id,
    COALESCE(lp.pv, 0),
    COALESCE(rp.pv, 0),
    COALESCE(prev.carryover_left_out, 0),
    COALESCE(prev.carryover_right_out, 0),
    LEAST(COALESCE(lp.pv, 0) + COALESCE(prev.carryover_left_out, 0), COALESCE(rp.pv, 0) + COALESCE(prev.carryover_right_out, 0)),
    GREATEST((COALESCE(lp.pv, 0) + COALESCE(prev.carryover_left_out, 0)) - LEAST(COALESCE(lp.pv, 0) + COALESCE(prev.carryover_left_out, 0), COALESCE(rp.pv, 0) + COALESCE(prev.carryover_right_out, 0)), 0),
    GREATEST((COALESCE(rp.pv, 0) + COALESCE(prev.carryover_right_out, 0)) - LEAST(COALESCE(lp.pv, 0) + COALESCE(prev.carryover_left_out, 0), COALESCE(rp.pv, 0) + COALESCE(prev.carryover_right_out, 0)), 0),
    (au.user_id IS NOT NULL)
  FROM profiles u
  LEFT JOIN left_pv lp ON lp.user_id = u.id
  LEFT JOIN right_pv rp ON rp.user_id = u.id
  LEFT JOIN (
    SELECT wup.user_id, wup.carryover_left_out, wup.carryover_right_out
    FROM weekly_user_pv wup
    JOIN weekly_pools wp ON wp.id = wup.pool_id
    WHERE wp.week_end = v_start - INTERVAL '1 second'
  ) prev ON prev.user_id = u.id
  LEFT JOIN active_users au ON au.user_id = u.id
  ON CONFLICT (pool_id, user_id) DO UPDATE SET
    left_pv = EXCLUDED.left_pv,
    right_pv = EXCLUDED.right_pv,
    carryover_left_in = EXCLUDED.carryover_left_in,
    carryover_right_in = EXCLUDED.carryover_right_in,
    matched_pv = EXCLUDED.matched_pv,
    carryover_left_out = EXCLUDED.carryover_left_out,
    carryover_right_out = EXCLUDED.carryover_right_out,
    is_active = EXCLUDED.is_active;
END;
$$;

-- Distribute weekly pool to qualified users (admin approval required before payout)
CREATE OR REPLACE FUNCTION distribute_weekly_binary_pool(p_pool_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pool RECORD;
  v_total NUMERIC(18,2);
  v_total_matched NUMERIC(18,2);
BEGIN
  SELECT * INTO v_pool FROM weekly_pools WHERE id = p_pool_id;
  IF v_pool.id IS NULL THEN RAISE EXCEPTION 'Pool not found %', p_pool_id; END IF;

  -- Compute PV snapshot for the week
  PERFORM compute_weekly_user_pv(p_pool_id);

  -- Total payout amount = contributions + recycled_in
  v_total := COALESCE(v_pool.total_contributions,0) + COALESCE(v_pool.recycled_in,0);

  -- Qualified users: active, matched_pv >= 100, each leg total (pv + carryover_in) >= 100
  WITH qualified AS (
    SELECT user_id, matched_pv,
           (left_pv + carryover_left_in) AS total_left,
           (right_pv + carryover_right_in) AS total_right
    FROM weekly_user_pv
    WHERE pool_id = p_pool_id
      AND is_active = TRUE
      AND matched_pv >= 100
      AND (left_pv + carryover_left_in) >= 100
      AND (right_pv + carryover_right_in) >= 100
  )
  SELECT SUM(matched_pv) INTO v_total_matched FROM qualified;

  IF COALESCE(v_total_matched, 0) = 0 OR v_total <= 0 THEN
    -- No qualified users or no funds; finalize pool without distributions
    UPDATE weekly_pools SET status = 'finalized' WHERE id = p_pool_id;
    RETURN;
  END IF;

  -- Create commission records in 'pending_admin' status
  INSERT INTO commissions(user_id, amount, type, status, description, created_at)
  SELECT q.user_id,
         ROUND(v_total * (q.matched_pv / v_total_matched), 2) AS amount,
         'binary_pool',
         'pending_admin',
         'Weekly binary pool payout for week ' || v_pool.week_start::date || ' - ' || v_pool.week_end::date,
         now()
  FROM (
    SELECT user_id, matched_pv FROM weekly_user_pv WHERE pool_id = p_pool_id AND is_active = TRUE AND matched_pv >= 100 AND (left_pv + carryover_left_in) >= 100 AND (right_pv + carryover_right_in) >= 100
  ) q;

  UPDATE weekly_pools SET status = 'finalized' WHERE id = p_pool_id;
END;
$$;

-- Admin approval helpers
CREATE OR REPLACE FUNCTION approve_binary_commission(p_commission_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only admin can approve
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'Admin privileges required';
  END IF;
  UPDATE commissions SET status = 'approved' WHERE id = p_commission_id AND type = 'binary_pool';
END;
$$;

CREATE OR REPLACE FUNCTION bulk_approve_binary_commissions(p_pool_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_count INTEGER;
BEGIN
  IF NOT is_admin() THEN RAISE EXCEPTION 'Admin privileges required'; END IF;
  UPDATE commissions SET status = 'approved'
  WHERE type = 'binary_pool'
    AND status = 'pending_admin'
    AND description LIKE 'Weekly binary pool payout for week %'
    AND created_at >= (SELECT week_start FROM weekly_pools WHERE id = p_pool_id)
    AND created_at <= (SELECT week_end FROM weekly_pools WHERE id = p_pool_id);
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

-- Payment processing: mark as paid if wallet exists, else recycle to next pool
CREATE OR REPLACE FUNCTION pay_binary_commission(p_commission_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_comm RECORD;
  v_wallet TEXT;
  v_next_pool UUID;
BEGIN
  IF NOT is_admin() THEN RAISE EXCEPTION 'Admin privileges required'; END IF;
  SELECT c.*, p.wallet_address INTO v_comm
  FROM commissions c JOIN profiles p ON p.id = c.user_id
  WHERE c.id = p_commission_id AND c.type = 'binary_pool' AND c.status = 'approved';

  IF NOT FOUND THEN RETURN; END IF;
  v_wallet := v_comm.wallet_address;
  IF v_wallet IS NULL OR LENGTH(TRIM(v_wallet)) = 0 THEN
    -- Recycle to next week's pool
    v_next_pool := ensure_weekly_pool((SELECT week_end FROM weekly_pools ORDER BY week_end DESC LIMIT 1) + INTERVAL '1 second');
    UPDATE weekly_pools SET recycled_in = recycled_in + v_comm.amount WHERE id = v_next_pool;
    UPDATE commissions SET status = 'recycled', paid_at = now(), description = COALESCE(description,'') || ' | Recycled: missing wallet address' WHERE id = p_commission_id;
  ELSE
    -- Mark as paid (actual transfer handled externally)
    UPDATE commissions SET status = 'paid', paid_at = now(), description = COALESCE(description,'') || ' | Paid to wallet' WHERE id = p_commission_id;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION bulk_pay_binary_commissions(p_pool_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_count INTEGER;
BEGIN
  IF NOT is_admin() THEN RAISE EXCEPTION 'Admin privileges required'; END IF;
  -- Pay all approved commissions for the given pool window
  UPDATE commissions c SET status = CASE WHEN p.wallet_address IS NULL OR LENGTH(TRIM(p.wallet_address)) = 0 THEN 'recycled' ELSE 'paid' END,
                         paid_at = now(),
                         description = COALESCE(c.description,'') || CASE WHEN p.wallet_address IS NULL OR LENGTH(TRIM(p.wallet_address)) = 0 THEN ' | Recycled: missing wallet address' ELSE ' | Paid to wallet' END
  FROM profiles p
  WHERE c.user_id = p.id
    AND c.type = 'binary_pool'
    AND c.status = 'approved'
    AND c.created_at >= (SELECT week_start FROM weekly_pools WHERE id = p_pool_id)
    AND c.created_at <= (SELECT week_end FROM weekly_pools WHERE id = p_pool_id);
  GET DIAGNOSTICS v_count = ROW_COUNT;

  -- Add recycled amounts to next pool
  WITH recycled AS (
    SELECT SUM(c.amount) AS amt
    FROM commissions c
    WHERE c.type = 'binary_pool' AND c.status = 'recycled'
      AND c.created_at >= (SELECT week_start FROM weekly_pools WHERE id = p_pool_id)
      AND c.created_at <= (SELECT week_end FROM weekly_pools WHERE id = p_pool_id)
  )
  UPDATE weekly_pools wp SET recycled_in = recycled_in + COALESCE((SELECT amt FROM recycled),0)
  WHERE wp.id = ensure_weekly_pool((SELECT week_end FROM weekly_pools WHERE id = p_pool_id) + INTERVAL '1 second');

  RETURN v_count;
END;
$$;

-- Hook pool allocation into the existing order trigger
CREATE OR REPLACE FUNCTION trigger_calculate_commissions()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only when payment completed
  IF NEW.payment_status = 'completed' AND (OLD.payment_status IS NULL OR OLD.payment_status != 'completed') THEN
    -- Direct referral commission
    PERFORM calculate_direct_referral_commission(NEW.id);
    -- Weekly pool allocation (25% for orders >= $50)
    PERFORM allocate_order_to_pool(NEW.id);
  END IF;
  RETURN NEW;
END;
$$;

-- Grants (authenticated can view pools via admin UI; functions are security definer and admin-gated where needed)
GRANT SELECT ON weekly_pools TO authenticated;
GRANT SELECT ON weekly_pool_contributions TO authenticated;
GRANT SELECT ON weekly_user_pv TO authenticated;
GRANT EXECUTE ON FUNCTION get_week_window(TIMESTAMPTZ) TO authenticated;
GRANT EXECUTE ON FUNCTION ensure_weekly_pool(TIMESTAMPTZ) TO authenticated;
GRANT EXECUTE ON FUNCTION compute_weekly_user_pv(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION distribute_weekly_binary_pool(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION approve_binary_commission(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION bulk_approve_binary_commissions(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION pay_binary_commission(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION bulk_pay_binary_commissions(UUID) TO authenticated;

-- Optional: schedule weekly distribution just after the week ends (Friday 00:05)
-- Note: Requires pg_cron and appropriate permissions
SELECT cron.schedule(
  'weekly_binary_pool_finalize',
  '5 0 * * FRI',
  $$
  SELECT distribute_weekly_binary_pool(ensure_weekly_pool(now() - INTERVAL '1 day'));
  $$
);
