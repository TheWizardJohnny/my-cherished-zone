#!/usr/bin/env python3
import psycopg2
import os
from psycopg2.extras import RealDictCursor

# Use connection string from environment or hardcode
# Project: akgnohicwkopgdnuijey
connection_string = "postgresql://postgres:[PASSWORD]@aws-0-us-east-1.pooler.supabase.com:6543/postgres?sslmode=require"

query = """
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
    COUNT(*) * 19::numeric AS total_direct_commission
  FROM sim_orders
  WHERE referrer_id IS NOT NULL
  GROUP BY referrer_id
),
pool_calc AS (
  SELECT
    COUNT(*) AS simulated_orders,
    COUNT(*) * 47.5::numeric AS pool_contributions
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
"""

try:
    conn = psycopg2.connect(connection_string)
    cur = conn.cursor(cursor_factory=RealDictCursor)
    
    print("\n" + "="*100)
    print("DIRECT REFERRAL BONUS SIMULATION - $190 per User")
    print("="*100)
    
    cur.execute(query)
    results = cur.fetchall()
    
    direct_commissions = []
    pool_summary = None
    
    for row in results:
        if row['section'] == 'DIRECT_COMMISSIONS':
            direct_commissions.append(row)
        elif row['section'] == 'POOL_SUMMARY':
            pool_summary = row
    
    # Print Direct Commissions
    print("\n📊 DIRECT REFERRAL COMMISSIONS (10% of $190 = $19 per order):")
    print("-" * 100)
    if direct_commissions:
        print(f"{'Name':<30} {'Email':<35} {'Orders from Downline':<20} {'Commission Earned':<15}")
        print("-" * 100)
        total_direct = 0
        for comm in direct_commissions:
            name = comm['full_name'] or 'N/A'
            email = comm['email'] or 'N/A'
            orders = comm['orders_from_downline']
            amount = float(comm['direct_commission'])
            total_direct += amount
            print(f"{name:<30} {email:<35} {orders:<20} ${amount:>13,.2f}")
        print("-" * 100)
        print(f"{'TOTAL DIRECT COMMISSIONS PAID':<85} ${total_direct:>13,.2f}")
    else:
        print("No direct commissions (no referral relationships found)")
    
    # Print Pool Summary
    print("\n\n💰 WEEKLY BINARY POOL SUMMARY (25% of $190 = $47.50 per order):")
    print("-" * 100)
    if pool_summary:
        simulated_orders = int(pool_summary['simulated_orders'])
        pool_value = float(pool_summary['pool_contributions'])
        print(f"Total Simulated Orders: {simulated_orders}")
        print(f"Order Value (each):    $190.00")
        print(f"Pool Contribution %:   25%")
        print(f"Pool Contribution (ea): $47.50")
        print(f"\n{'TOTAL POOL VALUE:':<50} ${pool_value:>13,.2f}")
    
    print("\n" + "="*100)
    print("SIMULATION COMPLETE")
    print("="*100 + "\n")
    
    cur.close()
    conn.close()
    
except Exception as e:
    print(f"Error: {e}")
    import traceback
    traceback.print_exc()
