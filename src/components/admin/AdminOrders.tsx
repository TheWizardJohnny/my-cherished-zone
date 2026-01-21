import React, { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle, XCircle, Loader2, Package, RefreshCw, Clock, Trash2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { BlockchainVerificationService } from "@/lib/blockchainVerification";

interface Order {
  id: string;
  user_id: string;
  product_id: string;
  quantity: number;
  total_amount: number;
  pv_earned: number;
  payment_status: string;
  payment_reference: string | null;
  tx_verification_status: string | null;
  tx_verified_at: string | null;
  delivery_address: {
    street: string;
    suburb: string;
    town: string;
    postal_code: string;
    country: string;
  } | null;
  contact_number: string | null;
  tx_id: string | null;
  created_at: string;
  profiles: {
    email: string;
    full_name: string | null;
  };
  products: {
    name: string;
    price: number;
  };
}

export function AdminOrders() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);
  const [verifying, setVerifying] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ open: boolean; orderId: string | null }>({ open: false, orderId: null });
  const { toast } = useToast();

  useEffect(() => {
    fetchOrders();
    
    // Auto-verify pending orders every 30 seconds
    const verificationInterval = setInterval(() => {
      BlockchainVerificationService.verifyPendingOrders()
        .catch(err => console.error("Auto-verification error:", err));
    }, 30000);
    
    // Set up real-time subscription for orders
    const ordersChannel = supabase
      .channel('admin-orders-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'orders'
        },
        (payload) => {
          console.log('Order changed:', payload);
          // Always refetch to get complete updated data with joins
          fetchOrders();
        }
      )
      .subscribe();

    return () => {
      clearInterval(verificationInterval);
      supabase.removeChannel(ordersChannel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchOrders = async () => {
    try {
      const { data, error } = await supabase
        .from("orders")
        .select(`
          *,
          profiles!inner(email, full_name),
          products!inner(name, price)
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setOrders((data || []) as unknown as Order[]);
    } catch (error) {
      console.error("Error fetching orders:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to fetch orders",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateOrderStatus = async (orderId: string, status: string) => {
    try {
      const { error } = await supabase
        .from("orders")
        .update({ payment_status: status })
        .eq("id", orderId);

      if (error) throw error;

      toast({
        title: "Success",
        description: `Order ${status}`,
      });

      fetchOrders();
    } catch (error) {
      console.error("Error updating order:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to update order",
      });
    }
  };

  const handleVerifyTransaction = async (orderId: string) => {
    console.log(`[UI] Starting transaction verification for order: ${orderId}`);
    setVerifying(orderId);
    try {
      const result = await BlockchainVerificationService.verifyAndUpdateOrder(orderId);
      
      console.log(`[UI] Verification result:`, result);
      
      if (result.verified) {
        toast({
          title: "Transaction Verified ✓",
          description: "Payment has been confirmed. Please verify address on Etherscan.",
        });
      } else {
        toast({
          variant: result.success ? "default" : "destructive",
          title: result.success ? "Verification Pending" : "Verification Failed",
          description: result.message,
        });
      }
      
      // Refresh orders to get updated status
      await new Promise(resolve => setTimeout(resolve, 500));
      fetchOrders();
    } catch (error) {
      console.error("Error verifying transaction:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to verify transaction",
      });
    } finally {
      setVerifying(null);
    }
  };

  const handleDeleteOrder = (orderId: string) => {
    setDeleteConfirm({ open: true, orderId });
  };

  const handleConfirmDelete = async () => {
    if (!deleteConfirm.orderId) return;

    try {
      console.log(`[DELETE] Attempting to delete order: ${deleteConfirm.orderId}`);
      
      const { error } = await supabase
        .from("orders")
        .delete()
        .eq("id", deleteConfirm.orderId);

      if (error) {
        console.error(`[DELETE] Delete failed:`, error);
        throw error;
      }

      console.log(`[DELETE] Order deleted successfully`);
      toast({
        title: "Order Deleted",
        description: "Order has been permanently removed from the system",
      });

      setDeleteConfirm({ open: false, orderId: null });
      fetchOrders();
    } catch (error) {
      console.error("Error deleting order:", error);
      const errorMessage = error instanceof Error ? error.message : "Failed to delete order";
      toast({
        variant: "destructive",
        title: "Error",
        description: errorMessage,
      });
    }
  };

  const getVerificationBadge = (status: string | null) => {
    switch (status) {
      case "verified":
        return <Badge className="bg-green-500"><CheckCircle className="h-3 w-3 mr-1" />Verified</Badge>;
      case "checking":
        return <Badge variant="secondary"><Loader2 className="h-3 w-3 mr-1 animate-spin" />Checking</Badge>;
      case "received":
        return <Badge variant="secondary"><Clock className="h-3 w-3 mr-1" />Received</Badge>;
      case "failed":
        return <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" />Failed</Badge>;
      case "awaiting":
      default:
        return <Badge variant="outline"><Clock className="h-3 w-3 mr-1" />Awaiting TX</Badge>;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "completed":
        return <Badge className="bg-green-500">Completed</Badge>;
      case "pending":
        return <Badge variant="secondary">Pending</Badge>;
      case "failed":
        return <Badge variant="destructive">Failed</Badge>;
      case "refunded":
        return <Badge variant="outline">Refunded</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Package className="h-5 w-5" />
          Order Management
        </CardTitle>
      </CardHeader>
      <CardContent>
        {orders.length > 0 ? (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Product</TableHead>
                  <TableHead>Qty</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>PV</TableHead>
                  <TableHead>TX ID</TableHead>
                  <TableHead>Verification</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orders.map((order) => (
                  <React.Fragment key={`order-group-${order.id}`}>
                    <TableRow>
                      <TableCell className="text-sm">
                        {new Date(order.created_at).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium text-sm">
                            {order.profiles?.full_name || "N/A"}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {order.profiles?.email}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell className="font-medium">
                        {order.products?.name}
                      </TableCell>
                      <TableCell>{order.quantity}</TableCell>
                      <TableCell className="font-semibold">
                        ${order.total_amount.toFixed(2)}
                      </TableCell>
                      <TableCell>{order.pv_earned}</TableCell>
                      <TableCell className="font-mono text-xs">
                        {order.tx_id ? (
                          <a 
                            href={`https://etherscan.io/tx/${order.tx_id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary hover:underline"
                          >
                            {order.tx_id.slice(0, 10)}...
                          </a>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>{getVerificationBadge(order.tx_verification_status)}</TableCell>
                      <TableCell>{getStatusBadge(order.payment_status)}</TableCell>
                      <TableCell>
                        <div className="flex gap-2 flex-wrap">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setExpandedOrderId(expandedOrderId === order.id ? null : order.id)}
                          >
                            Details
                          </Button>
                          {order.tx_id && order.tx_verification_status !== "verified" && (
                            <Button
                              size="sm"
                              variant="default"
                              onClick={() => handleVerifyTransaction(order.id)}
                              disabled={verifying === order.id}
                            >
                              {verifying === order.id ? (
                                <Loader2 className="h-4 w-4 animate-spin mr-1" />
                              ) : (
                                <RefreshCw className="h-4 w-4 mr-1" />
                              )}
                              Verify
                            </Button>
                          )}
                          {order.payment_status === "pending" && order.tx_verification_status !== "verified" && (
                            <>
                              <Button
                                size="sm"
                                variant="default"
                                onClick={() => handleUpdateOrderStatus(order.id, "completed")}
                              >
                                <CheckCircle className="h-4 w-4 mr-1" />
                                Approve
                              </Button>
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => handleUpdateOrderStatus(order.id, "failed")}
                              >
                                <XCircle className="h-4 w-4 mr-1" />
                                Reject
                              </Button>
                            </>
                          )}
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-red-600 hover:bg-red-50 hover:text-red-700"
                            onClick={() => handleDeleteOrder(order.id)}
                          >
                            <Trash2 className="h-4 w-4 mr-1" />
                            Erase
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                    {expandedOrderId === order.id && (
                      <TableRow key={`${order.id}-details`} className="bg-muted/30">
                        <TableCell colSpan={10} className="p-4">
                          <div className="space-y-4">
                            <div>
                              <h4 className="text-sm font-semibold mb-3">Delivery Information</h4>
                              <div className="grid grid-cols-2 gap-4">
                                <div>
                                  <p className="text-sm font-medium text-muted-foreground">Street</p>
                                  <p className="text-sm text-foreground mt-1">
                                    {order.delivery_address?.street || "Not provided"}
                                  </p>
                                </div>
                                <div>
                                  <p className="text-sm font-medium text-muted-foreground">Suburb</p>
                                  <p className="text-sm text-foreground mt-1">
                                    {order.delivery_address?.suburb || "—"}
                                  </p>
                                </div>
                                <div>
                                  <p className="text-sm font-medium text-muted-foreground">Town / City</p>
                                  <p className="text-sm text-foreground mt-1">
                                    {order.delivery_address?.town || "Not provided"}
                                  </p>
                                </div>
                                <div>
                                  <p className="text-sm font-medium text-muted-foreground">Postal / ZIP Code</p>
                                  <p className="text-sm text-foreground mt-1">
                                    {order.delivery_address?.postal_code || "—"}
                                  </p>
                                </div>
                                <div>
                                  <p className="text-sm font-medium text-muted-foreground">Country</p>
                                  <p className="text-sm text-foreground mt-1">
                                    {order.delivery_address?.country || "Not provided"}
                                  </p>
                                </div>
                                <div>
                                  <p className="text-sm font-medium text-muted-foreground">Contact Number</p>
                                  <p className="text-sm text-foreground mt-1">
                                    {order.contact_number || "—"}
                                  </p>
                                </div>
                              </div>
                            </div>
                            
                            {order.tx_id && (
                              <div className="pt-3 border-t">
                                <h4 className="text-sm font-semibold mb-3">Transaction Verification Details</h4>
                                <div className="space-y-3">
                                  <div>
                                    <p className="text-sm font-medium text-muted-foreground">Transaction ID</p>
                                    <a 
                                      href={`https://etherscan.io/tx/${order.tx_id}`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-sm font-mono text-primary hover:underline mt-1 block"
                                    >
                                      {order.tx_id}
                                    </a>
                                  </div>
                                  
                                  {order.tx_verification_details && typeof order.tx_verification_details === 'object' && (
                                    <>
                                      {(order.tx_verification_details as { expectedAddress?: string }).expectedAddress && (
                                        <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3">
                                          <p className="text-sm font-medium text-amber-900 dark:text-amber-100 mb-2">
                                            ⚠️ Verify Receiving Address
                                          </p>
                                          <div className="space-y-2">
                                            <div>
                                              <p className="text-xs font-medium text-amber-800 dark:text-amber-200">Expected System Address:</p>
                                              <p className="text-xs font-mono text-amber-900 dark:text-amber-100 mt-1 break-all">
                                                {(order.tx_verification_details as { expectedAddress?: string }).expectedAddress}
                                              </p>
                                            </div>
                                            <p className="text-xs text-amber-800 dark:text-amber-200">
                                              Click the Transaction ID above and verify on Etherscan that the "To" address matches the expected system address.
                                            </p>
                                          </div>
                                        </div>
                                      )}
                                      
                                      {(order.tx_verification_details as { note?: string }).note && (
                                        <div className="text-xs text-muted-foreground bg-muted/50 p-2 rounded">
                                          {(order.tx_verification_details as { note?: string }).note}
                                        </div>
                                      )}
                                    </>
                                  )}
                                  
                                  {order.tx_verified_at && (
                                    <div>
                                      <p className="text-sm font-medium text-muted-foreground">Verified At</p>
                                      <p className="text-sm text-foreground mt-1">
                                        {new Date(order.tx_verified_at).toLocaleString()}
                                      </p>
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </React.Fragment>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            <Package className="w-12 h-12 mx-auto mb-2 opacity-50" />
            <p>No orders found</p>
          </div>
        )}
      </CardContent>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteConfirm.open} onOpenChange={(open) => setDeleteConfirm({ ...deleteConfirm, open })}>        
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Order - Permanent Action</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 pt-2">
                <p>⚠️ WARNING: This will permanently delete this order and remove it from the system. This action CANNOT be undone.</p>
                <p className="text-xs font-medium text-muted-foreground">Order ID: {deleteConfirm.orderId}</p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              Delete Order
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
