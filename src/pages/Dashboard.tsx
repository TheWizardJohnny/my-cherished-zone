import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
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
} from "lucide-react";

interface Profile {
  id: string;
  full_name: string | null;
  rank: string;
  total_left_volume: number;
  total_right_volume: number;
  personal_volume: number;
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
  const navigate = useNavigate();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [recentCommissions, setRecentCommissions] = useState<Commission[]>([]);
  const [totalEarnings, setTotalEarnings] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (user) {
      fetchData();
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
