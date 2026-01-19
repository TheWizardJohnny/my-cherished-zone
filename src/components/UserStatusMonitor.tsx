import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

/**
 * Component to monitor user account status in real-time
 * Automatically signs out users if their account is suspended or blocked
 */
export function UserStatusMonitor() {
  const { user, signOut, checkUserStatus } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    if (!user) return;

    // Initial status check
    const checkStatus = async () => {
      const { status, error } = await checkUserStatus();
      
      if (error) {
        console.error("Error checking status:", error);
        return;
      }

      if (status === "suspended") {
        toast({
          variant: "destructive",
          title: "Account Suspended",
          description: "Your account has been suspended. Please contact the administrator for assistance.",
          duration: 10000,
        });
        await signOut();
        navigate("/auth");
      } else if (status === "inactive") {
        toast({
          variant: "destructive",
          title: "Account Blocked",
          description: "Your account has been blocked. Please contact the administrator for assistance.",
          duration: 10000,
        });
        await signOut();
        navigate("/auth");
      }
    };

    checkStatus();

    // Set up real-time subscription to profile changes
    const channel = supabase
      .channel(`user-status-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'profiles',
          filter: `id=eq.${user.id}`,
        },
        async (payload: { new: { status: string } }) => {
          console.log('Profile updated:', payload);
          
          const newStatus = payload.new.status;
          
          if (newStatus === "suspended") {
            toast({
              variant: "destructive",
              title: "Account Suspended",
              description: "Your account has been suspended. Please contact the administrator for assistance.",
              duration: 10000,
            });
            await signOut();
            navigate("/auth");
          } else if (newStatus === "inactive") {
            toast({
              variant: "destructive",
              title: "Account Blocked",
              description: "Your account has been blocked. Please contact the administrator for assistance.",
              duration: 10000,
            });
            await signOut();
            navigate("/auth");
          }
        }
      )
      .subscribe();

    // Check status every 60 seconds as backup
    const interval = setInterval(checkStatus, 60000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(interval);
    };
  }, [user, checkUserStatus, signOut, navigate, toast]);

  return null; // This component doesn't render anything
}
