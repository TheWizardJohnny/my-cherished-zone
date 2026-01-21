import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
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
} from "@/components/ui/dialog";
import { AlertCircle, CheckCircle, DollarSign, RefreshCw, Loader2, Users } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface WeeklyPool {
  id: string;
  week_start: string;
  week_end: string;
  total_contributions: number;
  recycled_in: number;
  status: string;
  created_at: string;
}

interface WeeklyUserPV {
  id: string;
  user_id: string;
  left_pv: number;
  right_pv: number;
  carryover_left_in: number;
  carryover_right_in: number;
  matched_pv: number;
  carryover_left_out: number;
  carryover_right_out: number;
  is_active: boolean;
  profiles?: {
    email: string;
    full_name: string | null;
    wallet_address: string | null;
  };
}

interface BinaryCommission {
  id: string;
  user_id: string;
  amount: number;
  status: string;
  description: string;
  created_at: string;
  profiles?: {
    email: string;
    full_name: string | null;
    wallet_address: string | null;
  };
}

export function AdminWeeklyPools() {
  const { toast } = useToast();
  const [pools, setPools] = useState<WeeklyPool[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPool, setSelectedPool] = useState<WeeklyPool | null>(null);
  const [userPVs, setUserPVs] = useState<WeeklyUserPV[]>([]);
  const [commissions, setCommissions] = useState<BinaryCommission[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  const fetchPools = useCallback(async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("weekly_pools")
        .select("*")
        .order("week_start", { ascending: false });

      if (error) throw error;
      setPools(data || []);
    } catch (error: unknown) {
      toast({
        title: "Error fetching pools",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchPools();
  }, [fetchPools]);

  const fetchPoolDetails = async (pool: WeeklyPool) => {
    try {
      setDetailLoading(true);
      setSelectedPool(pool);

      // Fetch user PVs with profile data
      const { data: pvData, error: pvError } = await supabase
        .from("weekly_user_pv")
        .select(`
          *,
          profiles:user_id (
            email,
            full_name,
            wallet_address
          )
        `)
        .eq("pool_id", pool.id)
        .order("matched_pv", { ascending: false });

      if (pvError) throw pvError;
      setUserPVs(pvData || []);

      // Fetch binary commissions for this pool window
      const { data: commData, error: commError } = await supabase
        .from("commissions")
        .select(`
          *,
          profiles!commissions_user_id_fkey (
            email,
            full_name,
            wallet_address
          )
        `)
        .eq("type", "binary_pool")
        .gte("created_at", pool.week_start)
        .lte("created_at", pool.week_end)
        .order("created_at", { ascending: false });

      if (commError) throw commError;
      setCommissions(commData || []);
    } catch (error: unknown) {
      toast({
        title: "Error fetching pool details",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setDetailLoading(false);
    }
  };

  const handleComputePV = async (poolId: string) => {
    try {
      setActionLoading(true);
      const { error } = await supabase.rpc("compute_weekly_user_pv", {
        p_pool_id: poolId,
      });

      if (error) throw error;

      toast({
        title: "Success",
        description: "Weekly PV computed successfully",
      });

      if (selectedPool) {
        await fetchPoolDetails(selectedPool);
      }
    } catch (error: unknown) {
      toast({
        title: "Error computing PV",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setActionLoading(false);
    }
  };

  const handleDistribute = async (poolId: string) => {
    try {
      setActionLoading(true);
      const { error } = await supabase.rpc("distribute_weekly_binary_pool", {
        p_pool_id: poolId,
      });

      if (error) throw error;

      toast({
        title: "Success",
        description: "Pool distributed successfully. Commissions awaiting approval.",
      });

      await fetchPools();
      if (selectedPool) {
        await fetchPoolDetails(selectedPool);
      }
    } catch (error: unknown) {
      toast({
        title: "Error distributing pool",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setActionLoading(false);
    }
  };

  const handleBulkApprove = async (poolId: string) => {
    try {
      setActionLoading(true);
      const { data, error } = await supabase.rpc("bulk_approve_binary_commissions", {
        p_pool_id: poolId,
      });

      if (error) throw error;

      toast({
        title: "Success",
        description: `Approved ${data || 0} commissions`,
      });

      if (selectedPool) {
        await fetchPoolDetails(selectedPool);
      }
    } catch (error: unknown) {
      toast({
        title: "Error approving commissions",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setActionLoading(false);
    }
  };

  const handleBulkPay = async (poolId: string) => {
    try {
      setActionLoading(true);
      const { data, error } = await supabase.rpc("bulk_pay_binary_commissions", {
        p_pool_id: poolId,
      });

      if (error) throw error;

      toast({
        title: "Success",
        description: `Processed ${data || 0} payments (paid or recycled)`,
      });

      await fetchPools();
      if (selectedPool) {
        await fetchPoolDetails(selectedPool);
      }
    } catch (error: unknown) {
      toast({
        title: "Error processing payments",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setActionLoading(false);
    }
  };

  const handleApproveOne = async (commissionId: string) => {
    try {
      setActionLoading(true);
      const { error } = await supabase.rpc("approve_binary_commission", {
        p_commission_id: commissionId,
      });

      if (error) throw error;

      toast({
        title: "Success",
        description: "Commission approved",
      });

      if (selectedPool) {
        await fetchPoolDetails(selectedPool);
      }
    } catch (error: unknown) {
      toast({
        title: "Error approving commission",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setActionLoading(false);
    }
  };

  const handlePayOne = async (commissionId: string) => {
    try {
      setActionLoading(true);
      const { error } = await supabase.rpc("pay_binary_commission", {
        p_commission_id: commissionId,
      });

      if (error) throw error;

      toast({
        title: "Success",
        description: "Payment processed",
      });

      if (selectedPool) {
        await fetchPoolDetails(selectedPool);
      }
    } catch (error: unknown) {
      toast({
        title: "Error processing payment",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setActionLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const getStatusBadge = (status: string) => {
    const colors: Record<string, string> = {
      open: "bg-blue-500",
      finalized: "bg-green-500",
      pending_admin: "bg-yellow-500",
      approved: "bg-purple-500",
      paid: "bg-green-500",
      recycled: "bg-gray-500",
    };
    return (
      <Badge className={colors[status] || "bg-gray-500"}>
        {status.replace("_", " ").toUpperCase()}
      </Badge>
    );
  };

  const qualifiedUsers = userPVs.filter(
    (pv) =>
      pv.is_active &&
      pv.matched_pv >= 100 &&
      pv.left_pv + pv.carryover_left_in >= 100 &&
      pv.right_pv + pv.carryover_right_in >= 100
  );

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Weekly Binary Matching Pools</CardTitle>
          <CardDescription>
            Manage weekly pool distributions. Pool week runs Friday 00:00 to Thursday 23:59:59.
            Qualification: Active user, matched PV ≥ 100, each leg ≥ 100 PV.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <Button onClick={fetchPools} variant="outline" size="sm">
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Week Period</TableHead>
                  <TableHead>Total Pool</TableHead>
                  <TableHead>Recycled In</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pools.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground">
                      No pools found
                    </TableCell>
                  </TableRow>
                ) : (
                  pools.map((pool) => (
                    <TableRow key={pool.id}>
                      <TableCell>
                        {formatDate(pool.week_start)} - {formatDate(pool.week_end)}
                      </TableCell>
                      <TableCell>${pool.total_contributions.toFixed(2)}</TableCell>
                      <TableCell>
                        {pool.recycled_in > 0 ? (
                          <span className="text-yellow-600">${pool.recycled_in.toFixed(2)}</span>
                        ) : (
                          "$0.00"
                        )}
                      </TableCell>
                      <TableCell>{getStatusBadge(pool.status)}</TableCell>
                      <TableCell>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => fetchPoolDetails(pool)}
                        >
                          View Details
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Pool Details Dialog */}
      <Dialog open={!!selectedPool} onOpenChange={(open) => !open && setSelectedPool(null)}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Pool Details: {selectedPool && formatDate(selectedPool.week_start)} -{" "}
              {selectedPool && formatDate(selectedPool.week_end)}
            </DialogTitle>
            <DialogDescription>
              Total Pool: ${selectedPool?.total_contributions.toFixed(2)} + Recycled: $
              {selectedPool?.recycled_in.toFixed(2)} ={" "}
              <strong>
                ${((selectedPool?.total_contributions || 0) + (selectedPool?.recycled_in || 0)).toFixed(2)}
              </strong>
            </DialogDescription>
          </DialogHeader>

          {detailLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : (
            <div className="space-y-6">
              {/* Action Buttons */}
              <div className="flex flex-wrap gap-2">
                <Button
                  onClick={() => selectedPool && handleComputePV(selectedPool.id)}
                  disabled={actionLoading}
                  size="sm"
                >
                  {actionLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  Compute PV
                </Button>
                <Button
                  onClick={() => selectedPool && handleDistribute(selectedPool.id)}
                  disabled={actionLoading || selectedPool?.status === "finalized"}
                  variant="default"
                  size="sm"
                >
                  {actionLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  Distribute Pool
                </Button>
                <Button
                  onClick={() => selectedPool && handleBulkApprove(selectedPool.id)}
                  disabled={actionLoading}
                  variant="secondary"
                  size="sm"
                >
                  {actionLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  Bulk Approve
                </Button>
                <Button
                  onClick={() => selectedPool && handleBulkPay(selectedPool.id)}
                  disabled={actionLoading}
                  variant="default"
                  size="sm"
                >
                  {actionLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  Bulk Pay
                </Button>
              </div>

              {/* Qualified Users Summary */}
              <Alert>
                <Users className="h-4 w-4" />
                <AlertDescription>
                  <strong>{qualifiedUsers.length}</strong> qualified users out of{" "}
                  <strong>{userPVs.length}</strong> total users in pool
                </AlertDescription>
              </Alert>

              {/* User PV Table */}
              <div>
                <h3 className="text-lg font-semibold mb-2">User PV Details</h3>
                <div className="border rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>User</TableHead>
                        <TableHead>Left PV</TableHead>
                        <TableHead>Right PV</TableHead>
                        <TableHead>Carryover In (L/R)</TableHead>
                        <TableHead>Matched PV</TableHead>
                        <TableHead>Carryover Out (L/R)</TableHead>
                        <TableHead>Active</TableHead>
                        <TableHead>Qualified</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {userPVs.map((pv) => {
                        const isQualified =
                          pv.is_active &&
                          pv.matched_pv >= 100 &&
                          pv.left_pv + pv.carryover_left_in >= 100 &&
                          pv.right_pv + pv.carryover_right_in >= 100;
                        return (
                          <TableRow key={pv.id} className={isQualified ? "bg-green-50" : ""}>
                            <TableCell>
                              <div className="text-sm">
                                <div className="font-medium">{pv.profiles?.email}</div>
                                {pv.profiles?.wallet_address ? (
                                  <div className="text-xs text-green-600">Has wallet</div>
                                ) : (
                                  <div className="text-xs text-red-600">No wallet</div>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>{pv.left_pv.toFixed(2)}</TableCell>
                            <TableCell>{pv.right_pv.toFixed(2)}</TableCell>
                            <TableCell>
                              {pv.carryover_left_in.toFixed(2)} / {pv.carryover_right_in.toFixed(2)}
                            </TableCell>
                            <TableCell className="font-semibold">
                              {pv.matched_pv.toFixed(2)}
                            </TableCell>
                            <TableCell>
                              {pv.carryover_left_out.toFixed(2)} /{" "}
                              {pv.carryover_right_out.toFixed(2)}
                            </TableCell>
                            <TableCell>
                              {pv.is_active ? (
                                <CheckCircle className="h-4 w-4 text-green-500" />
                              ) : (
                                <AlertCircle className="h-4 w-4 text-gray-400" />
                              )}
                            </TableCell>
                            <TableCell>
                              {isQualified ? (
                                <Badge className="bg-green-500">Yes</Badge>
                              ) : (
                                <Badge variant="outline">No</Badge>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </div>

              {/* Commissions Table */}
              <div>
                <h3 className="text-lg font-semibold mb-2">Binary Pool Commissions</h3>
                {commissions.length === 0 ? (
                  <Alert>
                    <AlertDescription>
                      No commissions created yet. Click "Distribute Pool" to generate commissions.
                    </AlertDescription>
                  </Alert>
                ) : (
                  <div className="border rounded-lg overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>User</TableHead>
                          <TableHead>Amount</TableHead>
                          <TableHead>Wallet</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {commissions.map((comm) => (
                          <TableRow key={comm.id}>
                            <TableCell>
                              <div className="text-sm">
                                <div className="font-medium">{comm.profiles?.email}</div>
                                <div className="text-xs text-muted-foreground">
                                  {comm.profiles?.full_name || "No name"}
                                </div>
                              </div>
                            </TableCell>
                            <TableCell className="font-semibold">
                              ${comm.amount.toFixed(2)}
                            </TableCell>
                            <TableCell>
                              {comm.profiles?.wallet_address ? (
                                <div className="text-xs text-green-600 max-w-[120px] truncate">
                                  {comm.profiles.wallet_address}
                                </div>
                              ) : (
                                <div className="text-xs text-red-600">Missing</div>
                              )}
                            </TableCell>
                            <TableCell>{getStatusBadge(comm.status)}</TableCell>
                            <TableCell>
                              <div className="flex gap-2">
                                {comm.status === "pending_admin" && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => handleApproveOne(comm.id)}
                                    disabled={actionLoading}
                                  >
                                    Approve
                                  </Button>
                                )}
                                {comm.status === "approved" && (
                                  <Button
                                    size="sm"
                                    variant="default"
                                    onClick={() => handlePayOne(comm.id)}
                                    disabled={actionLoading}
                                  >
                                    <DollarSign className="h-4 w-4 mr-1" />
                                    Pay
                                  </Button>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
