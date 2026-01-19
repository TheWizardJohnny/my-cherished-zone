import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Label } from "@/components/ui/label";
import { Search, Shield, ShieldOff, MoreVertical, UserX, Ban, Trash2, UserCheck, ArrowUpRight, Edit } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import type { Tables } from "@/integrations/supabase/types";

type Profile = Tables<"profiles">;

interface ConfirmationDialog {
  open: boolean;
  type: 'suspend' | 'block' | 'erase' | 'admin' | 'remove-admin' | null;
  user: Profile | null;
  requirePassword: boolean;
}

interface EditDialog {
  open: boolean;
  user: Profile | null;
  referralId: string;
  placementPosition: string; // 'left' | 'right' | ''
  placementUplinesReferralId: string;
  referrerReferralId: string;
}

export function AdminUsers() {
  const [users, setUsers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [adminUserIds, setAdminUserIds] = useState<string[]>([]);
  const [confirmDialog, setConfirmDialog] = useState<ConfirmationDialog>({
    open: false,
    type: null,
    user: null,
    requirePassword: false,
  });
  const [adminPassword, setAdminPassword] = useState("");
  const [editDialog, setEditDialog] = useState<EditDialog>({
    open: false,
    user: null,
    referralId: "",
    placementPosition: "",
    placementUplinesReferralId: "",
    referrerReferralId: "",
  });
  const [availableSponsors, setAvailableSponsors] = useState<Profile[]>([]);
  const [placements, setPlacements] = useState<{ [userId: string]: Tables<"placements"> }>({});
  const [referrals, setReferrals] = useState<{ [userId: string]: Tables<"referrals"> }>({});

  useEffect(() => {
    fetchUsers();
    fetchAdminUsers();
    
    // Set up real-time subscription for profile changes
    const profilesChannel = supabase
      .channel('admin-profiles-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'profiles'
        },
        (payload) => {
          console.log('Profile changed:', payload);
          // Refetch users to get updated data with joins
          fetchUsers();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(profilesChannel);
    };
  }, []);

  const fetchUsers = async () => {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setUsers(data || []);
      
      // Set available sponsors for lookup in table (filter out users without referral IDs)
      const validSponsors = (data || []).filter(p => p.referral_id && p.referral_id.trim() !== "");
      setAvailableSponsors(validSponsors);
      
      // Fetch placements
      const { data: placementsData, error: placementsError } = await supabase
        .from("placements")
        .select("*");
      
      const placementsMap: { [key: string]: Tables<"placements"> } = {};
      if (!placementsError && placementsData) {
        placementsData.forEach((p: Tables<"placements">) => {
          placementsMap[p.user_id] = p;
        });
      }
      setPlacements(placementsMap);
      
      // Fetch referrals - handle 404 gracefully
      const { data: referralsData, error: referralsError } = await supabase
        .from("referrals")
        .select("*");
      
      if (referralsError) {
        console.warn("Warning: Could not fetch referrals:", referralsError);
      }
      
      const referralsMap: { [key: string]: Tables<"referrals"> } = {};
      if (!referralsError && referralsData) {
        referralsData.forEach((r: Tables<"referrals">) => {
          referralsMap[r.referred_user_id] = r;
        });
      }
      setReferrals(referralsMap);
    } catch (error) {
      console.error("Error fetching users:", error);
      toast({
        title: "Error",
        description: "Failed to fetch users",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchAdminUsers = async () => {
    try {
      const { data, error } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "admin");

      if (error) throw error;
      setAdminUserIds((data || []).map(r => r.user_id));
    } catch (error) {
      console.error("Error fetching admin users:", error);
    }
  };

  const toggleAdminRole = async (userId: string, isCurrentlyAdmin: boolean) => {
    try {
      if (isCurrentlyAdmin) {
        const { error } = await supabase
          .from("user_roles")
          .delete()
          .eq("user_id", userId)
          .eq("role", "admin");

        if (error) throw error;
        setAdminUserIds(prev => prev.filter(id => id !== userId));
        toast({
          title: "Success",
          description: "Admin role removed",
        });
      } else {
        const { error } = await supabase
          .from("user_roles")
          .insert({ user_id: userId, role: "admin" });

        if (error) throw error;
        setAdminUserIds(prev => [...prev, userId]);
        toast({
          title: "Success",
          description: "Admin role granted",
        });
      }
    } catch (error) {
      console.error("Error toggling admin role:", error);
      toast({
        title: "Error",
        description: "Failed to update admin role",
        variant: "destructive",
      });
    }
  };

  const handleSuspendUser = async (userId: string) => {
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ status: "suspended" })
        .eq("id", userId);

      if (error) throw error;
      
      toast({
        title: "User Suspended",
        description: "User account has been suspended",
      });
      fetchUsers();
    } catch (error) {
      console.error("Error suspending user:", error);
      toast({
        title: "Error",
        description: "Failed to suspend user",
        variant: "destructive",
      });
    }
  };

  const handleBlockUser = async (userId: string) => {
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ status: "inactive" })
        .eq("id", userId);

      if (error) throw error;
      
      toast({
        title: "User Blocked",
        description: "User account has been blocked",
      });
      fetchUsers();
    } catch (error) {
      console.error("Error blocking user:", error);
      toast({
        title: "Error",
        description: "Failed to block user",
        variant: "destructive",
      });
    }
  };

  const handleEraseUser = async (userId: string, userAuthId: string) => {
    try {
      // Verify admin password by attempting to sign in
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      if (!currentUser?.email) {
        throw new Error("Not authenticated");
      }

      // Try to verify password
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: currentUser.email,
        password: adminPassword,
      });

      if (signInError) {
        toast({
          title: "Invalid Password",
          description: "Admin password is incorrect",
          variant: "destructive",
        });
        return;
      }

      // Delete user profile (cascade will handle related records)
      const { error: deleteProfileError } = await supabase
        .from("profiles")
        .delete()
        .eq("id", userId);

      if (deleteProfileError) throw deleteProfileError;

      // Delete from user_roles
      await supabase
        .from("user_roles")
        .delete()
        .eq("user_id", userAuthId);

      toast({
        title: "User Erased",
        description: "User account and all data have been permanently deleted",
      });
      
      setAdminPassword("");
      fetchUsers();
    } catch (error) {
      console.error("Error erasing user:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to erase user",
        variant: "destructive",
      });
    }
  };

  const openConfirmDialog = (type: ConfirmationDialog['type'], user: Profile) => {
    setConfirmDialog({
      open: true,
      type,
      user,
      requirePassword: type === 'erase',
    });
    setAdminPassword("");
  };

  const closeConfirmDialog = () => {
    setConfirmDialog({
      open: false,
      type: null,
      user: null,
      requirePassword: false,
    });
    setAdminPassword("");
  };

  const handleConfirmAction = async () => {
    if (!confirmDialog.user) return;

    if (confirmDialog.type === 'erase' && !adminPassword) {
      toast({
        title: "Password Required",
        description: "Please enter your admin password",
        variant: "destructive",
      });
      return;
    }

    switch (confirmDialog.type) {
      case 'suspend':
        await handleSuspendUser(confirmDialog.user.id);
        break;
      case 'block':
        await handleBlockUser(confirmDialog.user.id);
        break;
      case 'erase':
        await handleEraseUser(confirmDialog.user.id, confirmDialog.user.user_id);
        break;
      case 'admin':
        await toggleAdminRole(confirmDialog.user.user_id, false);
        break;
      case 'remove-admin':
        await toggleAdminRole(confirmDialog.user.user_id, true);
        break;
    }

    closeConfirmDialog();
  };

  const openEditDialog = async (user: Profile) => {
    try {
      // Fetch all users for dropdowns
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .order("full_name", { ascending: true });

      if (error) throw error;
      
      // Filter out current user and users without valid referral_ids
      const filteredUsers = (data || []).filter(
        p => p.id !== user.id && p.referral_id && p.referral_id.trim() !== ""
      );
      setAvailableSponsors(filteredUsers);
      
      // Get placement info for this user
      const placement = placements[user.id];
      const referral = referrals[user.id];
      
      // Fetch the upline and referrer user info to get their referral IDs
      let placementUplinesReferralId = "";
      let referrerReferralId = "";
      
      if (placement?.upline_id) {
        const { data: uplinesData } = await supabase
          .from("profiles")
          .select("referral_id")
          .eq("id", placement.upline_id)
          .single();
        placementUplinesReferralId = uplinesData?.referral_id || "";
      }
      
      if (referral?.referrer_id) {
        const { data: referrerData } = await supabase
          .from("profiles")
          .select("referral_id")
          .eq("id", referral.referrer_id)
          .single();
        referrerReferralId = referrerData?.referral_id || "";
      }
      
      setEditDialog({
        open: true,
        user,
        referralId: user.referral_id || "",
        placementPosition: placement?.position ? placement.position : "unplaced",
        placementUplinesReferralId,
        referrerReferralId,
      });
    } catch (error) {
      console.error("Error opening edit dialog:", error);
      toast({
        title: "Error",
        description: "Failed to load edit dialog data",
        variant: "destructive",
      });
    }
  };

  const closeEditDialog = () => {
    setEditDialog({
      open: false,
      user: null,
      referralId: "",
      placementPosition: "",
      placementUplinesReferralId: "",
      referrerReferralId: "",
    });
    setAvailableSponsors([]);
  };

  const handleSaveReferralInfo = async () => {
    if (!editDialog.user) return;

    try {
      let hasChanges = false;
      
      // 1. Update referral ID in profiles if changed
      if (editDialog.referralId && editDialog.referralId !== editDialog.user.referral_id) {
        const { data: existing } = await supabase
          .from("profiles")
          .select("id")
          .eq("referral_id", editDialog.referralId)
          .neq("id", editDialog.user.id)
          .maybeSingle();

        if (existing) {
          toast({
            title: "Error",
            description: "This referral ID is already in use",
            variant: "destructive",
          });
          return;
        }
        
        const { error } = await supabase
          .from("profiles")
          .update({ referral_id: editDialog.referralId })
          .eq("id", editDialog.user.id);
          
        if (error) throw error;
        hasChanges = true;
      }
      
      // 2. Update placement (binary structure)
      // Get current upline's referral_id if placement exists
      let currentUplinesReferralId = "";
      const currentPlacement = placements[editDialog.user.id];
      if (currentPlacement?.upline_id) {
        const currentUplinesProfile = availableSponsors.find(s => s.id === currentPlacement.upline_id);
        currentUplinesReferralId = currentUplinesProfile?.referral_id || "";
      }
      
      if (editDialog.placementUplinesReferralId !== currentUplinesReferralId) {
        const placement = placements[editDialog.user.id];
        
        // Convert "unplaced" to empty string for database
        const positionValue = editDialog.placementPosition === "unplaced" ? "" : editDialog.placementPosition;
        
        if (editDialog.placementUplinesReferralId) {
          // Find the upline user by referral ID
          const { data: uplinesUser } = await supabase
            .from("profiles")
            .select("id")
            .eq("referral_id", editDialog.placementUplinesReferralId)
            .single();
            
          if (!uplinesUser) {
            toast({
              title: "Error",
              description: "Upline user not found",
              variant: "destructive",
            });
            return;
          }
          
          if (placement) {
            // Update existing placement
            const { error } = await supabase
              .from("placements")
              .update({
                upline_id: uplinesUser.id,
                position: positionValue,
                status: positionValue ? "placed" : "unplaced"
              })
              .eq("id", placement.id);
              
            if (error) throw error;
          } else {
            // Create new placement
            const { error } = await supabase
              .from("placements")
              .insert({
                user_id: editDialog.user.id,
                upline_id: uplinesUser.id,
                position: positionValue,
                status: positionValue ? "placed" : "unplaced"
              });
              
            if (error) throw error;
          }
          hasChanges = true;
        } else if (placement) {
          // Remove placement
          const { error } = await supabase
            .from("placements")
            .update({
              upline_id: null,
              position: null,
              status: "unplaced"
            })
            .eq("id", placement.id);
            
          if (error) throw error;
          hasChanges = true;
        }
      } else if (editDialog.placementPosition !== (placements[editDialog.user.id]?.position || "")) {
        // Just update position
        const placement = placements[editDialog.user.id];
        const positionValue = editDialog.placementPosition === "unplaced" ? "" : editDialog.placementPosition;
        
        if (placement) {
          const { error } = await supabase
            .from("placements")
            .update({
              position: positionValue,
              status: positionValue ? "placed" : "unplaced"
            })
            .eq("id", placement.id);
            
          if (error) throw error;
          hasChanges = true;
        }
      }
      
      // 3. Update referrer (who referred this user)
      const currentReferral = referrals[editDialog.user.id];
      let currentReferrerReferralId = "";
      
      if (currentReferral?.referrer_id) {
        const { data: currentReferrerData } = await supabase
          .from("profiles")
          .select("referral_id")
          .eq("id", currentReferral.referrer_id)
          .single();
        currentReferrerReferralId = currentReferrerData?.referral_id || "";
      }
      
      if (editDialog.referrerReferralId !== currentReferrerReferralId) {
        if (editDialog.referrerReferralId) {
          // Find the referrer by referral ID
          const { data: referrerUser } = await supabase
            .from("profiles")
            .select("id")
            .eq("referral_id", editDialog.referrerReferralId)
            .single();
            
          if (!referrerUser) {
            toast({
              title: "Error",
              description: "Referrer user not found",
              variant: "destructive",
            });
            return;
          }
          
          const referral = referrals[editDialog.user.id];
          
          if (referral) {
            // Update existing referral
            const { error } = await supabase
              .from("referrals")
              .update({ referrer_id: referrerUser.id })
              .eq("id", referral.id);
              
            if (error) throw error;
          } else {
            // Create new referral
            const { error } = await supabase
              .from("referrals")
              .insert({
                referred_user_id: editDialog.user.id,
                referrer_id: referrerUser.id
              });
              
            if (error) throw error;
          }
          hasChanges = true;
        } else if (referrals[editDialog.user.id]) {
          // Remove referral
          const { error } = await supabase
            .from("referrals")
            .delete()
            .eq("id", referrals[editDialog.user.id].id);
            
          if (error) throw error;
          hasChanges = true;
        }
      }

      if (!hasChanges) {
        toast({
          title: "No Changes",
          description: "No changes were made",
        });
        closeEditDialog();
        return;
      }

      toast({
        title: "Success",
        description: "Referral and placement information updated successfully",
      });
      
      closeEditDialog();
      fetchUsers();
    } catch (error: unknown) {
      console.error("Error updating referral info:", error);
      
      const err = error as { message?: string; details?: string; hint?: string; code?: string };
      console.error("Error details:", {
        message: err?.message,
        details: err?.details,
        hint: err?.hint,
        code: err?.code
      });
      
      let errorMessage = "Failed to update information";
      if (err?.message) {
        errorMessage = err.message;
      }
      if (err?.hint) {
        errorMessage += ` (${err.hint})`;
      }
      
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    }
  };

  const getDialogContent = () => {
    const userName = confirmDialog.user?.full_name || confirmDialog.user?.email || "this user";
    
    switch (confirmDialog.type) {
      case 'suspend':
        return {
          title: "Suspend User",
          description: `Are you sure you want to suspend ${userName}? They will not be able to access their account until reactivated.`,
        };
      case 'block':
        return {
          title: "Block User",
          description: `Are you sure you want to block ${userName}? This will prevent them from accessing the platform.`,
        };
      case 'erase':
        return {
          title: "Erase User - Permanent Action",
          description: `⚠️ WARNING: This will permanently delete ${userName} and ALL associated data including orders, commissions, and network relationships. This action CANNOT be undone.`,
        };
      case 'admin':
        return {
          title: "Grant Admin Access",
          description: `Grant admin privileges to ${userName}? They will have full access to all admin features.`,
        };
      case 'remove-admin':
        return {
          title: "Remove Admin Access",
          description: `Remove admin privileges from ${userName}? They will lose access to admin features.`,
        };
      default:
        return { title: "", description: "" };
    }
  };

  const filteredUsers = users.filter(user =>
    user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.full_name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

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
      <TooltipProvider>
        <Card>
          <CardHeader>
            <CardTitle>User Management</CardTitle>
            <div className="relative mt-4">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search users by email or name..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Referral ID</TableHead>
                  <TableHead>Referred By</TableHead>
                  <TableHead>Direct Upline</TableHead>
                  <TableHead>Rank</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Joined</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUsers.map((user) => {
                  const isUserAdmin = adminUserIds.includes(user.user_id);
                  const referral = referrals[user.id];
                  const placement = placements[user.id];
                  
                  // Get the referrer user info
                  const referrerInfo = referral ? availableSponsors.find(s => s.id === referral.referrer_id) : null;
                  
                  // Get the placement upline info
                  const uplinesInfo = placement?.upline_id ? availableSponsors.find(s => s.id === placement.upline_id) : null;
                  
                  return (
                    <TableRow key={user.id}>
                      <TableCell className="font-medium">{user.email}</TableCell>
                      <TableCell>{user.full_name || "-"}</TableCell>
                      <TableCell>
                        <code className="px-2 py-1 bg-muted rounded text-xs font-mono text-primary">
                          {user.referral_id || "N/A"}
                        </code>
                      </TableCell>
                      <TableCell>
                        {referrerInfo ? (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div className="text-xs cursor-help hover:bg-muted/50 rounded p-1 transition-colors">
                                <div className="font-medium flex items-center gap-1">
                                  {referrerInfo.full_name || referrerInfo.email}
                                  <ArrowUpRight className="w-3 h-3 text-blue-500" />
                                </div>
                                <code className="text-muted-foreground">ID: {referrerInfo.referral_id}</code>
                              </div>
                            </TooltipTrigger>
                            <TooltipContent side="right" className="max-w-xs">
                              <div className="space-y-1">
                                <p className="font-semibold">Referrer (Direct Commissions)</p>
                                <p className="text-xs">{referrerInfo.email}</p>
                                <p className="text-xs text-muted-foreground">
                                  {referrerInfo.full_name || referrerInfo.email} receives direct commissions from this user's purchases
                                </p>
                              </div>
                            </TooltipContent>
                          </Tooltip>
                        ) : (
                          <span className="text-muted-foreground text-xs">Direct signup</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {uplinesInfo ? (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div className="text-xs cursor-help hover:bg-muted/50 rounded p-1 transition-colors">
                                <div className="font-medium flex items-center gap-1">
                                  {uplinesInfo.full_name || uplinesInfo.email}
                                  <ArrowUpRight className="w-3 h-3 text-purple-500" />
                                </div>
                                <code className="text-muted-foreground">ID: {uplinesInfo.referral_id} - {placement?.position?.toUpperCase() || "—"}</code>
                              </div>
                            </TooltipTrigger>
                            <TooltipContent side="right" className="max-w-xs">
                              <div className="space-y-1">
                                <p className="font-semibold">Binary Placement Upline</p>
                                <p className="text-xs">{uplinesInfo.email}</p>
                                <p className="text-xs text-muted-foreground">
                                  Placed on {placement?.position} side under {uplinesInfo.full_name || uplinesInfo.email} in binary structure
                                </p>
                              </div>
                            </TooltipContent>
                          </Tooltip>
                        ) : (
                          <span className="text-muted-foreground text-xs">Unplaced</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{user.rank || "Member"}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={user.status === "active" ? "default" : "secondary"}
                        >
                          {user.status || "pending"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {new Date(user.created_at).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={() => openEditDialog(user)}
                              className="text-blue-600"
                            >
                              <Edit className="h-4 w-4 mr-2" />
                              Edit Referral Info
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            {user.status !== "suspended" && (
                              <DropdownMenuItem
                                onClick={() => openConfirmDialog('suspend', user)}
                                className="text-orange-600"
                              >
                                <UserX className="h-4 w-4 mr-2" />
                                Suspend
                              </DropdownMenuItem>
                            )}
                            {user.status !== "inactive" && (
                              <DropdownMenuItem
                                onClick={() => openConfirmDialog('block', user)}
                                className="text-yellow-600"
                              >
                                <Ban className="h-4 w-4 mr-2" />
                                Block
                              </DropdownMenuItem>
                            )}
                            {user.status === "suspended" || user.status === "inactive" ? (
                              <DropdownMenuItem
                                onClick={async () => {
                                  const { error } = await supabase
                                    .from("profiles")
                                    .update({ status: "active" })
                                    .eq("id", user.id);
                                  if (!error) {
                                    toast({ title: "Success", description: "User reactivated" });
                                    fetchUsers();
                                  }
                                }}
                                className="text-green-600"
                              >
                                <UserCheck className="h-4 w-4 mr-2" />
                                Reactivate
                              </DropdownMenuItem>
                            ) : null}
                            <DropdownMenuSeparator />
                            {isUserAdmin ? (
                              <DropdownMenuItem
                                onClick={() => openConfirmDialog('remove-admin', user)}
                              >
                                <ShieldOff className="h-4 w-4 mr-2" />
                                Remove Admin
                              </DropdownMenuItem>
                            ) : (
                              <DropdownMenuItem
                                onClick={() => openConfirmDialog('admin', user)}
                              >
                                <Shield className="h-4 w-4 mr-2" />
                                Make Admin
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() => openConfirmDialog('erase', user)}
                              className="text-red-600 font-semibold"
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Erase User
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
      </TooltipProvider>

      {/* Confirmation Dialog */}
      <AlertDialog open={confirmDialog.open} onOpenChange={closeConfirmDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{getDialogContent().title}</AlertDialogTitle>
            <AlertDialogDescription className="space-y-4">
              <p>{getDialogContent().description}</p>
              {confirmDialog.requirePassword && (
                <div className="space-y-2 pt-4">
                  <Label htmlFor="admin-password">Enter Admin Password</Label>
                  <Input
                    id="admin-password"
                    type="password"
                    placeholder="Admin password"
                    value={adminPassword}
                    onChange={(e) => setAdminPassword(e.target.value)}
                    className="mt-2"
                  />
                  <p className="text-xs text-muted-foreground">
                    Password verification required for this critical action
                  </p>
                </div>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmAction}
              className={confirmDialog.type === 'erase' ? 'bg-destructive hover:bg-destructive/90' : ''}
            >
              Confirm
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Edit Referral & Placement Info Dialog */}
      <Dialog open={editDialog.open} onOpenChange={closeEditDialog}>
        <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Referral & Binary Placement</DialogTitle>
            <DialogDescription>
              Update information for {editDialog.user?.email}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-6 py-4">
            {/* Referral ID Section */}
            <div className="space-y-2">
              <Label htmlFor="referral-id" className="font-semibold">Referral ID</Label>
              <Input
                id="referral-id"
                value={editDialog.referralId}
                onChange={(e) => setEditDialog(prev => ({ ...prev, referralId: e.target.value.toUpperCase() }))}
                placeholder="e.g., ABCD1234"
                maxLength={8}
                className="font-mono"
              />
              <p className="text-xs text-muted-foreground">
                Unique 8-character identifier for this user
              </p>
            </div>

            {/* Referrer Section (Commission Structure) */}
            <div className="border-t pt-4 space-y-2">
              <Label className="font-semibold text-blue-600">Referrer (Direct Commissions)</Label>
              <p className="text-xs text-muted-foreground mb-2">
                Who referred this user? They receive direct commissions from their purchases.
              </p>
              <Select
                value={editDialog.referrerReferralId}
                onValueChange={(value) => setEditDialog(prev => ({ ...prev, referrerReferralId: value === "none" ? "" : value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select referrer (optional)" />
                </SelectTrigger>
                <SelectContent className="max-h-[250px]">
                  <SelectItem value="none">None (Direct signup)</SelectItem>
                  {availableSponsors.map((user) => 
                    user.referral_id ? (
                      <SelectItem key={user.id} value={user.referral_id}>
                        {user.full_name || user.email} ({user.referral_id})
                      </SelectItem>
                    ) : null
                  )}
                </SelectContent>
              </Select>
            </div>

            {/* Binary Placement Section */}
            <div className="border-t pt-4 space-y-3">
              <Label className="font-semibold text-purple-600">Binary Placement Structure</Label>
              <p className="text-xs text-muted-foreground">
                Where is this user placed in the binary MLM tree? (Left or Right position)
              </p>
              
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="placement-upline">Placement Upline</Label>
                  <Select
                    value={editDialog.placementUplinesReferralId}
                    onValueChange={(value) => setEditDialog(prev => ({ ...prev, placementUplinesReferralId: value === "none" ? "" : value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select upline" />
                    </SelectTrigger>
                    <SelectContent className="max-h-[250px]">
                      <SelectItem value="none">Unplaced</SelectItem>
                      {availableSponsors.map((user) => 
                        user.referral_id ? (
                          <SelectItem key={user.id} value={user.referral_id}>
                            {user.full_name || user.email} ({user.referral_id})
                          </SelectItem>
                        ) : null
                      )}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="placement-position">Position</Label>
                  <Select
                    value={editDialog.placementPosition}
                    onValueChange={(value) => setEditDialog(prev => ({ ...prev, placementPosition: value }))}
                    disabled={!editDialog.placementUplinesReferralId}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select position" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="unplaced">Unplaced</SelectItem>
                      <SelectItem value="left">Left Side</SelectItem>
                      <SelectItem value="right">Right Side</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeEditDialog}>
              Cancel
            </Button>
            <Button onClick={handleSaveReferralInfo}>
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
