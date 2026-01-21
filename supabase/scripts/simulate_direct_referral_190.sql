-- Direct referral and pool simulation for one $190 completed order per existing user
WITH buyers AS (
  SELECT id AS buyer_id FROM profiles
),
ref_map AS (
  SELECT referred_user_id, referrer_id FROM referrals
),
sim_orders AS (
  SELECT
    b.buyer_id,
    rm.referrer_id,
    190::numeric AS order_amount
  FROM buyers b
  LEFT JOIN ref_map rm ON rm.referred_user_id = b.buyer_id
),
direct_commission AS (
  SELECT
    referrer_id AS user_id,
    COUNT(*) AS orders_from_downline,
    COUNT(*) * 19::numeric AS total_direct_commission  -- 10% of $190 = $19
  FROM sim_orders
  WHERE referrer_id IS NOT NULL
  GROUP BY referrer_id
),
pool_calc AS (
  SELECT
    COUNT(*) AS simulated_orders,
    COUNT(*) * 47.5::numeric AS pool_contributions  -- 25% of $190 = $47.50
  FROM sim_orders
)
SELECT
  'DIRECT_COMMISSIONS' AS section,
  p.full_name,
  p.email,
  dc.user_id::text,
  dc.orders_from_downline::text,
  dc.total_direct_commission::text AS direct_commission,
  NULL AS pool_value
FROM direct_commission dc
LEFT JOIN profiles p ON p.id = dc.user_id
UNION ALL
SELECT
  'POOL_SUMMARY' AS section,
  'Total Simulated Orders' AS full_name,
  NULL,
  NULL,
  pc.simulated_orders::text,
  NULL,
  pc.pool_contributions::text
FROM pool_calc pc
ORDER BY section DESC, total_direct_commission DESC NULLS LAST;
