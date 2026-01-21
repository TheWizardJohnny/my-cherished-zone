import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Users,
  DollarSign,
  TrendingUp,
  Gift,
  Trophy,
  UserPlus,
  Award,
  Sparkles,
  Clock,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface Activity {
  id: string;
  type: "referral" | "commission" | "rank" | "order" | "placement";
  title: string;
  description: string;
  amount?: number;
  timestamp: Date;
  icon: React.ReactNode;
  color: string;
}

interface ActivityFeedProps {
  userId: string;
}

export function ActivityFeed({ userId }: ActivityFeedProps) {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) return;

    const loadActivities = async () => {
      setLoading(true);
      
      // Get user's profile ID
      const { data: profile } = await supabase
        .from("profiles")
        .select("id")
        .eq("user_id", userId)
        .single();

      if (!profile) {
        setLoading(false);
        return;
      }

      const activityList: Activity[] = [];

      // Fetch recent referrals
      const { data: referrals } = await supabase
        .from("referrals")
        .select(`
          id,
          created_at,
          referred_user:profiles!referrals_referred_user_id_fkey(full_name, email)
        `)
        .eq("referrer_id", profile.id)
        .order("created_at", { ascending: false })
        .limit(10);

      if (referrals) {
        referrals.forEach((ref) => {
          activityList.push({
            id: `ref-${ref.id}`,
            type: "referral",
            title: "New Referral",
            description: `${(ref as { referred_user?: { full_name?: string; email?: string } }).referred_user?.full_name || (ref as { referred_user?: { full_name?: string; email?: string } }).referred_user?.email || "Someone"} joined your network`,
            timestamp: new Date(ref.created_at),
            icon: <UserPlus className="h-4 w-4" />,
            color: "text-blue-500",
          });
        });
      }

      // Fetch recent commissions
      const { data: commissions } = await supabase
        .from("commissions")
        .select("id, amount, type, status, created_at")
        .eq("user_id", profile.id)
        .order("created_at", { ascending: false })
        .limit(15);

      if (commissions) {
        commissions.forEach((comm) => {
          activityList.push({
            id: `comm-${comm.id}`,
            type: "commission",
            title: `${comm.type} Commission`,
            description: `Earned from ${comm.type} activity`,
            amount: comm.amount || 0,
            timestamp: new Date(comm.created_at),
            icon: <DollarSign className="h-4 w-4" />,
            color: comm.status === "paid" ? "text-green-500" : "text-yellow-500",
          });
        });
      }

      // Fetch recent placements
      const { data: placements } = await supabase
        .from("placements")
        .select(`
          id,
          created_at,
          position,
          user:profiles!placements_user_id_fkey(full_name)
        `)
        .eq("upline_id", profile.id)
        .order("created_at", { ascending: false })
        .limit(10);

      if (placements) {
        placements.forEach((placement) => {
          activityList.push({
            id: `place-${placement.id}`,
            type: "placement",
            title: "Team Member Placed",
            description: `${(placement as { user?: { full_name?: string } }).user?.full_name || "Member"} placed on ${placement.position} leg`,
            timestamp: new Date(placement.created_at),
            icon: <Users className="h-4 w-4" />,
            color: "text-purple-500",
          });
        });
      }

      // Fetch recent orders
      const { data: orders } = await supabase
        .from("orders")
        .select("id, total_amount, payment_status, created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(10);

      if (orders) {
        orders.forEach((order) => {
          if (order.payment_status === "paid") {
            activityList.push({
              id: `order-${order.id}`,
              type: "order",
              title: "Purchase Completed",
              description: "Your order was successfully processed",
              amount: order.total_amount || 0,
              timestamp: new Date(order.created_at),
              icon: <Gift className="h-4 w-4" />,
              color: "text-pink-500",
            });
          }
        });
      }

      // Sort all activities by timestamp
      activityList.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

      // Take top 20 most recent
      setActivities(activityList.slice(0, 20));
      setLoading(false);
    };

    loadActivities();

    // Set up real-time subscriptions
    const profileId = supabase
      .from("profiles")
      .select("id")
      .eq("user_id", userId)
      .single()
      .then(({ data }) => data?.id);

    // Subscribe to new referrals
    const referralsChannel = supabase
      .channel("activity-referrals")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "referrals",
          filter: `referrer_id=eq.${profileId}`,
        },
        async (payload) => {
          const { data: newUser } = await supabase
            .from("profiles")
            .select("full_name, email")
            .eq("id", payload.new.referred_user_id)
            .single();

          const newActivity: Activity = {
            id: `ref-${payload.new.id}`,
            type: "referral",
            title: "New Referral",
            description: `${newUser?.full_name || newUser?.email || "Someone"} joined your network`,
            timestamp: new Date(payload.new.created_at),
            icon: <UserPlus className="h-4 w-4" />,
            color: "text-blue-500",
          };

          setActivities((prev) => [newActivity, ...prev].slice(0, 20));
        }
      )
      .subscribe();

    // Subscribe to new commissions
    const commissionsChannel = supabase
      .channel("activity-commissions")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "commissions",
        },
        async (payload) => {
          const { data: profile } = await supabase
            .from("profiles")
            .select("id")
            .eq("user_id", userId)
            .single();

          if (profile && payload.new.user_id === profile.id) {
            const newActivity: Activity = {
              id: `comm-${payload.new.id}`,
              type: "commission",
              title: `${payload.new.type} Commission`,
              description: `Earned from ${payload.new.type} activity`,
              amount: payload.new.amount || 0,
              timestamp: new Date(payload.new.created_at),
              icon: <DollarSign className="h-4 w-4" />,
              color: payload.new.status === "paid" ? "text-green-500" : "text-yellow-500",
            };

            setActivities((prev) => [newActivity, ...prev].slice(0, 20));
          }
        }
      )
      .subscribe();

    // Subscribe to profile updates (rank changes)
    const profilesChannel = supabase
      .channel("activity-profiles")
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "profiles",
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          // Check if rank changed
          if (payload.old.rank !== payload.new.rank) {
            const newActivity: Activity = {
              id: `rank-${Date.now()}`,
              type: "rank",
              title: "Rank Advanced!",
              description: `Congratulations! You've been promoted to ${payload.new.rank}`,
              timestamp: new Date(),
              icon: <Trophy className="h-4 w-4" />,
              color: "text-amber-500",
            };

            setActivities((prev) => [newActivity, ...prev].slice(0, 20));
          }
        }
      )
      .subscribe();

    // Subscribe to new placements
    const placementsChannel = supabase
      .channel("activity-placements")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "placements",
        },
        async (payload) => {
          const { data: profile } = await supabase
            .from("profiles")
            .select("id")
            .eq("user_id", userId)
            .single();

          if (profile && payload.new.upline_id === profile.id) {
            const { data: newUser } = await supabase
              .from("profiles")
              .select("full_name")
              .eq("id", payload.new.user_id)
              .single();

            const newActivity: Activity = {
              id: `place-${payload.new.id}`,
              type: "placement",
              title: "Team Member Placed",
              description: `${newUser?.full_name || "Member"} placed on ${payload.new.position} leg`,
              timestamp: new Date(payload.new.created_at),
              icon: <Users className="h-4 w-4" />,
              color: "text-purple-500",
            };

            setActivities((prev) => [newActivity, ...prev].slice(0, 20));
          }
        }
      )
      .subscribe();

    // Subscribe to new orders
    const ordersChannel = supabase
      .channel("activity-orders")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "orders",
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          if (payload.new.payment_status === "paid") {
            const newActivity: Activity = {
              id: `order-${payload.new.id}`,
              type: "order",
              title: "Purchase Completed",
              description: "Your order was successfully processed",
              amount: payload.new.total_amount || 0,
              timestamp: new Date(payload.new.created_at),
              icon: <Gift className="h-4 w-4" />,
              color: "text-pink-500",
            };

            setActivities((prev) => [newActivity, ...prev].slice(0, 20));
          }
        }
      )
      .subscribe();

    // Cleanup subscriptions
    return () => {
      supabase.removeChannel(referralsChannel);
      supabase.removeChannel(commissionsChannel);
      supabase.removeChannel(profilesChannel);
      supabase.removeChannel(placementsChannel);
      supabase.removeChannel(ordersChannel);
    };
  }, [userId]);

  const getActivityBadge = (type: Activity["type"]) => {
    switch (type) {
      case "referral":
        return <Badge variant="secondary" className="bg-blue-500/10 text-blue-500 border-blue-500/20">New Member</Badge>;
      case "commission":
        return <Badge variant="secondary" className="bg-green-500/10 text-green-500 border-green-500/20">Commission</Badge>;
      case "rank":
        return <Badge variant="secondary" className="bg-amber-500/10 text-amber-500 border-amber-500/20">Rank Up</Badge>;
      case "order":
        return <Badge variant="secondary" className="bg-pink-500/10 text-pink-500 border-pink-500/20">Purchase</Badge>;
      case "placement":
        return <Badge variant="secondary" className="bg-purple-500/10 text-purple-500 border-purple-500/20">Placement</Badge>;
      default:
        return null;
    }
  };

  return (
    <Card className="bg-card border-border/50">
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="text-lg font-semibold flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          Activity Feed
        </CardTitle>
        <Badge variant="outline" className="text-xs">
          Live
        </Badge>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[400px] pr-4">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : activities.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Sparkles className="h-10 w-10 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No recent activity</p>
              <p className="text-xs mt-1">Start building your network to see updates here</p>
            </div>
          ) : (
            <div className="space-y-4">
              {activities.map((activity, index) => (
                <div
                  key={activity.id}
                  className="relative pl-8 pb-4 border-l-2 border-border last:border-l-0 last:pb-0"
                >
                  {/* Timeline dot */}
                  <div className={`absolute left-0 top-0 -translate-x-1/2 w-6 h-6 rounded-full bg-background border-2 flex items-center justify-center ${activity.color}`}>
                    {activity.icon}
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="text-sm font-semibold text-foreground">
                            {activity.title}
                          </h4>
                          {getActivityBadge(activity.type)}
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">
                          {activity.description}
                        </p>
                        {activity.amount !== undefined && (
                          <p className="text-sm font-semibold text-green-600 dark:text-green-400 mt-1">
                            +${activity.amount.toFixed(2)}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      {formatDistanceToNow(activity.timestamp, { addSuffix: true })}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
