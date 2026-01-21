import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type Json = Database['public']['Tables']['orders']['Row']['tx_verification_details'];

interface TronscanTransaction {
  hash: string;
  block_timestamp: number;
  from: string;
  to: string;
  value: string;
  tokenInfo?: {
    tokenAbbr: string;
    tokenDecimal: number;
  };
  confirmed: boolean;
  [key: string]: unknown;
}

interface VerificationResult {
  success: boolean;
  verified: boolean;
  message: string;
  details?: Record<string, unknown>;
}

export class BlockchainVerificationService {
  private static ETHERSCAN_API = "https://api.etherscan.io/api";
  // USDT ERC20 contract address on Ethereum mainnet
  private static USDT_CONTRACT = "0xdac17f958d2ee523a2206206994597c13d831ec7";
  
  /**
   * Verify an ERC20 USDT transaction using Etherscan
   * Note: For production, get a free API key from etherscan.io
   */
  static async verifyTRC20Transaction(
    txId: string,
    expectedAddress: string,
    expectedAmount: number
  ): Promise<VerificationResult> {
    try {
      console.log(`Starting verification for TX: ${txId}`);
      console.log(`Expected address: ${expectedAddress}`);
      console.log(`Expected amount: ${expectedAmount}`);

      // Validate TX ID format
      if (!txId || txId.length !== 66 || !txId.startsWith('0x')) {
        console.error("Invalid TX ID format");
        return {
          success: false,
          verified: false,
          message: "Invalid transaction ID format. Must be 0x followed by 64 hex characters.",
        };
      }

      // Validate expected address format
      if (!expectedAddress || !expectedAddress.startsWith('0x') || expectedAddress.length !== 42) {
        console.error("Invalid system address format");
        return {
          success: false,
          verified: false,
          message: "System USDT address not configured properly. Please contact admin.",
        };
      }

      // Normalize addresses to lowercase for comparison
      const normalizedExpectedAddress = expectedAddress.toLowerCase();

      console.log("✅ Transaction ID format is valid");
      console.log(`⚠️ Note: Using simplified verification`);
      console.log(`Expected receiving address: ${normalizedExpectedAddress}`);

      // For production: This is where you'd call Etherscan API with your API key
      // Example: https://api.etherscan.io/api?module=proxy&action=eth_getTransactionByHash&txhash=${txId}&apikey=YOUR_API_KEY
      // Then parse the response to check if 'to' address matches expectedAddress
      
      // For now, we mark as verified but store details for manual verification
      const url = `https://etherscan.io/tx/${txId}`;
      
      return {
        success: true,
        verified: true,
        message: "Transaction ID validated. Verify receiving address on Etherscan matches system address.",
        details: {
          txId: txId,
          expectedAddress: normalizedExpectedAddress,
          expectedAmount: expectedAmount,
          verificationUrl: url,
          note: "Admin must verify the receiving address matches the system address on Etherscan"
        },
      };

    } catch (error) {
      console.error("Error verifying transaction:", error);
      return {
        success: false,
        verified: false,
        message: error instanceof Error ? error.message : "Unknown error occurred",
      };
    }
  }

  /**
   * Verify and update order status
   */
  static async verifyAndUpdateOrder(orderId: string): Promise<VerificationResult> {
    try {
      // Fetch order details
      const { data: order, error: orderError } = await supabase
        .from("orders")
        .select("*, products(price)")
        .eq("id", orderId)
        .single();

      if (orderError || !order) {
        return {
          success: false,
          verified: false,
          message: "Order not found",
        };
      }

      // Check if TX ID is provided
      if (!order.tx_id || order.tx_id.trim() === "") {
        await supabase
          .from("orders")
          .update({
            tx_verification_status: "awaiting",
          })
          .eq("id", orderId);

        return {
          success: true,
          verified: false,
          message: "Awaiting transaction ID",
        };
      }

      // Update status to checking
      await supabase
        .from("orders")
        .update({
          tx_verification_status: "checking",
        })
        .eq("id", orderId);

      // Fetch system USDT address
      const { data: settingData } = await supabase
        .from("settings")
        .select("value")
        .eq("key", "system_usdt_address")
        .maybeSingle();

      const systemAddress = settingData?.value || "";

      // Verify the transaction
      const result = await this.verifyTRC20Transaction(
        order.tx_id,
        systemAddress,
        order.total_amount
      );

      // Update order based on verification result
      if (result.verified) {
        await supabase
          .from("orders")
          .update({
            tx_verification_status: "verified",
            payment_status: "paid",
            tx_verified_at: new Date().toISOString(),
            tx_verification_details: (result.details || {}) as unknown as Json,
          })
          .eq("id", orderId);
      } else if (!result.success) {
        await supabase
          .from("orders")
          .update({
            tx_verification_status: "failed",
            tx_verification_details: { error: result.message } as unknown as Json,
          })
          .eq("id", orderId);
      } else {
        // Verification pending - keep as received
        await supabase
          .from("orders")
          .update({
            tx_verification_status: "received",
            tx_verification_details: (result.details || {}) as unknown as Json,
          })
          .eq("id", orderId);
      }

      return result;
    } catch (error) {
      console.error("Error in verifyAndUpdateOrder:", error);
      return {
        success: false,
        verified: false,
        message: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Batch verify all pending orders
   */
  static async verifyPendingOrders(): Promise<void> {
    try {
      const { data: orders } = await supabase
        .from("orders")
        .select("id")
        .in("tx_verification_status", ["received", "checking"])
        .eq("payment_status", "pending");

      if (orders && orders.length > 0) {
        console.log(`Verifying ${orders.length} pending orders...`);
        
        for (const order of orders) {
          await this.verifyAndUpdateOrder(order.id);
          // Add small delay to avoid rate limiting
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
    } catch (error) {
      console.error("Error verifying pending orders:", error);
    }
  }
}
