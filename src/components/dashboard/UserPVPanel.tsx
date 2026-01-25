import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { RefreshCw, BarChart3 } from "lucide-react";
import { Button } from "@/components/ui/button";
// Removed duplicate import of useEffect, useState
// import { supabase } from "@/integrations/supabase";
// Fixed import path:
// import { supabase } from "@/integrations/supabase/client";

export function UserQualificationPanel({ userId }: { userId: string }) {
  const [rank, setRank] = useState<string>("");
  const [eligibility, setEligibility] = useState<any[]>([]);
  useEffect(() => {
    supabase
      .from("user_qualified_rank")
      .select("qualified_rank")
      .eq("user_id", userId)
      .single()
      .then(({ data }) => setRank(data?.qualified_rank || ""));
    supabase
      .from("user_commission_eligibility")
      .select("commission_type, is_eligible")
      .eq("user_id", userId)
      .then(({ data }) => setEligibility(data || []));
  }, [userId]);
  return (
    <div className="p-4">
      <h2 className="text-lg font-bold mb-2">Your Qualification Status</h2>
      <div className="mb-2 text-sm text-muted-foreground">To earn Binary Commission, you must have <span className="font-semibold">100 PV points or more</span>.</div>
      <div className="mb-2">Qualified Rank: <span className="font-semibold">{rank}</span></div>
      <table className="w-full text-sm">
        <thead>
          <tr>
            <th>Commission Type</th>
            <th>Eligible?</th>
          </tr>
        </thead>
        <tbody>
          {eligibility.map((row) => (
            <tr key={row.commission_type}>
              <td>{row.commission_type}</td>
              <td>{row.is_eligible ? "✅" : "❌"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

interface PVSummarized {
  total_pv: number;
  left_pv: number;
  right_pv: number;
  personal_pv: number;
  total_entries: number;
}

interface PVEntry {
  id: string;
  amount: number;
  leg_side: string;
  event_type: string;
  note: string | null;
  created_at: string;
  source?: { full_name: string | null; email: string | null } | null;
  order?: { id: string } | null;
}

interface UserPVPanelProps {
  profileId: string | null;
}

export function UserPVPanel({ profileId }: UserPVPanelProps) {
  const [summary, setSummary] = useState<PVSummarized | null>(null);
  const [entries, setEntries] = useState<PVEntry[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!profileId) return;
    setLoading(true);
    try {
      // @ts-expect-error pv_user_summary is created via migration and not yet in generated types
      const { data: summaryData, error: summaryError } = await supabase.rpc("pv_user_summary", { p_profile_id: profileId });
      if (summaryError) throw summaryError;
      const summaryRow = (summaryData as unknown as PVSummarized[] | null)?.[0];
      setSummary(summaryRow || { total_pv: 0, left_pv: 0, right_pv: 0, personal_pv: 0, total_entries: 0 });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const client: any = supabase;
      const { data: ledgerData, error: ledgerError } = await (client
        .from("pv_ledger")
        .select(`id, amount, leg_side, event_type, note, created_at,
          source:source_user_id(full_name,email),
          order:order_id(id)`)
        .eq("user_id", profileId)
        .order("created_at", { ascending: false })
        .limit(10) as unknown as { data: PVEntry[] | null; error: unknown });

      if (ledgerError) throw ledgerError;
      setEntries((ledgerData as PVEntry[] | null) || []);
    } catch (error) {
      console.error("PV user load error:", error);
    } finally {
      setLoading(false);
    }
  }, [profileId]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <Card className="bg-card border-border/50">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <div className="flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-primary" />
          <CardTitle className="text-base">Your PV</CardTitle>
        </div>
        <Button variant="ghost" size="sm" onClick={load} disabled={loading}>
          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="p-3 rounded-lg bg-muted/50 border border-border/60">
            <p className="text-xs text-muted-foreground">Total PV</p>
            <p className="text-xl font-bold">{summary?.total_pv?.toLocaleString() || 0}</p>
          </div>
          <div className="p-3 rounded-lg bg-muted/50 border border-border/60">
            <p className="text-xs text-muted-foreground">Left PV</p>
            <p className="text-xl font-bold">{summary?.left_pv?.toLocaleString() || 0}</p>
          </div>
          <div className="p-3 rounded-lg bg-muted/50 border border-border/60">
            <p className="text-xs text-muted-foreground">Right PV</p>
            <p className="text-xl font-bold">{summary?.right_pv?.toLocaleString() || 0}</p>
          </div>
          <div className="p-3 rounded-lg bg-muted/50 border border-border/60">
            <p className="text-xs text-muted-foreground">Personal PV</p>
            <p className="text-xl font-bold">{summary?.personal_pv?.toLocaleString() || 0}</p>
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold">Recent PV Credits</p>
            <Badge variant="outline">{summary?.total_entries || 0} total</Badge>
          </div>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Leg</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Order</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entries.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground py-6">
                      No PV entries yet.
                    </TableCell>
                  </TableRow>
                )}
                {entries.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(entry.created_at).toLocaleString()}
                    </TableCell>
                    <TableCell className="font-semibold text-primary">{entry.amount.toLocaleString()}</TableCell>
                    <TableCell><Badge variant="secondary" className="capitalize">{entry.leg_side}</Badge></TableCell>
                    <TableCell><Badge variant="outline" className="capitalize">{entry.event_type}</Badge></TableCell>
                    <TableCell className="text-sm">
                      <div className="flex flex-col">
                        <span>{entry.source?.full_name || "-"}</span>
                        <span className="text-xs text-muted-foreground">{entry.source?.email || ""}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm font-mono">
                      {entry.order?.id ? `${entry.order.id.slice(0, 8)}...` : "-"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
