import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { ShoppingBag, Package, Zap, Crown, Loader2, Check } from "lucide-react";

interface Product {
  id: string;
  name: string;
  description: string | null;
  price: number;
  pv_value: number;
  image_url: string | null;
}

export default function Shop() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    try {
      const { data } = await supabase
        .from("products")
        .select("*")
        .eq("active", true)
        .order("price", { ascending: true });

      if (data) {
        setProducts(data);
      }
    } catch (error) {
      console.error("Error fetching products:", error);
    } finally {
      setLoading(false);
    }
  };

  const handlePurchase = async (product: Product) => {
    setPurchasing(product.id);

    try {
      // Get user profile
      const { data: profileData } = await supabase
        .from("profiles")
        .select("id")
        .eq("user_id", user?.id)
        .single();

      if (!profileData) throw new Error("Profile not found");

      // Create order
      const { error } = await supabase.from("orders").insert({
        user_id: profileData.id,
        product_id: product.id,
        quantity: 1,
        total_amount: product.price,
        pv_earned: product.pv_value,
        payment_status: "pending",
      });

      if (error) throw error;

      toast({
        title: "Order created!",
        description: "Your order has been placed. Complete payment to activate.",
      });

      navigate("/dashboard/orders");
    } catch (error) {
      console.error("Purchase error:", error);
      toast({
        variant: "destructive",
        title: "Purchase failed",
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
                    {index >= 1 && (
                      <div className="flex items-center gap-2 text-sm">
                        <Check className="w-4 h-4 text-success" />
                        <span className="text-foreground">Priority support</span>
                      </div>
                    )}
                    {index === 2 && (
                      <div className="flex items-center gap-2 text-sm">
                        <Check className="w-4 h-4 text-success" />
                        <span className="text-foreground">VIP webinars</span>
                      </div>
                    )}
                  </div>
                </CardContent>
                <CardFooter>
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
                    Get Started
                  </Button>
                </CardFooter>
              </Card>
            );
          })}
        </div>

        {/* Info Card */}
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
    </DashboardLayout>
  );
}
