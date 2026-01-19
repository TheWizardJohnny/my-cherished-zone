import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { ShoppingBag, Package, Zap, Crown, Loader2, Check, Info } from "lucide-react";
import { OrderPaymentDialog, PaymentDetails } from "@/components/OrderPaymentDialog";
import { BlockchainVerificationService } from "@/lib/blockchainVerification";

interface Product {
  id: string;
  name: string;
  description: string | null;
  price: number;
  pv_value: number;
  image_url: string | null;
  features: string[] | null;
  more_info: { sections: Array<{ title: string; content?: string }> } | null;
}

export default function Shop() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState<string | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [infoDialogOpen, setInfoDialogOpen] = useState(false);
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [pendingProduct, setPendingProduct] = useState<Product | null>(null);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    fetchProducts();
  }, []);

  // Subscribe to realtime product changes so user view updates immediately
  useEffect(() => {
    const channel = supabase
      .channel("products-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "products" },
        (payload: any) => {
          const eventType = payload?.eventType;
          const newRow = payload?.new;
          const oldRow = payload?.old;

          setProducts((prev) => {
            let next = [...prev];

            if (eventType === "INSERT") {
              if (newRow?.active) {
                if (!next.some((p) => p.id === newRow.id)) {
                  next.push(newRow as Product);
                }
              }
            } else if (eventType === "UPDATE") {
              const idx = next.findIndex((p) => p.id === newRow?.id);
              if (newRow?.active) {
                if (idx >= 0) next[idx] = newRow as Product;
                else next.push(newRow as Product);
              } else {
                if (idx >= 0) next.splice(idx, 1);
              }
              // If user has the info dialog open for this product, update it too
              if (newRow?.id && selectedProduct?.id === newRow.id) {
                setSelectedProduct(newRow as Product);
              }
            } else if (eventType === "DELETE") {
              const id = oldRow?.id;
              next = next.filter((p) => p.id !== id);
              if (selectedProduct?.id === id) {
                setSelectedProduct(null);
                setInfoDialogOpen(false);
              }
            }

            // Keep products ordered by price ascending
            next.sort((a, b) => Number(a.price) - Number(b.price));
            return next;
          });
        }
      );

    channel.subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchProducts = async () => {
    try {
      const { data, error } = await supabase
        .from("products")
        .select("id, name, description, price, pv_value, image_url, features, more_info, active")
        .eq("active", true)
        .order("price", { ascending: true });

      if (error) {
        console.error("Fetch error:", error);
        throw error;
      }

      if (data) {
        console.log("Fetched products:", data);
        data.forEach((product, idx) => {
          console.log(`Product ${idx} more_info:`, JSON.stringify(product.more_info, null, 2));
        });
        setProducts(data);
      }
    } catch (error) {
      console.error("Error fetching products:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to load products"
      });
    } finally {
      setLoading(false);
    }
  };

  const handlePurchase = (product: Product) => {
    setPendingProduct(product);
    setPaymentDialogOpen(true);
  };

  const handlePaymentConfirm = async (details: PaymentDetails) => {
    if (!pendingProduct) return;

    setPurchasing(pendingProduct.id);

    try {
      // Get user profile
      const { data: profileData } = await supabase
        .from("profiles")
        .select("id")
        .eq("user_id", user?.id)
        .single();

      if (!profileData) throw new Error("Profile not found");

      // Create order with payment details
      const { data: orderData, error } = await supabase.from("orders").insert({
        user_id: profileData.id,
        product_id: pendingProduct.id,
        quantity: 1,
        total_amount: pendingProduct.price,
        pv_earned: pendingProduct.pv_value,
        payment_status: "pending",
        tx_verification_status: "received",
        delivery_address: details.deliveryAddress,
        contact_number: details.contactNumber,
        tx_id: details.txId,
      }).select();

      if (error) throw error;

      // Trigger automatic verification
      if (orderData && orderData[0]) {
        setTimeout(() => {
          BlockchainVerificationService.verifyAndUpdateOrder(orderData[0].id)
            .catch(err => console.error("Verification error:", err));
        }, 2000);
      }

      toast({
        title: "Order placed!",
        description: "Your transaction is being verified on the blockchain.",
      });

      setPaymentDialogOpen(false);
      setPendingProduct(null);
      navigate("/dashboard/orders");
    } catch (error) {
      console.error("Purchase error:", error);
      toast({
        variant: "destructive",
        title: "Order failed",
        description: "Unable to create order. Please try again.",
      });
    } finally {
      setPurchasing(null);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(amount);
  };

  const getProductIcon = (index: number) => {
    const icons = [Package, Zap, Crown];
    const Icon = icons[index] || Package;
    return Icon;
  };

  const getProductGradient = (index: number) => {
    const gradients = [
      "from-primary/20 to-primary/5",
      "from-accent/20 to-accent/5",
      "from-warning/20 to-warning/5",
    ];
    return gradients[index] || gradients[0];
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
          <h1 className="text-2xl md:text-3xl font-bold text-foreground">Shop</h1>
          <p className="text-muted-foreground">
            Choose a package to get started or upgrade your account.
          </p>
        </div>

        {/* Products Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {products.map((product, index) => {
            const Icon = getProductIcon(index);
            const isPopular = index === 1;

            return (
              <Card
                key={product.id}
                className={`relative bg-card border-2 transition-all hover:scale-[1.02] ${
                  isPopular ? "border-accent glow-accent" : "border-border/50"
                }`}
              >
                {isPopular && (
                  <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 gradient-accent text-accent-foreground">
                    Most Popular
                  </Badge>
                )}
                <CardHeader className="text-center pb-2">
                  <div
                    className={`w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br ${getProductGradient(
                      index
                    )} flex items-center justify-center mb-4`}
                  >
                    <Icon className="w-8 h-8 text-foreground" />
                  </div>
                  <CardTitle className="text-xl">{product.name}</CardTitle>
                </CardHeader>
                <CardContent className="text-center space-y-4">
                  <p className="text-muted-foreground text-sm">
                    {product.description}
                  </p>
                  
                  <div>
                    <p className="text-4xl font-bold text-foreground">
                      {formatCurrency(Number(product.price))}
                    </p>
                    <p className="text-sm text-muted-foreground">one-time payment</p>
                  </div>

                  <div className="space-y-2 text-left">
                    <div className="flex items-center gap-2 text-sm">
                      <Check className="w-4 h-4 text-success" />
                      <span className="text-foreground">{product.pv_value} PV Value</span>
                    </div>
                    {product.features && product.features.length > 0 ? (
                      product.features.map((feature, idx) => (
                        <div key={idx} className="flex items-center gap-2 text-sm">
                          <Check className="w-4 h-4 text-success" />
                          <span className="text-foreground">{feature}</span>
                        </div>
                      ))
                    ) : (
                      <>
                        <div className="flex items-center gap-2 text-sm">
                          <Check className="w-4 h-4 text-success" />
                          <span className="text-foreground">Binary placement</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm">
                          <Check className="w-4 h-4 text-success" />
                          <span className="text-foreground">Commission eligibility</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm">
                          <Check className="w-4 h-4 text-success" />
                          <span className="text-foreground">Training materials</span>
                        </div>
                      </>
                    )}
                  </div>
                </CardContent>
                <CardFooter className="flex flex-col gap-2">
                  <Button
                    className={`w-full ${
                      isPopular
                        ? "gradient-accent text-accent-foreground"
                        : "gradient-primary text-primary-foreground"
                    }`}
                    onClick={() => handlePurchase(product)}
                    disabled={purchasing === product.id}
                  >
                    {purchasing === product.id ? (
                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    ) : (
                      <ShoppingBag className="w-4 h-4 mr-2" />
                    )}
                    Place Order Now
                  </Button>
                  {product.more_info && product.more_info.sections && product.more_info.sections.length > 0 && (
                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={() => {
                        console.log("Selected product:", product);
                        console.log("Product more_info:", product.more_info);
                        setSelectedProduct(product);
                        setInfoDialogOpen(true);
                      }}
                    >
                      <Info className="w-4 h-4 mr-2" />
                      Get More Info
                    </Button>
                  )}
                </CardFooter>
              </Card>
            );
          })}
        </div>

        {/* More Info Dialog */}
        <Dialog open={infoDialogOpen} onOpenChange={setInfoDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{selectedProduct?.name} - Details</DialogTitle>
            </DialogHeader>
            <div className="space-y-6">
              {(() => {
                console.log("Rendering dialog - selectedProduct:", selectedProduct);
                console.log("Rendering dialog - sections:", selectedProduct?.more_info?.sections);
                if (!selectedProduct?.more_info?.sections || selectedProduct.more_info.sections.length === 0) {
                  console.log("No sections found to display");
                  return <p className="text-muted-foreground">No additional information available.</p>;
                }
                return selectedProduct.more_info.sections.map((section, idx) => (
                  <div key={idx} className="space-y-2">
                    <h3 className="font-semibold text-lg text-foreground">{section.title}</h3>
                    {section.content && (
                      <p className="text-foreground whitespace-pre-line text-sm">{section.content}</p>
                    )}
                  </div>
                ));
              })()}
            </div>
          </DialogContent>
        </Dialog>        {/* Info Card */}
        <Card className="bg-muted/30 border-border/50">
          <CardContent className="p-6">
            <div className="flex flex-col md:flex-row md:items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                <ShoppingBag className="w-6 h-6 text-primary" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-foreground">
                  USDT Payment (TRC20)
                </h3>
                <p className="text-sm text-muted-foreground">
                  All payments are processed via NOWPayments. After placing an order,
                  you'll receive payment instructions to complete your purchase.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <OrderPaymentDialog
        open={paymentDialogOpen}
        onOpenChange={setPaymentDialogOpen}
        product={pendingProduct}
        onConfirm={handlePaymentConfirm}
        isLoading={purchasing !== null}
      />
    </DashboardLayout>
  );
}
