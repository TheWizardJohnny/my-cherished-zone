import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { StatsCard } from "@/components/dashboard/StatsCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import {
  Wallet,
  Users,
  TrendingUp,
  Trophy,
  ArrowRight,
  Bell,
  ChevronRight,
  Loader2,
  Copy,
  Share2,
} from "lucide-react";

interface Profile {
  id: string;
  full_name: string | null;
  rank: string;
  total_left_volume: number;
  total_right_volume: number;
  personal_volume: number;
  referral_id: string | null;
}

interface Announcement {
  id: string;
  title: string;
  content: string;
  priority: string;
  created_at: string;
}

interface Commission {
  id: string;
  type: string;
  amount: number;
  status: string;
  created_at: string;
}

export default function Dashboard() {
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [recentCommissions, setRecentCommissions] = useState<Commission[]>([]);
  const [totalEarnings, setTotalEarnings] = useState(0);
  const [loading, setLoading] = useState(true);

  const copyReferralLink = () => {
    if (!profile?.referral_id) return;
    const referralLink = `${window.location.origin}/auth?ref=${profile.referral_id}`;
    navigator.clipboard.writeText(referralLink);
    toast({
      title: "Copied!",
      description: "Referral link copied to clipboard.",
    });
  };

  const copyReferralId = () => {
    if (!profile?.referral_id) return;
    navigator.clipboard.writeText(profile.referral_id);
    toast({
      title: "Copied!",
      description: "Referral ID copied to clipboard.",
    });
  };

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (user) {
      fetchData();
      
      // Set up real-time subscription for announcements
      const announcementsChannel = supabase
        .channel('announcements-changes')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'announcements',
            filter: 'active=eq.true'
          },
          (payload) => {
            console.log('Announcement changed:', payload);
            
            if (payload.eventType === 'INSERT') {
              setAnnouncements((prev) => [payload.new as Announcement, ...prev].slice(0, 3));
            } else if (payload.eventType === 'UPDATE') {
              setAnnouncements((prev) =>
                prev.map((a) => (a.id === payload.new.id ? payload.new as Announcement : a))
              );
            } else if (payload.eventType === 'DELETE') {
              setAnnouncements((prev) => prev.filter((a) => a.id !== payload.old.id));
            }
          }
        )
        .subscribe();

      // Set up real-time subscription for profile changes
      const profileChannel = supabase
        .channel('dashboard-profile-changes')
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'profiles',
            filter: `user_id=eq.${user.id}`
          },
          (payload) => {
            console.log('Profile changed:', payload);
            // Update profile with new data (especially referral_id and sponsor_id)
            setProfile(payload.new as Profile);
          }
        )
        .subscribe();

      // Cleanup subscriptions on unmount
      return () => {
        supabase.removeChannel(announcementsChannel);
        supabase.removeChannel(profileChannel);
      };
    }
  }, [user]);

  const fetchData = async () => {
    try {
      // Fetch profile
      const { data: profileData } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", user?.id)
        .single();

      if (profileData) {
        setProfile(profileData);

        // Fetch commissions for this profile
        const { data: commissionsData } = await supabase
          .from("commissions")
          .select("*")
          .eq("user_id", profileData.id)
          .order("created_at", { ascending: false })
          .limit(5);

        if (commissionsData) {
          setRecentCommissions(commissionsData);
          const total = commissionsData
            .filter((c) => c.status === "paid" || c.status === "approved")
            .reduce((sum, c) => sum + Number(c.amount), 0);
          setTotalEarnings(total);
        }
      }

      // Fetch announcements
      const { data: announcementsData } = await supabase
        .from("announcements")
        .select("*")
        .eq("active", true)
        .order("created_at", { ascending: false })
        .limit(3);

      if (announcementsData) {
        setAnnouncements(announcementsData);
      }
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(amount);
  };

  const getCommissionTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      retail_profit: "Retail Profit",
      fast_start: "Fast Start",
      binary_matching: "Binary Match",
      leadership_matching: "Leadership",
      rank_pool: "Rank Pool",
    };
    return labels[type] || type;
  };

  const getRankColor = (rank: string) => {
    const colors: Record<string, string> = {
      member: "bg-muted text-muted-foreground",
      bronze: "bg-amber-900/20 text-amber-500",
      silver: "bg-slate-400/20 text-slate-300",
      gold: "bg-yellow-500/20 text-yellow-500",
      platinum: "bg-cyan-400/20 text-cyan-400",
      diamond: "bg-purple-400/20 text-purple-400",
      crown: "bg-primary/20 text-primary",
    };
    return colors[rank] || colors.member;
  };

  if (authLoading || loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Welcome Section */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-foreground">
              Welcome back{profile?.full_name ? `, ${profile.full_name}` : ""}!
            </h1>
            <p className="text-muted-foreground">
              Here's what's happening with your network today.
            </p>
          </div>
          <Badge className={getRankColor(profile?.rank || "member")}>
            <Trophy className="w-3 h-3 mr-1" />
            {profile?.rank?.charAt(0).toUpperCase() + (profile?.rank?.slice(1) || "")} Rank
          </Badge>
        </div>

        {/* Referral Section */}
        {profile?.referral_id && (
          <Card className="bg-gradient-to-r from-primary/10 via-accent/10 to-primary/10 border-primary/20">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Share2 className="w-5 h-5 text-primary" />
                Your Referral Code
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-col sm:flex-row gap-3">
                {/* Referral ID */}
                <div className="flex-1">
                  <p className="text-xs text-muted-foreground mb-2">Referral ID</p>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 px-4 py-3 bg-background/50 rounded-lg border border-border text-lg font-mono text-primary">
                      {profile.referral_id}
                    </code>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={copyReferralId}
                      className="shrink-0"
                    >
                      <Copy className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </div>
              
              {/* Referral Link */}
              <div>
                <p className="text-xs text-muted-foreground mb-2">Referral Link</p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 px-4 py-3 bg-background/50 rounded-lg border border-border text-sm font-mono overflow-x-auto">
                    {window.location.origin}/auth?ref={profile.referral_id}
                  </code>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={copyReferralLink}
                    className="shrink-0"
                  >
                    <Copy className="w-4 h-4" />
                  </Button>
                </div>
              </div>
              
              <p className="text-xs text-muted-foreground">
                Share your referral link or ID with others to earn commissions when they join and make purchases.
              </p>
            </CardContent>
          </Card>
        )}

        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatsCard
            title="Total Earnings"
            value={formatCurrency(totalEarnings)}
            change="+12% from last week"
            changeType="positive"
            icon={<Wallet className="w-6 h-6 text-primary" />}
          />
          <StatsCard
            title="Left Volume"
            value={formatCurrency(Number(profile?.total_left_volume || 0))}
            icon={<TrendingUp className="w-6 h-6 text-accent" />}
          />
          <StatsCard
            title="Right Volume"
            value={formatCurrency(Number(profile?.total_right_volume || 0))}
            icon={<TrendingUp className="w-6 h-6 text-success" />}
          />
          <StatsCard
            title="Personal Volume"
            value={formatCurrency(Number(profile?.personal_volume || 0))}
            icon={<Users className="w-6 h-6 text-warning" />}
          />
        </div>

        {/* Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Recent Commissions */}
          <Card className="bg-card border-border/50">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-lg font-semibold">Recent Commissions</CardTitle>
              <Button
                variant="ghost"
                size="sm"
                className="text-muted-foreground hover:text-foreground"
                onClick={() => navigate("/dashboard/commissions")}
              >
                View All
                <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </CardHeader>
            <CardContent>
              {recentCommissions.length > 0 ? (
                <div className="space-y-3">
                  {recentCommissions.map((commission) => (
                    <div
                      key={commission.id}
                      className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                    >
                      <div>
                        <p className="font-medium text-sm text-foreground">
                          {getCommissionTypeLabel(commission.type)}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(commission.created_at).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-primary">
                          {formatCurrency(Number(commission.amount))}
                        </p>
                        <Badge
                          variant="outline"
                          className={
                            commission.status === "paid"
                              ? "border-success text-success"
                              : "border-warning text-warning"
                          }
                        >
                          {commission.status}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <TrendingUp className="w-10 h-10 mx-auto mb-2 opacity-50" />
                  <p>No commissions yet</p>
                  <p className="text-sm">Start building your network to earn!</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Announcements */}
          <Card className="bg-card border-border/50">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-lg font-semibold">Announcements</CardTitle>
              <Bell className="w-5 h-5 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {announcements.length > 0 ? (
                <div className="space-y-3">
                  {announcements.map((announcement) => (
                    <div
                      key={announcement.id}
                      className="p-3 rounded-lg bg-muted/50 border-l-2 border-primary"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="font-medium text-sm text-foreground">
                          {announcement.title}
                        </p>
                        {announcement.priority === "high" && (
                          <Badge variant="destructive" className="text-xs">
                            Important
                          </Badge>
                        )}
                        {announcement.priority === "normal" && (
                          <Badge variant="secondary" className="text-xs">
                            Attention
                          </Badge>
                        )}
                        {announcement.priority === "low" && (
                          <Badge variant="outline" className="text-xs">
                            News
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                        {announcement.content}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Bell className="w-10 h-10 mx-auto mb-2 opacity-50" />
                  <p>No announcements</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions */}
        <Card className="bg-gradient-to-r from-primary/10 to-accent/10 border-primary/20">
          <CardContent className="p-6">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <h3 className="text-lg font-semibold text-foreground">
                  Ready to grow your network?
                </h3>
                <p className="text-muted-foreground text-sm">
                  Invite new members and start earning commissions today.
                </p>
              </div>
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  onClick={() => navigate("/dashboard/genealogy")}
                >
                  View Genealogy
                </Button>
                <Button
                  className="gradient-primary text-primary-foreground"
                  onClick={() => navigate("/dashboard/shop")}
                >
                  Browse Products
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
