import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Check, X } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import type { Tables } from "@/integrations/supabase/types";

type Withdrawal = Tables<"withdrawals"> & {
  profiles?: { full_name: string | null; email: string } | null;
};

interface AdminWithdrawalsProps {
  onUpdate?: () => void;
}

export function AdminWithdrawals({ onUpdate }: AdminWithdrawalsProps) {
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [processDialog, setProcessDialog] = useState<{ open: boolean; withdrawal: Withdrawal | null }>({
    open: false,
    withdrawal: null,
  });
  const [txHash, setTxHash] = useState("");

  useEffect(() => {
    fetchWithdrawals();
  }, [statusFilter]);

  const fetchWithdrawals = async () => {
    try {
      let query = supabase
        .from("withdrawals")
        .select(`
          *,
          profiles:user_id (full_name, email)
        `)
        .order("created_at", { ascending: false });

      if (statusFilter !== "all") {
        query = query.eq("status", statusFilter);
      }

      const { data, error } = await query;

      if (error) throw error;
      setWithdrawals(data || []);
    } catch (error) {
      console.error("Error fetching withdrawals:", error);
      toast({
        title: "Error",
        description: "Failed to fetch withdrawals",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleProcess = async () => {
    if (!processDialog.withdrawal) return;

    try {
      const { error } = await supabase
        .from("withdrawals")
        .update({
          status: "completed",
          transaction_hash: txHash || null,
          processed_at: new Date().toISOString(),
        })
        .eq("id", processDialog.withdrawal.id);

      if (error) throw error;
      toast({ title: "Success", description: "Withdrawal processed" });
      setProcessDialog({ open: false, withdrawal: null });
      setTxHash("");
      fetchWithdrawals();
      onUpdate?.();
    } catch (error) {
      console.error("Error processing withdrawal:", error);
      toast({
        title: "Error",
        description: "Failed to process withdrawal",
        variant: "destructive",
      });
    }
  };

  const handleReject = async (id: string) => {
    if (!confirm("Are you sure you want to reject this withdrawal?")) return;

    try {
      const { error } = await supabase
        .from("withdrawals")
        .update({
          status: "rejected",
          processed_at: new Date().toISOString(),
        })
        .eq("id", id);

      if (error) throw error;
      toast({ title: "Success", description: "Withdrawal rejected" });
      fetchWithdrawals();
      onUpdate?.();
    } catch (error) {
      console.error("Error rejecting withdrawal:", error);
      toast({
        title: "Error",
        description: "Failed to reject withdrawal",
        variant: "destructive",
      });
    }
  };

  const getStatusBadge = (status: string | null) => {
    switch (status) {
      case "completed":
        return <Badge className="bg-green-500">Completed</Badge>;
      case "pending":
        return <Badge className="bg-yellow-500">Pending</Badge>;
      case "rejected":
        return <Badge variant="destructive">Rejected</Badge>;
      default:
        return <Badge variant="secondary">{status || "Unknown"}</Badge>;
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Withdrawal Management</CardTitle>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="rejected">Rejected</SelectItem>
            </SelectContent>
          </Select>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Wallet Address</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>TX Hash</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {withdrawals.map((withdrawal) => (
                  <TableRow key={withdrawal.id}>
                    <TableCell>
                      <div>
                        <div className="font-medium">
                          {withdrawal.profiles?.full_name || "Unknown"}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {withdrawal.profiles?.email}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="font-medium">
                      ${withdrawal.amount.toFixed(2)}
                    </TableCell>
                    <TableCell className="font-mono text-xs max-w-[150px] truncate">
                      {withdrawal.wallet_address}
                    </TableCell>
                    <TableCell>{getStatusBadge(withdrawal.status)}</TableCell>
                    <TableCell className="font-mono text-xs max-w-[100px] truncate">
                      {withdrawal.transaction_hash || "-"}
                    </TableCell>
                    <TableCell>
                      {new Date(withdrawal.created_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      {withdrawal.status === "pending" && (
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-green-600"
                            onClick={() => setProcessDialog({ open: true, withdrawal })}
                          >
                            <Check className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-red-600"
                            onClick={() => handleReject(withdrawal.id)}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={processDialog.open} onOpenChange={(open) => {
        setProcessDialog({ open, withdrawal: open ? processDialog.withdrawal : null });
        if (!open) setTxHash("");
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Process Withdrawal</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <p className="text-sm text-muted-foreground">Amount</p>
              <p className="font-medium">${processDialog.withdrawal?.amount.toFixed(2)}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Wallet Address</p>
              <p className="font-mono text-sm break-all">{processDialog.withdrawal?.wallet_address}</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="txHash">Transaction Hash (Optional)</Label>
              <Input
                id="txHash"
                value={txHash}
                onChange={(e) => setTxHash(e.target.value)}
                placeholder="0x..."
              />
            </div>
            <Button onClick={handleProcess} className="w-full">
              Confirm Process
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
