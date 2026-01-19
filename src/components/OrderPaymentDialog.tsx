import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface OrderPaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product: { id: string; name: string; price: number } | null;
  onConfirm: (details: PaymentDetails) => void;
  isLoading?: boolean;
}

export interface PaymentDetails {
  deliveryAddress: {
    street: string;
    suburb: string;
    town: string;
    postal_code: string;
    country: string;
  };
  contactNumber: string;
  txId: string;
  systemUsdtAddress: string;
}

export function OrderPaymentDialog({
  open,
  onOpenChange,
  product,
  onConfirm,
  isLoading = false,
}: OrderPaymentDialogProps) {
  const [street, setStreet] = useState("");
  const [suburb, setSuburb] = useState("");
  const [town, setTown] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [country, setCountry] = useState("");
  const [contactNumber, setContactNumber] = useState("");
  const [txId, setTxId] = useState("");
  const [systemUsdtAddress, setSystemUsdtAddress] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      fetchSystemAddress();
    }
  }, [open]);

  const fetchSystemAddress = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("settings")
        .select("value")
        .eq("key", "system_usdt_address")
        .maybeSingle();

      if (error) {
        console.error("Fetch error:", error);
        setSystemUsdtAddress("System address not configured");
      } else if (!data) {
        console.warn("No system_usdt_address found in settings");
        setSystemUsdtAddress("System address not configured");
      } else {
        setSystemUsdtAddress(data.value || "System address not configured");
        console.log("System USDT address loaded:", data.value);
      }
    } catch (error) {
      console.error("Error fetching system address:", error);
      setSystemUsdtAddress("System address not configured");
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = () => {
    if (!street.trim()) {
      alert("Please enter street address");
      return;
    }
    if (!town.trim()) {
      alert("Please enter town");
      return;
    }
    if (!country.trim()) {
      alert("Please enter country");
      return;
    }
    if (!txId.trim()) {
      alert("Please enter transaction ID");
      return;
    }

    onConfirm({
      deliveryAddress: {
        street: street.trim(),
        suburb: suburb.trim(),
        town: town.trim(),
        postal_code: postalCode.trim(),
        country: country.trim(),
      },
      contactNumber: contactNumber.trim(),
      txId: txId.trim(),
      systemUsdtAddress,
    });

    // Reset form
    setStreet("");
    setSuburb("");
    setTown("");
    setPostalCode("");
    setCountry("");
    setContactNumber("");
    setTxId("");
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!isLoading) {
      onOpenChange(newOpen);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Complete Payment Details</DialogTitle>
          <DialogDescription>
            Provide your details and payment information to place the order.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label className="text-sm font-medium">Product</Label>
            <p className="text-foreground font-semibold">{product?.name}</p>
            <p className="text-primary text-lg font-bold">
              ${Number(product?.price || 0).toFixed(2)} USDT
            </p>
          </div>

          <div className="border-t pt-4 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="system-address">Send Payment To (ERC20 - Ethereum)</Label>
              <div className="p-3 rounded-lg bg-muted/50 border border-border">
                <p className="font-mono text-xs break-all text-foreground">
                  {loading ? "Loading..." : systemUsdtAddress}
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="tx-id">Transaction ID (Required)</Label>
              <Input
                id="tx-id"
                placeholder="Enter TX ID from your payment"
                value={txId}
                onChange={(e) => setTxId(e.target.value)}
                className="font-mono text-sm"
              />
            </div>

            <div className="space-y-3 border-t pt-3">
              <Label>Delivery Address (Required)</Label>
              <Input
                placeholder="Street address"
                value={street}
                onChange={(e) => setStreet(e.target.value)}
              />
              <Input
                placeholder="Suburb (optional)"
                value={suburb}
                onChange={(e) => setSuburb(e.target.value)}
              />
              <Input
                placeholder="Town / City"
                value={town}
                onChange={(e) => setTown(e.target.value)}
              />
              <div className="grid grid-cols-2 gap-2">
                <Input
                  placeholder="Postal / ZIP Code"
                  value={postalCode}
                  onChange={(e) => setPostalCode(e.target.value)}
                />
                <Input
                  placeholder="Country"
                  value={country}
                  onChange={(e) => setCountry(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="contact">Contact Number (Optional)</Label>
              <Input
                id="contact"
                type="tel"
                placeholder="Your phone number"
                value={contactNumber}
                onChange={(e) => setContactNumber(e.target.value)}
              />
            </div>
          </div>

          <div className="flex gap-2 pt-4">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => handleOpenChange(false)}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button
              className="flex-1 gradient-primary text-primary-foreground"
              onClick={handleConfirm}
              disabled={isLoading || loading}
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : null}
              Confirm Order
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
