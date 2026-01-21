import { useEffect, useState } from "react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import type { Tables } from "@/integrations/supabase/types";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Star, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";

type ReferralRow = Tables<"referrals">;
type ProfileRow = Tables<"profiles">;
type PlacementRow = Tables<"placements">;

export default function Referrals() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [referrals, setReferrals] = useState<ReferralRow[]>([]);
  const [profilesById, setProfilesById] = useState<Record<string, ProfileRow>>({});
  const [placementsByUserId, setPlacementsByUserId] = useState<Record<string, PlacementRow>>({});
  const [placingUserId, setPlacingUserId] = useState<string | null>(null);
  const [myProfileId, setMyProfileId] = useState<string | null>(null);

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

      setMyProfileId(myProfile.id);

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

        const { data: placements, error: placementsError } = await supabase
          .from("placements")
          .select("user_id, position, status, upline_id")
          .in("user_id", referredIds);

        if (!profilesError && referredProfiles) {
          const map: Record<string, ProfileRow> = {};
          for (const p of referredProfiles) {
            map[p.id] = p as ProfileRow;
          }
          setProfilesById(map);
        }

        if (!placementsError && placements) {
          const placementsMap: Record<string, PlacementRow> = {};
          
          // Calculate placement side relative to referrer for each user
          for (const pl of placements) {
            // Call the database function to get the correct side relative to referrer
            const { data: sideData, error: sideError } = await supabase
              .rpc('get_placement_side_relative_to_referrer', {
                p_user_id: pl.user_id
              });
            
            if (!sideError && sideData) {
              // Override the position with the calculated side relative to referrer
              placementsMap[pl.user_id] = { 
                ...pl, 
                position: sideData 
              } as PlacementRow;
            } else {
              placementsMap[pl.user_id] = pl as PlacementRow;
            }
          }
          
          setPlacementsByUserId(placementsMap);
          console.log('Loaded placements with referrer-relative positions:', placementsMap);
        } else {
          setPlacementsByUserId({});
          if (placementsError) {
            console.error('Placements fetch error:', placementsError);
          }
        }
      } else {
        setProfilesById({});
        setPlacementsByUserId({});
      }

      setLoading(false);
    };

    run();

    // Real-time subscription for new referrals
    if (user && myProfileId) {
      const referralsChannel = supabase
        .channel('new-referrals-notification')
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'referrals',
            filter: `referrer_id=eq.${myProfileId}`
          },
          async (payload) => {
            console.log('New referral detected:', payload);
            
            // Fetch the new user's email
            const { data: newUserProfile } = await supabase
              .from('profiles')
              .select('email, referral_id')
              .eq('id', payload.new.referred_user_id)
              .single();
            
            toast({
              title: "🎉 New Referral!",
              description: `${newUserProfile?.email || 'Someone'} just signed up with your referral code. Remember to place them in your binary structure!`,
              duration: 8000,
            });
            
            // Reload data to show the new referral
            run();
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(referralsChannel);
      };
    }
  }, [user, myProfileId, toast]);

  const handlePlaceUser = async (userId: string, strategy: string) => {
    if (!myProfileId) {
      toast({
        title: "Error",
        description: "Could not determine your profile ID",
        variant: "destructive",
      });
      return;
    }

    setPlacingUserId(userId);
    try {
      console.log('Placing user:', JSON.stringify({ userId, myProfileId, strategy }, null, 2));
      
      const { data, error } = await supabase.rpc('place_user_in_binary_tree', {
        user_profile_id: userId,
        referrer_profile_id: myProfileId,
        placement_strategy: strategy
      });

      console.log('Placement result:', JSON.stringify({ data, error }, null, 2));

      if (error) {
        console.error('Placement error details:', JSON.stringify({
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code
        }, null, 2));
        throw error;
      }

      toast({
        title: "Success",
        description: `User placed successfully using ${strategy} strategy`,
      });

      // Reload data to reflect the new placement
      setTimeout(() => window.location.reload(), 1000);
    } catch (err: unknown) {
      console.error('Full error object:', JSON.stringify(err, null, 2));
      const errorObj = err as { message?: string; hint?: string; details?: string; code?: string };
      const errorMessage = errorObj.message || errorObj.hint || errorObj.details || "Could not place user";
      
      // If user is already placed, reload the page to sync UI
      if (errorObj.message?.includes("already has a placement")) {
        toast({
          title: "User Already Placed",
          description: "This user is already placed in the binary tree. Refreshing data...",
          variant: "default",
        });
        setTimeout(() => window.location.reload(), 1500);
      } else {
        toast({
          title: "Placement failed",
          description: errorMessage,
          variant: "destructive",
        });
      }
    } finally {
      setPlacingUserId(null);
    }
  };

  return (
    <DashboardLayout>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-3">
                <CardTitle>My Referrals</CardTitle>
                {referrals.length > 0 && (
                  <Badge variant="secondary" className="flex items-center gap-1">
                    <Users className="w-3 h-3" />
                    {referrals.length} Total
                  </Badge>
                )}
                {referrals.filter(r => {
                  const placement = placementsByUserId[r.referred_user_id];
                  const hasValidPlacement = placement && placement.position && placement.position !== '' && placement.position !== '—';
                  return !hasValidPlacement;
                }).length > 0 && (
                  <Badge variant="destructive" className="flex items-center gap-1 animate-pulse">
                    <Star className="w-3 h-3 fill-current" />
                    {referrals.filter(r => {
                      const placement = placementsByUserId[r.referred_user_id];
                      const hasValidPlacement = placement && placement.position && placement.position !== '' && placement.position !== '—';
                      return !hasValidPlacement;
                    }).length} Unplaced
                  </Badge>
                )}
              </div>
              <CardDescription>
                Users who signed up using your referral code.
              </CardDescription>
            </div>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => window.location.reload()}
              disabled={loading}
            >
              Refresh
            </Button>
          </div>
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
                  <TableHead>Placement</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {referrals.map((r) => {
                  const prof = profilesById[r.referred_user_id];
                  const placement = placementsByUserId[r.referred_user_id];
                  // A user is only considered "placed" if they have a placement record AND a valid position
                  // If position is empty or "—", they should be allowed to be placed
                  const hasValidPlacement = placement && placement.position && placement.position !== '' && placement.position !== '—';
                  const isPlaced = hasValidPlacement;
                  const isPlacing = placingUserId === r.referred_user_id;

                  return (
                    <TableRow key={r.id} className={!isPlaced ? "bg-yellow-50/50 dark:bg-yellow-950/20" : ""}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {!isPlaced && <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />}
                          <span>{prof?.email ?? "—"}</span>
                        </div>
                      </TableCell>
                      <TableCell>{prof?.referral_id ?? "—"}</TableCell>
                      <TableCell>{new Date(r.created_at).toLocaleString()}</TableCell>
                      <TableCell className="capitalize">{placement?.position ?? "—"}</TableCell>
                      <TableCell>{prof?.status ?? "active"}</TableCell>
                      <TableCell>
                        {isPlaced ? (
                          <span className="text-sm text-muted-foreground">Placed</span>
                        ) : (
                          <Select 
                            disabled={isPlacing}
                            onValueChange={(value) => handlePlaceUser(r.referred_user_id, value)}
                          >
                            <SelectTrigger className="w-[150px]">
                              <SelectValue placeholder={isPlacing ? "Placing..." : "Select placement"} />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="left">Place Left</SelectItem>
                              <SelectItem value="right">Place Right</SelectItem>
                              <SelectItem value="auto">Auto Placement</SelectItem>
                            </SelectContent>
                          </Select>
                        )}
                      </TableCell>
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
