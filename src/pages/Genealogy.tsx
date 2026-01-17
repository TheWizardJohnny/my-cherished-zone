import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { Users, User, ChevronDown, Loader2 } from "lucide-react";

interface TreeNode {
  id: string;
  full_name: string | null;
  email: string;
  rank: string;
  placement_side: string | null;
  total_left_volume: number;
  total_right_volume: number;
  left_child?: TreeNode | null;
  right_child?: TreeNode | null;
}

export default function Genealogy() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [rootProfile, setRootProfile] = useState<TreeNode | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (user) {
      fetchGenealogyData();
    }
  }, [user]);

  const fetchGenealogyData = async () => {
    try {
      // Fetch current user's profile
      const { data: profileData } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", user?.id)
        .single();

      if (profileData) {
        // For now, just show the user's own node
        // In production, you would recursively fetch downline
        setRootProfile({
          ...profileData,
          left_child: null,
          right_child: null,
        });
      }
    } catch (error) {
      console.error("Error fetching genealogy:", error);
    } finally {
      setLoading(false);
    }
  };

  const getRankColor = (rank: string) => {
    const colors: Record<string, string> = {
      member: "bg-muted text-muted-foreground",
      bronze: "bg-amber-900/20 text-amber-500 border-amber-500/30",
      silver: "bg-slate-400/20 text-slate-300 border-slate-300/30",
      gold: "bg-yellow-500/20 text-yellow-500 border-yellow-500/30",
      platinum: "bg-cyan-400/20 text-cyan-400 border-cyan-400/30",
      diamond: "bg-purple-400/20 text-purple-400 border-purple-400/30",
      crown: "bg-primary/20 text-primary border-primary/30",
    };
    return colors[rank] || colors.member;
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const TreeNodeCard = ({ node, isRoot = false }: { node: TreeNode; isRoot?: boolean }) => (
    <div className="flex flex-col items-center">
      <Card
        className={`w-48 border-2 ${
          isRoot ? "border-primary glow-primary" : "border-border/50"
        } bg-card`}
      >
        <CardContent className="p-4 text-center">
          <div
            className={`w-12 h-12 mx-auto rounded-full ${
              isRoot ? "gradient-primary" : "bg-muted"
            } flex items-center justify-center mb-3`}
          >
            <User className={`w-6 h-6 ${isRoot ? "text-primary-foreground" : "text-muted-foreground"}`} />
          </div>
          <p className="font-semibold text-sm text-foreground truncate">
            {node.full_name || "Member"}
          </p>
          <p className="text-xs text-muted-foreground truncate mb-2">
            {node.email}
          </p>
          <Badge className={`${getRankColor(node.rank)} text-xs`}>
            {node.rank.charAt(0).toUpperCase() + node.rank.slice(1)}
          </Badge>
          <div className="grid grid-cols-2 gap-2 mt-3 pt-3 border-t border-border">
            <div>
              <p className="text-xs text-muted-foreground">Left</p>
              <p className="text-xs font-semibold text-foreground">
                {formatCurrency(Number(node.total_left_volume))}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Right</p>
              <p className="text-xs font-semibold text-foreground">
                {formatCurrency(Number(node.total_right_volume))}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Children */}
      {(node.left_child || node.right_child) && (
        <>
          <div className="w-px h-6 bg-border" />
          <div className="flex items-start gap-8">
            {/* Left branch */}
            <div className="flex flex-col items-center">
              {node.left_child ? (
                <TreeNodeCard node={node.left_child} />
              ) : (
                <EmptySlot side="Left" />
              )}
            </div>

            {/* Right branch */}
            <div className="flex flex-col items-center">
              {node.right_child ? (
                <TreeNodeCard node={node.right_child} />
              ) : (
                <EmptySlot side="Right" />
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );

  const EmptySlot = ({ side }: { side: string }) => (
    <Card className="w-40 border-2 border-dashed border-border/50 bg-muted/20">
      <CardContent className="p-4 text-center">
        <div className="w-10 h-10 mx-auto rounded-full bg-muted/50 flex items-center justify-center mb-2">
          <Users className="w-5 h-5 text-muted-foreground/50" />
        </div>
        <p className="text-xs text-muted-foreground">{side} Position</p>
        <p className="text-xs text-muted-foreground/60">Available</p>
      </CardContent>
    </Card>
  );

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
        {/* Header */}
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground">
            Binary Genealogy Tree
          </h1>
          <p className="text-muted-foreground">
            View your network structure and team placement.
          </p>
        </div>

        {/* Volume Summary */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="bg-card border-border/50">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                <Users className="w-6 h-6 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Left Leg Volume</p>
                <p className="text-xl font-bold text-foreground">
                  {formatCurrency(Number(rootProfile?.total_left_volume || 0))}
                </p>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-card border-border/50">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-accent/10 flex items-center justify-center">
                <Users className="w-6 h-6 text-accent" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Right Leg Volume</p>
                <p className="text-xl font-bold text-foreground">
                  {formatCurrency(Number(rootProfile?.total_right_volume || 0))}
                </p>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-card border-border/50">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-success/10 flex items-center justify-center">
                <ChevronDown className="w-6 h-6 text-success" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Weaker Leg</p>
                <p className="text-xl font-bold text-foreground">
                  {Number(rootProfile?.total_left_volume || 0) <=
                  Number(rootProfile?.total_right_volume || 0)
                    ? "Left"
                    : "Right"}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tree View */}
        <Card className="bg-card border-border/50 overflow-x-auto">
          <CardHeader>
            <CardTitle>Your Network Tree</CardTitle>
          </CardHeader>
          <CardContent className="pb-8">
            <div className="min-w-[600px] flex justify-center py-8">
              {rootProfile ? (
                <div className="flex flex-col items-center">
                  <TreeNodeCard node={rootProfile} isRoot />
                  <div className="w-px h-6 bg-border" />
                  <div className="flex items-start gap-16">
                    <EmptySlot side="Left" />
                    <EmptySlot side="Right" />
                  </div>
                </div>
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  <Users className="w-16 h-16 mx-auto mb-4 opacity-50" />
                  <p>No network data available</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
