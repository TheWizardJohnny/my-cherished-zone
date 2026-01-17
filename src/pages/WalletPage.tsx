import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { StatsCard } from "@/components/dashboard/StatsCard";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  Wallet,
  ArrowUpRight,
  ArrowDownLeft,
  Clock,
  CheckCircle,
  Copy,
  Loader2,
} from "lucide-react";

interface Withdrawal {
  id: string;
  amount: number;
  wallet_address: string;
  status: string;
  transaction_hash: string | null;
  created_at: string;
  processed_at: string | null;
}

interface Profile {
  id: string;
  wallet_address: string | null;
}

export default function WalletPage() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);
  const [availableBalance, setAvailableBalance] = useState(0);
  const [pendingBalance, setPendingBalance] = useState(0);
  const [loading, setLoading] = useState(true);
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [withdrawAddress, setWithdrawAddress] = useState("");
  const [isWithdrawing, setIsWithdrawing] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (user) {
      fetchWalletData();
    }
  }, [user]);

  const fetchWalletData = async () => {
    try {
      const { data: profileData } = await supabase
        .from("profiles")
        .select("id, wallet_address")
        .eq("user_id", user?.id)
        .single();

      if (profileData) {
        setProfile(profileData);
        setWithdrawAddress(profileData.wallet_address || "");

        // Fetch commissions to calculate balance
        const { data: commissionsData } = await supabase
          .from("commissions")
          .select("amount, status")
          .eq("user_id", profileData.id);

        if (commissionsData) {
          const available = commissionsData
            .filter((c) => c.status === "approved")
            .reduce((sum, c) => sum + Number(c.amount), 0);
          const pending = commissionsData
            .filter((c) => c.status === "pending")
            .reduce((sum, c) => sum + Number(c.amount), 0);
          
          setAvailableBalance(available);
          setPendingBalance(pending);
        }

        // Fetch withdrawals
        const { data: withdrawalsData } = await supabase
          .from("withdrawals")
          .select("*")
          .eq("user_id", profileData.id)
          .order("created_at", { ascending: false });

        if (withdrawalsData) {
          setWithdrawals(withdrawalsData);
        }
      }
    } catch (error) {
      console.error("Error fetching wallet data:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleWithdraw = async () => {
    const amount = parseFloat(withdrawAmount);
    
    if (!amount || amount <= 0) {
      toast({
        variant: "destructive",
        title: "Invalid amount",
        description: "Please enter a valid withdrawal amount.",
      });
      return;
    }

    if (amount > availableBalance) {
      toast({
        variant: "destructive",
        title: "Insufficient balance",
        description: "You don't have enough available balance.",
      });
      return;
    }

    if (!withdrawAddress) {
      toast({
        variant: "destructive",
        title: "Missing wallet address",
        description: "Please enter your USDT wallet address.",
      });
      return;
    }

    setIsWithdrawing(true);

    try {
      const { error } = await supabase.from("withdrawals").insert({
        user_id: profile?.id,
        amount,
        wallet_address: withdrawAddress,
      });

      if (error) throw error;

      toast({
        title: "Withdrawal requested",
        description: "Your withdrawal request has been submitted for processing.",
      });

      setWithdrawAmount("");
      setDialogOpen(false);
      fetchWalletData();
    } catch (error) {
      console.error("Withdrawal error:", error);
      toast({
        variant: "destructive",
        title: "Withdrawal failed",
        description: "Unable to process your withdrawal. Please try again.",
      });
    } finally {
      setIsWithdrawing(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(amount);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copied!",
      description: "Address copied to clipboard.",
    });
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, string> = {
      pending: "bg-warning/10 text-warning border-warning/30",
      processing: "bg-primary/10 text-primary border-primary/30",
      completed: "bg-success/10 text-success border-success/30",
      failed: "bg-destructive/10 text-destructive border-destructive/30",
    };

    return (
      <Badge variant="outline" className={variants[status] || variants.pending}>
        {status === "completed" && <CheckCircle className="w-3 h-3 mr-1" />}
        {status === "pending" && <Clock className="w-3 h-3 mr-1" />}
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
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-foreground">Wallet</h1>
            <p className="text-muted-foreground">
              Manage your USDT earnings and withdrawals.
            </p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gradient-primary text-primary-foreground">
                <ArrowUpRight className="w-4 h-4 mr-2" />
                Withdraw
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-card border-border">
              <DialogHeader>
                <DialogTitle>Request Withdrawal</DialogTitle>
                <DialogDescription>
                  Withdraw your available balance to your USDT wallet.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Available Balance</Label>
                  <p className="text-2xl font-bold text-primary">
                    {formatCurrency(availableBalance)}
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="amount">Amount (USD)</Label>
                  <Input
                    id="amount"
                    type="number"
                    placeholder="0.00"
                    value={withdrawAmount}
                    onChange={(e) => setWithdrawAmount(e.target.value)}
                    className="bg-muted/50"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="wallet">USDT Wallet Address (TRC20)</Label>
                  <Input
                    id="wallet"
                    type="text"
                    placeholder="T..."
                    value={withdrawAddress}
                    onChange={(e) => setWithdrawAddress(e.target.value)}
                    className="bg-muted/50"
                  />
                </div>
                <Button
                  className="w-full gradient-primary text-primary-foreground"
                  onClick={handleWithdraw}
                  disabled={isWithdrawing}
                >
                  {isWithdrawing ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  ) : (
                    <ArrowUpRight className="w-4 h-4 mr-2" />
                  )}
                  Request Withdrawal
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <StatsCard
            title="Available Balance"
            value={formatCurrency(availableBalance)}
            icon={<Wallet className="w-6 h-6 text-primary" />}
          />
          <StatsCard
            title="Pending Earnings"
            value={formatCurrency(pendingBalance)}
            icon={<Clock className="w-6 h-6 text-warning" />}
          />
          <StatsCard
            title="Total Withdrawn"
            value={formatCurrency(
              withdrawals
                .filter((w) => w.status === "completed")
                .reduce((sum, w) => sum + Number(w.amount), 0)
            )}
            icon={<ArrowUpRight className="w-6 h-6 text-success" />}
          />
        </div>

        {/* Wallet Address */}
        <Card className="bg-card border-border/50">
          <CardHeader>
            <CardTitle className="text-lg">Your Wallet Address</CardTitle>
            <CardDescription>
              This is where your USDT withdrawals will be sent.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-3 p-4 rounded-lg bg-muted/50">
              <div className="flex-1 font-mono text-sm truncate text-foreground">
                {profile?.wallet_address || "Not set"}
              </div>
              {profile?.wallet_address && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => copyToClipboard(profile.wallet_address!)}
                >
                  <Copy className="w-4 h-4" />
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Withdrawal History */}
        <Card className="bg-card border-border/50">
          <CardHeader>
            <CardTitle className="text-lg">Withdrawal History</CardTitle>
          </CardHeader>
          <CardContent>
            {withdrawals.length > 0 ? (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Wallet</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>TX Hash</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {withdrawals.map((withdrawal) => (
                      <TableRow key={withdrawal.id}>
                        <TableCell className="text-muted-foreground">
                          {new Date(withdrawal.created_at).toLocaleDateString()}
                        </TableCell>
                        <TableCell className="font-semibold text-primary">
                          {formatCurrency(Number(withdrawal.amount))}
                        </TableCell>
                        <TableCell className="font-mono text-xs text-muted-foreground">
                          {withdrawal.wallet_address.slice(0, 10)}...
                        </TableCell>
                        <TableCell>{getStatusBadge(withdrawal.status)}</TableCell>
                        <TableCell className="font-mono text-xs text-muted-foreground">
                          {withdrawal.transaction_hash
                            ? `${withdrawal.transaction_hash.slice(0, 10)}...`
                            : "-"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                <ArrowDownLeft className="w-16 h-16 mx-auto mb-4 opacity-50" />
                <p className="text-lg font-medium">No withdrawals yet</p>
                <p className="text-sm">Your withdrawal history will appear here.</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
