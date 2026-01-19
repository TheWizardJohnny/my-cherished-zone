-- Debug: Check if placements records exist
-- Run this query to see what placements have been created

SELECT 
  p.id,
  p.user_id,
  pr_user.referral_id as user_referral_id,
  pr_user.email as user_email,
  p.upline_id,
  pr_upline.referral_id as upline_referral_id,
  pr_upline.email as upline_email,
  p.position,
  p.status,
  p.created_at
FROM placements p
LEFT JOIN profiles pr_user ON p.user_id = pr_user.id
LEFT JOIN profiles pr_upline ON p.upline_id = pr_upline.id
ORDER BY p.created_at DESC;
