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
  DollarSign,
  Target,
  Scale,
  AlertTriangle,
  CheckCircle2,
} from "lucide-react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  BarChart,
  Bar,
} from "recharts";
import { Progress } from "@/components/ui/progress";

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
  const [pendingCommissions, setPendingCommissions] = useState(0);
  const [directReferralsCount, setDirectReferralsCount] = useState(0);
  const [commissionsByType, setCommissionsByType] = useState<Record<string, number>>({});
  const [earningsData, setEarningsData] = useState<Array<{date: string; amount: number}>>([]);
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

      // Set up real-time subscription for new referrals
      const referralsChannel = supabase
        .channel('dashboard-new-referrals')
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'referrals'
          },
          async (payload) => {
            // Check if this referral is for the current user
            const { data: myProfile } = await supabase
              .from('profiles')
              .select('id')
              .eq('user_id', user.id)
              .single();

            if (myProfile && payload.new.referrer_id === myProfile.id) {
              console.log('New referral for current user:', payload);
              
              // Fetch the new user's email
              const { data: newUserProfile } = await supabase
                .from('profiles')
                .select('email, referral_id')
                .eq('id', payload.new.referred_user_id)
                .single();
              
              toast({
                title: "🎉 New Referral!",
                description: `${newUserProfile?.email || 'Someone'} just signed up with your referral code! Visit the Referrals page to place them in your binary structure.`,
                duration: 10000,
              });
            }
          }
        )
        .subscribe();

      // Cleanup subscriptions on unmount
      return () => {
        supabase.removeChannel(announcementsChannel);
        supabase.removeChannel(profileChannel);
        supabase.removeChannel(referralsChannel);
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

        // Fetch all commissions for analytics
        const { data: allCommissionsData } = await supabase
          .from("commissions")
          .select("*")
          .eq("user_id", profileData.id)
          .order("created_at", { ascending: false });

        if (allCommissionsData) {
          // Recent commissions for display
          setRecentCommissions(allCommissionsData.slice(0, 5));
          
          // Calculate total paid earnings
          const total = allCommissionsData
            .filter((c) => c.status === "paid" || c.status === "approved")
            .reduce((sum, c) => sum + Number(c.amount), 0);
          setTotalEarnings(total);
          
          // Calculate pending commissions
          const pending = allCommissionsData
            .filter((c) => c.status === "pending")
            .reduce((sum, c) => sum + Number(c.amount), 0);
          setPendingCommissions(pending);
          
          // Group by type
          const byType: Record<string, number> = {};
          allCommissionsData
            .filter((c) => c.status === "paid" || c.status === "approved")
            .forEach((c) => {
              const type = c.type || "other";
              byType[type] = (byType[type] || 0) + Number(c.amount);
            });
          setCommissionsByType(byType);
          
          // Earnings over last 30 days
          const thirtyDaysAgo = new Date();
          thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
          const recentPaidCommissions = allCommissionsData.filter(
            (c) => (c.status === "paid" || c.status === "approved") &&
                   new Date(c.created_at) >= thirtyDaysAgo
          );
          
          // Group by date
          const earningsByDate: Record<string, number> = {};
          recentPaidCommissions.forEach((c) => {
            const date = new Date(c.created_at).toISOString().slice(0, 10);
            earningsByDate[date] = (earningsByDate[date] || 0) + Number(c.amount);
          });
          
          const sortedEarnings = Object.entries(earningsByDate)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([date, amount]) => ({ date, amount }));
          setEarningsData(sortedEarnings);
        }
        
        // Fetch direct referrals count
        const { data: referralsData, count } = await supabase
          .from("referrals")
          .select("*", { count: "exact", head: false })
          .eq("referrer_id", profileData.id);
        
        setDirectReferralsCount(count || 0);
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

  const getRankRequirements = (currentRank: string) => {
    const ranks: Record<string, { next: string; volumeRequired: number; referralsRequired: number }> = {
      member: { next: "Bronze", volumeRequired: 1000, referralsRequired: 3 },
      bronze: { next: "Silver", volumeRequired: 5000, referralsRequired: 5 },
      silver: { next: "Gold", volumeRequired: 15000, referralsRequired: 10 },
      gold: { next: "Platinum", volumeRequired: 50000, referralsRequired: 20 },
      platinum: { next: "Diamond", volumeRequired: 150000, referralsRequired: 50 },
      diamond: { next: "Crown", volumeRequired: 500000, referralsRequired: 100 },
      crown: { next: "Crown", volumeRequired: 500000, referralsRequired: 100 },
    };
    return ranks[currentRank] || ranks.member;
  };

  const calculateRankProgress = () => {
    if (!profile) return { progress: 0, nextRank: "Bronze", volumeNeeded: 1000, referralsNeeded: 3 };
    
    const requirements = getRankRequirements(profile.rank);
    const weakerLeg = Math.min(
      Number(profile.total_left_volume || 0),
      Number(profile.total_right_volume || 0)
    );
    
    const volumeProgress = Math.min((weakerLeg / requirements.volumeRequired) * 100, 100);
    const referralsProgress = Math.min((directReferralsCount / requirements.referralsRequired) * 100, 100);
    const totalProgress = (volumeProgress + referralsProgress) / 2;
    
    return {
      progress: totalProgress,
      nextRank: requirements.next,
      volumeNeeded: Math.max(0, requirements.volumeRequired - weakerLeg),
      referralsNeeded: Math.max(0, requirements.referralsRequired - directReferralsCount),
      volumeProgress,
      referralsProgress,
    };
  };

  const getBinaryBalance = () => {
    if (!profile) return { ratio: 0, status: "balanced", message: "" };
    
    const leftVol = Number(profile.total_left_volume || 0);
    const rightVol = Number(profile.total_right_volume || 0);
    const total = leftVol + rightVol;
    
    if (total === 0) return { ratio: 50, status: "empty", message: "Build your binary tree" };
    
    const leftPercent = (leftVol / total) * 100;
    const rightPercent = (rightVol / total) * 100;
    const difference = Math.abs(leftPercent - rightPercent);
    
    let status = "balanced";
    let message = "Excellent balance!";
    
    if (difference > 30) {
      status = "warning";
      message = `Focus on your ${leftVol < rightVol ? "left" : "right"} leg`;
    } else if (difference > 15) {
      status = "caution";
      message = "Minor imbalance detected";
    }
    
    return { ratio: leftPercent, status, message, leftVol, rightVol };
  };

  const rankProgress = calculateRankProgress();
  const binaryBalance = getBinaryBalance();

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
            icon={<Wallet className="w-6 h-6 text-primary" />}
          />
          <StatsCard
            title="Pending Commission"
            value={formatCurrency(pendingCommissions)}
            icon={<DollarSign className="w-6 h-6 text-warning" />}
          />
          <StatsCard
            title="Direct Referrals"
            value={directReferralsCount.toString()}
            icon={<Users className="w-6 h-6 text-accent" />}
          />
          <StatsCard
            title="Personal Volume"
            value={formatCurrency(Number(profile?.personal_volume || 0))}
            icon={<TrendingUp className="w-6 h-6 text-success" />}
          />
        </div>

        {/* Rank Progress & Binary Balance */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Rank Progress Tracker */}
          <Card className="bg-card border-border/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="w-5 h-5 text-primary" />
                Rank Progress - Next: {rankProgress.nextRank}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-muted-foreground">Overall Progress</span>
                  <span className="text-sm font-semibold">{rankProgress.progress.toFixed(0)}%</span>
                </div>
                <Progress value={rankProgress.progress} className="h-3" />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Scale className="w-4 h-4 text-accent" />
                    <span className="text-xs text-muted-foreground">Volume Requirement</span>
                  </div>
                  <Progress value={rankProgress.volumeProgress} className="h-2" />
                  <p className="text-xs text-muted-foreground">
                    {formatCurrency(rankProgress.volumeNeeded)} needed
                  </p>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4 text-primary" />
                    <span className="text-xs text-muted-foreground">Referral Requirement</span>
                  </div>
                  <Progress value={rankProgress.referralsProgress} className="h-2" />
                  <p className="text-xs text-muted-foreground">
                    {rankProgress.referralsNeeded} more needed
                  </p>
                </div>
              </div>
              
              {rankProgress.progress >= 100 && (
                <div className="p-3 rounded-lg bg-success/10 border border-success/20 flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-success" />
                  <p className="text-sm text-success font-medium">Ready for rank advancement!</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Binary Balance Indicator */}
          <Card className="bg-card border-border/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Scale className="w-5 h-5 text-accent" />
                Binary Balance
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Left Leg</span>
                  <span className="font-semibold">{binaryBalance.ratio.toFixed(1)}%</span>
                </div>
                <div className="relative h-8 rounded-full overflow-hidden bg-muted">
                  <div
                    className="absolute left-0 top-0 h-full bg-gradient-to-r from-accent to-accent/80"
                    style={{ width: `${binaryBalance.ratio}%` }}
                  />
                  <div
                    className="absolute right-0 top-0 h-full bg-gradient-to-l from-success to-success/80"
                    style={{ width: `${100 - binaryBalance.ratio}%` }}
                  />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-1 h-full bg-border" />
                  </div>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Right Leg</span>
                  <span className="font-semibold">{(100 - binaryBalance.ratio).toFixed(1)}%</span>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-lg bg-accent/10">
                  <p className="text-xs text-muted-foreground">Left Volume</p>
                  <p className="text-lg font-bold">{formatCurrency(binaryBalance.leftVol || 0)}</p>
                </div>
                <div className="p-3 rounded-lg bg-success/10">
                  <p className="text-xs text-muted-foreground">Right Volume</p>
                  <p className="text-lg font-bold">{formatCurrency(binaryBalance.rightVol || 0)}</p>
                </div>
              </div>
              
              <div
                className={`p-3 rounded-lg flex items-center gap-2 ${
                  binaryBalance.status === "warning"
                    ? "bg-destructive/10 border border-destructive/20"
                    : binaryBalance.status === "caution"
                    ? "bg-warning/10 border border-warning/20"
                    : "bg-success/10 border border-success/20"
                }`}
              >
                {binaryBalance.status === "warning" && <AlertTriangle className="w-5 h-5 text-destructive" />}
                {binaryBalance.status === "caution" && <AlertTriangle className="w-5 h-5 text-warning" />}
                {binaryBalance.status === "balanced" && <CheckCircle2 className="w-5 h-5 text-success" />}
                <p
                  className={`text-sm font-medium ${
                    binaryBalance.status === "warning"
                      ? "text-destructive"
                      : binaryBalance.status === "caution"
                      ? "text-warning"
                      : "text-success"
                  }`}
                >
                  {binaryBalance.message}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Earnings Analytics */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Earnings Chart */}
          <Card className="bg-card border-border/50">
            <CardHeader>
              <CardTitle className="text-base">Earnings Trend (Last 30 Days)</CardTitle>
            </CardHeader>
            <CardContent>
              {earningsData.length > 0 ? (
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={earningsData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                    <XAxis dataKey="date" tick={{ fontSize: 10 }} stroke="#888" />
                    <YAxis tick={{ fontSize: 10 }} stroke="#888" />
                    <Tooltip
                      formatter={(value: number) => formatCurrency(value)}
                      contentStyle={{ backgroundColor: "#1f1f1f", border: "1px solid #333" }}
                    />
                    <Line type="monotone" dataKey="amount" stroke="#6366f1" strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[200px] flex items-center justify-center text-muted-foreground">
                  <div className="text-center">
                    <TrendingUp className="w-12 h-12 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">No earnings data yet</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Commission Breakdown */}
          <Card className="bg-card border-border/50">
            <CardHeader>
              <CardTitle className="text-base">Commission Breakdown</CardTitle>
            </CardHeader>
            <CardContent>
              {Object.keys(commissionsByType).length > 0 ? (
                <div className="space-y-3">
                  {Object.entries(commissionsByType)
                    .sort(([, a], [, b]) => b - a)
                    .map(([type, amount]) => (
                      <div key={type} className="space-y-1">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground capitalize">
                            {getCommissionTypeLabel(type)}
                          </span>
                          <span className="font-semibold">{formatCurrency(amount)}</span>
                        </div>
                        <Progress
                          value={(amount / totalEarnings) * 100}
                          className="h-2"
                        />
                      </div>
                    ))}
                </div>
              ) : (
                <div className="h-[200px] flex items-center justify-center text-muted-foreground">
                  <div className="text-center">
                    <DollarSign className="w-12 h-12 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">No commissions earned yet</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
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
