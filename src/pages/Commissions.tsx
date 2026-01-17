import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { StatsCard } from "@/components/dashboard/StatsCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { Wallet, TrendingUp, Clock, CheckCircle, Loader2 } from "lucide-react";

interface Commission {
  id: string;
  type: string;
  amount: number;
  status: string;
  description: string | null;
  created_at: string;
  paid_at: string | null;
}

export default function Commissions() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [commissions, setCommissions] = useState<Commission[]>([]);
  const [stats, setStats] = useState({
    total: 0,
    pending: 0,
    paid: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (user) {
      fetchCommissions();
    }
  }, [user]);

  const fetchCommissions = async () => {
    try {
      // First get the profile
      const { data: profileData } = await supabase
        .from("profiles")
        .select("id")
        .eq("user_id", user?.id)
        .single();

      if (profileData) {
        const { data: commissionsData } = await supabase
          .from("commissions")
          .select("*")
          .eq("user_id", profileData.id)
          .order("created_at", { ascending: false });

        if (commissionsData) {
          setCommissions(commissionsData);

          const total = commissionsData.reduce((sum, c) => sum + Number(c.amount), 0);
          const pending = commissionsData
            .filter((c) => c.status === "pending" || c.status === "approved")
            .reduce((sum, c) => sum + Number(c.amount), 0);
          const paid = commissionsData
            .filter((c) => c.status === "paid")
            .reduce((sum, c) => sum + Number(c.amount), 0);

          setStats({ total, pending, paid });
        }
      }
    } catch (error) {
      console.error("Error fetching commissions:", error);
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
      fast_start: "Fast Start Bonus",
      binary_matching: "Binary Matching",
      leadership_matching: "Leadership Matching",
      rank_pool: "Rank Pool",
    };
    return labels[type] || type;
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { className: string; icon: typeof CheckCircle }> = {
      pending: { className: "bg-warning/10 text-warning border-warning/30", icon: Clock },
      approved: { className: "bg-primary/10 text-primary border-primary/30", icon: TrendingUp },
      paid: { className: "bg-success/10 text-success border-success/30", icon: CheckCircle },
      cancelled: { className: "bg-destructive/10 text-destructive border-destructive/30", icon: Clock },
    };
    const variant = variants[status] || variants.pending;
    const Icon = variant.icon;

    return (
      <Badge variant="outline" className={variant.className}>
        <Icon className="w-3 h-3 mr-1" />
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </Badge>
    );
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
        {/* Header */}
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground">
            Commission History
          </h1>
          <p className="text-muted-foreground">
            Track your earnings from all commission types.
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <StatsCard
            title="Total Earnings"
            value={formatCurrency(stats.total)}
            icon={<Wallet className="w-6 h-6 text-primary" />}
          />
          <StatsCard
            title="Pending"
            value={formatCurrency(stats.pending)}
            icon={<Clock className="w-6 h-6 text-warning" />}
          />
          <StatsCard
            title="Paid Out"
            value={formatCurrency(stats.paid)}
            icon={<CheckCircle className="w-6 h-6 text-success" />}
          />
        </div>

        {/* Commission Types Legend */}
        <Card className="bg-card border-border/50">
          <CardHeader>
            <CardTitle className="text-lg">Commission Types</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <div className="p-3 rounded-lg bg-muted/50">
                <p className="font-semibold text-sm text-foreground">Retail Profit</p>
                <p className="text-2xl font-bold text-primary">$70</p>
                <p className="text-xs text-muted-foreground">Per sale</p>
              </div>
              <div className="p-3 rounded-lg bg-muted/50">
                <p className="font-semibold text-sm text-foreground">Fast Start</p>
                <p className="text-2xl font-bold text-accent">$19</p>
                <p className="text-xs text-muted-foreground">Per signup</p>
              </div>
              <div className="p-3 rounded-lg bg-muted/50">
                <p className="font-semibold text-sm text-foreground">Binary Match</p>
                <p className="text-2xl font-bold text-success">$38</p>
                <p className="text-xs text-muted-foreground">Per cycle</p>
              </div>
              <div className="p-3 rounded-lg bg-muted/50">
                <p className="font-semibold text-sm text-foreground">Leadership</p>
                <p className="text-2xl font-bold text-warning">Variable</p>
                <p className="text-xs text-muted-foreground">Matching bonus</p>
              </div>
              <div className="p-3 rounded-lg bg-muted/50">
                <p className="font-semibold text-sm text-foreground">Rank Pool</p>
                <p className="text-2xl font-bold text-foreground">Monthly</p>
                <p className="text-xs text-muted-foreground">Based on rank</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Commissions Table */}
        <Card className="bg-card border-border/50">
          <CardHeader>
            <CardTitle className="text-lg">Transaction History</CardTitle>
          </CardHeader>
          <CardContent>
            {commissions.length > 0 ? (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {commissions.map((commission) => (
                      <TableRow key={commission.id}>
                        <TableCell className="text-muted-foreground">
                          {new Date(commission.created_at).toLocaleDateString()}
                        </TableCell>
                        <TableCell className="font-medium">
                          {getCommissionTypeLabel(commission.type)}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {commission.description || "-"}
                        </TableCell>
                        <TableCell className="font-semibold text-primary">
                          {formatCurrency(Number(commission.amount))}
                        </TableCell>
                        <TableCell>{getStatusBadge(commission.status)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                <TrendingUp className="w-16 h-16 mx-auto mb-4 opacity-50" />
                <p className="text-lg font-medium">No commissions yet</p>
                <p className="text-sm">Start building your network to earn commissions!</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
