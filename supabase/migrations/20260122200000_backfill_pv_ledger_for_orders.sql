-- Migration: Backfill PV ledger for existing orders
-- Date: 2026-01-22

INSERT INTO public.pv_ledger (
  user_id,
  order_id,
  amount,
  leg_side,
  event_type,
  note,
  created_at
)
SELECT
  user_id,
  id AS order_id,
  pv_earned,
  'personal' AS leg_side,
  'order' AS event_type,
  'PV from product purchase (backfill)' AS note,
  created_at
FROM public.orders
WHERE pv_earned > 0
  AND id NOT IN (SELECT order_id FROM public.pv_ledger WHERE order_id IS NOT NULL);
