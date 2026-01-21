# Auto-Placement After 48 Hours

This system automatically places unplaced referrals in the binary tree after 48 hours using the "auto" placement strategy.

## How It Works

1. **Database Function**: `auto_place_overdue_referrals()` checks for referrals older than 48 hours without placement
2. **Edge Function**: Can be called via HTTP to trigger the auto-placement
3. **Logging**: All auto-placements are logged in `auto_placement_logs` table

## Setup Options

### Option 1: Supabase Cron (Recommended)

Set up a cron job in your Supabase project to run every hour:

1. Go to Supabase Dashboard → Database → Extensions
2. Enable `pg_cron` extension
3. Run this SQL to schedule the job:

```sql
-- Run auto-placement check every hour
SELECT cron.schedule(
  'auto-place-overdue-referrals',
  '0 * * * *', -- Every hour at minute 0
  $$
  SELECT public.auto_place_overdue_referrals();
  $$
);
```

### Option 2: External Cron Service (e.g., GitHub Actions, Vercel Cron)

Call the edge function periodically:

```bash
curl -X POST \
  https://YOUR_PROJECT.supabase.co/functions/v1/auto-place-referrals \
  -H "Authorization: Bearer YOUR_ANON_KEY"
```

**GitHub Actions Example** (`.github/workflows/auto-place.yml`):

```yaml
name: Auto Place Referrals
on:
  schedule:
    - cron: '0 * * * *'  # Every hour
  workflow_dispatch:

jobs:
  auto-place:
    runs-on: ubuntu-latest
    steps:
      - name: Trigger auto-placement
        run: |
          curl -X POST \
            https://YOUR_PROJECT.supabase.co/functions/v1/auto-place-referrals \
            -H "Authorization: Bearer ${{ secrets.SUPABASE_ANON_KEY }}"
```

### Option 3: Manual Trigger

For testing or manual execution:

```sql
-- Check and place overdue referrals
SELECT * FROM public.auto_place_overdue_referrals();
```

## Monitoring

View auto-placement logs:

```sql
SELECT 
  apl.placed_at,
  apl.hours_overdue,
  apl.placement_position,
  p.email as user_email,
  ref.email as referrer_email
FROM auto_placement_logs apl
LEFT JOIN profiles p ON p.id = apl.user_id
LEFT JOIN profiles ref ON ref.id = apl.referrer_id
ORDER BY apl.placed_at DESC
LIMIT 50;
```

## Database Migration

The migration `20260121160000_auto_place_after_48_hours.sql` creates:
- `auto_place_overdue_referrals()` function
- `auto_placement_logs` table with RLS
- Necessary indexes for performance
