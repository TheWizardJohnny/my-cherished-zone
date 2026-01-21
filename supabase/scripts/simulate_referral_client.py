#!/usr/bin/env python3
"""
Simulation: Direct Referral Bonus for $190 products
Uses Supabase client to execute queries
"""
import os
from supabase import create_client, Client

# Read env vars
SUPABASE_URL = "https://akgnohicwkopgdnuijey.supabase.co"
SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFrZ25vaGljd2tvcGdkbnVpamV5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg3NDcwMjAsImV4cCI6MjA4NDMyMzAyMH0.4QuC2j8wNR32EPiNrzjNAXF_dgaGi6wMQkTVHam_Gw8"

supabase: Client = create_client(SUPABASE_URL, SUPABASE_ANON_KEY)

# Query to get referral network
print("\n" + "="*100)
print("DIRECT REFERRAL BONUS SIMULATION - $190 per User")
print("="*100)

try:
    # Get all profiles (potential buyers)
    profiles_response = supabase.table("profiles").select("id, full_name, email").execute()
    profiles = {p['id']: p for p in profiles_response.data}
    print(f"\n✓ Found {len(profiles)} profiles")
    
    # Get all referral relationships
    referrals_response = supabase.table("referrals").select("referred_user_id, referrer_id").execute()
    referrals = referrals_response.data
    print(f"✓ Found {len(referrals)} referral relationships")
    
    # Simulate: each referred user makes 1x $190 order
    direct_commissions = {}  # referrer_id -> {name, email, count, total}
    simulated_order_count = 0
    
    for ref in referrals:
        referred_user_id = ref['referred_user_id']
        referrer_id = ref['referrer_id']
        
        if referrer_id:  # Has a referrer
            simulated_order_count += 1
            commission_per_order = 19.0  # 10% of $190
            
            if referrer_id not in direct_commissions:
                referrer = profiles.get(referrer_id, {})
                direct_commissions[referrer_id] = {
                    'name': referrer.get('full_name', 'N/A'),
                    'email': referrer.get('email', 'N/A'),
                    'orders': 0,
                    'total': 0.0
                }
            
            direct_commissions[referrer_id]['orders'] += 1
            direct_commissions[referrer_id]['total'] += commission_per_order
    
    # Print Results
    print("\n📊 DIRECT REFERRAL COMMISSIONS (10% of $190 = $19 per order):")
    print("-" * 100)
    
    if direct_commissions:
        print(f"{'Name':<30} {'Email':<35} {'Orders from Downline':<20} {'Commission Earned':<15}")
        print("-" * 100)
        
        total_commission = 0
        sorted_commissions = sorted(
            direct_commissions.items(),
            key=lambda x: x[1]['total'],
            reverse=True
        )
        
        for referrer_id, comm_data in sorted_commissions:
            name = comm_data['name'][:29] if comm_data['name'] else 'N/A'
            email = comm_data['email'][:34] if comm_data['email'] else 'N/A'
            orders = comm_data['orders']
            amount = comm_data['total']
            total_commission += amount
            print(f"{name:<30} {email:<35} {orders:<20} ${amount:>13,.2f}")
        
        print("-" * 100)
        print(f"{'TOTAL DIRECT COMMISSIONS PAID':<85} ${total_commission:>13,.2f}")
    else:
        print("No direct commissions (no referral relationships found)")
    
    # Pool Summary
    print("\n\n💰 WEEKLY BINARY POOL SUMMARY (25% of $190 = $47.50 per order):")
    print("-" * 100)
    pool_contribution_per_order = 47.50  # 25% of $190
    total_pool_value = simulated_order_count * pool_contribution_per_order
    
    print(f"Total Simulated Orders: {simulated_order_count}")
    print(f"Order Value (each):    $190.00")
    print(f"Pool Contribution %:   25%")
    print(f"Pool Contribution (ea): ${pool_contribution_per_order:.2f}")
    print(f"\n{'TOTAL POOL VALUE:':<50} ${total_pool_value:>13,.2f}")
    
    print("\n" + "="*100)
    print("SIMULATION COMPLETE")
    print("="*100 + "\n")
    
except Exception as e:
    print(f"Error: {e}")
    import traceback
    traceback.print_exc()
