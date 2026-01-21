import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.VITE_SUPABASE_URL || "";
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || "";

if (!supabaseUrl || !supabaseAnonKey) {
  console.error("Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function checkReferralIds() {
  console.log("Checking referral IDs in profiles...\n");

  try {
    // Get total count
    const { count: totalCount, error: totalError } = await supabase
      .from("profiles")
      .select("*", { count: "exact", head: true });

    if (totalError) throw totalError;
    console.log(`✓ Total profiles: ${totalCount}`);

    // Get missing/blank referral IDs
    const { data: missing, error: missingError } = await supabase
      .from("profiles")
      .select("id, referral_id")
      .or('referral_id.is.null,referral_id.eq."""');

    if (missingError) throw missingError;
    console.log(`✓ Profiles missing referral_id: ${missing?.length || 0}`);

    if (missing && missing.length > 0) {
      console.log("  Sample missing IDs:", missing.slice(0, 3));
    }

    // Check for duplicates (simplified client-side)
    const { data: all, error: allError } = await supabase
      .from("profiles")
      .select("referral_id");

    if (allError) throw allError;

    const referralMap: Record<string, number> = {};
    all?.forEach((p) => {
      if (p.referral_id) {
        referralMap[p.referral_id] = (referralMap[p.referral_id] || 0) + 1;
      }
    });

    const duplicates = Object.entries(referralMap).filter(([_, count]) => count > 1);
    console.log(`✓ Duplicate referral_ids: ${duplicates.length}`);

    if (duplicates.length > 0) {
      console.log("  Duplicates (referral_id -> count):");
      duplicates.slice(0, 5).forEach(([ref, count]) => {
        console.log(`    ${ref}: ${count} profiles`);
      });
    }

    console.log("\n✓ Backfill verification complete!");
  } catch (error) {
    console.error("Error checking referral IDs:", error);
    process.exit(1);
  }
}

checkReferralIds();
