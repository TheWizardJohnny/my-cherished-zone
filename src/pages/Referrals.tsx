import { useEffect, useState } from "react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import type { Tables } from "@/integrations/supabase/types";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type ReferralRow = Tables<"referrals">;
type ProfileRow = Tables<"profiles">;

export default function Referrals() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [referrals, setReferrals] = useState<ReferralRow[]>([]);
  const [profilesById, setProfilesById] = useState<Record<string, ProfileRow>>({});

  useEffect(() => {
    const run = async () => {
      if (!user) return;
      setLoading(true);
      setError(null);

      // Get current user's profile id (referrals table references profiles.id)
      const { data: myProfile, error: profileError } = await supabase
        .from("profiles")
        .select("id, referral_id, email")
        .eq("user_id", user.id)
        .single();

      if (profileError || !myProfile) {
        setError("Could not load your profile.");
        setLoading(false);
        return;
      }

      // Fetch referrals where you are the referrer
      const { data: myReferrals, error: referralsError } = await supabase
        .from("referrals")
        .select("id, created_at, referred_user_id, referrer_id")
        .eq("referrer_id", myProfile.id);

      if (referralsError) {
        setError("Could not load referrals.");
        setLoading(false);
        return;
      }

      setReferrals(myReferrals || []);

      // Fetch referred users' profiles to display email and referral code
      const referredIds = (myReferrals || []).map(r => r.referred_user_id);
      if (referredIds.length > 0) {
        const { data: referredProfiles, error: profilesError } = await supabase
          .from("profiles")
          .select("id, email, referral_id, status, created_at")
          .in("id", referredIds);

        if (!profilesError && referredProfiles) {
          const map: Record<string, ProfileRow> = {};
          for (const p of referredProfiles) {
            map[p.id] = p as ProfileRow;
          }
          setProfilesById(map);
        }
      } else {
        setProfilesById({});
      }

      setLoading(false);
    };

    run();
  }, [user]);

  return (
    <DashboardLayout>
      <Card>
        <CardHeader>
          <CardTitle>My Referrals</CardTitle>
          <CardDescription>
            Users who signed up using your referral code.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-muted-foreground">Loading…</div>
          ) : error ? (
            <div className="text-red-500 text-sm">{error}</div>
          ) : referrals.length === 0 ? (
            <div className="text-muted-foreground">No referrals yet.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead>Referral Code</TableHead>
                  <TableHead>Signup Date</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {referrals.map((r) => {
                  const prof = profilesById[r.referred_user_id];
                  return (
                    <TableRow key={r.id}>
                      <TableCell>{prof?.email ?? "—"}</TableCell>
                      <TableCell>{prof?.referral_id ?? "—"}</TableCell>
                      <TableCell>{new Date(r.created_at).toLocaleString()}</TableCell>
                      <TableCell>{prof?.status ?? "active"}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </DashboardLayout>
  );
}
