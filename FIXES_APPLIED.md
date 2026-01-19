# Console Error Fixes - Admin Panel

## Issues Fixed

### 1. Select Component Empty String Error
**Problem:** The Select component was rendering items with empty string values when users didn't have valid referral_ids.

**Root Cause:** In the `availableSponsors` array, some users might not have referral_ids set (either null or empty string). The Select component requires non-empty values.

**Fixes Applied:**
- Modified `openEditDialog()` to filter `availableSponsors` array to ONLY include users with valid, non-empty referral_ids
- Updated SelectItem rendering to conditionally render only if `user.referral_id` exists (no fallback to empty string)
- Both Referrer and Binary Placement Select dropdowns now use this filtering

**File Changed:** `src/components/admin/AdminUsers.tsx`
- Line ~383: Added filter condition `p.referral_id && p.referral_id.trim() !== ""`
- Lines ~972, ~1000: Changed from `value={user.referral_id || ""}` to conditional rendering with null check

### 2. Referrals Table 404 Error
**Problem:** RLS (Row-Level Security) policies on the referrals table were incorrectly checking for a non-existent `user_id` column in the profiles table.

**Root Cause:** The profiles table uses `id` as the primary key (UUID), not `user_id`. The RLS policy logic was:
```sql
auth.uid()::text = (SELECT user_id::text FROM profiles WHERE id = referred_user_id)
```
This query returns NULL (user_id doesn't exist), causing the RLS policy to fail.

**Fix Applied:** Created new migration `20260120120000_fix_referrals_rls_policies.sql` that:
- Drops incorrect RLS policies
- Recreates policies with correct logic:
  - `auth.uid() = referred_user_id` (instead of checking non-existent user_id column)
  - `auth.uid() = referrer_id` (same fix)
  - Admin check remains unchanged: `EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin')`

**File Created:** `supabase/migrations/20260120120000_fix_referrals_rls_policies.sql`

### 3. Added Graceful Error Handling
**Improvement:** Modified the referrals fetch in `fetchUsers()` to gracefully handle errors with console warnings instead of throwing exceptions.

**File Changed:** `src/components/admin/AdminUsers.tsx` (lines ~135-147)
- Added error logging: `console.warn("Warning: Could not fetch referrals:", referralsError)`
- Admin panel will still work even if referrals table fetch fails

## Deployment Steps

1. **Apply Migration:** The migration file `supabase\migrations\20260120120000_fix_referrals_rls_policies.sql` will automatically apply when you run Supabase migrations.

2. **Code Changes:** The TypeScript changes in AdminUsers.tsx are already applied.

3. **Test:** 
   - Load Admin Panel
   - Click "Edit" on any user
   - Verify no Select component errors appear
   - Verify referrals data loads (check console for warnings)

## Expected Results After Fix

- ✅ No more "A <Select.Item /> must have a value prop that is not an empty string" error
- ✅ No more 404 errors on referrals table fetch
- ✅ All available sponsors displayed correctly in Edit Dialog
- ✅ Admin can edit referrer and binary placement without errors
- ✅ Real-time data updates continue to work

## Files Modified/Created

1. `src/components/admin/AdminUsers.tsx` - Filter and safely render sponsors
2. `supabase/migrations/20260120120000_fix_referrals_rls_policies.sql` - Fix RLS policies

## Additional Notes

If you continue to see 404 errors after applying the migration, it may indicate:
1. The migration hasn't been applied to Supabase yet
2. The logged-in user is not an admin (check user_roles table)
3. The user's auth session is expired

Check browser console for any remaining error messages for further debugging.
