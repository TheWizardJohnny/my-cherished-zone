import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RefreshCw, ShieldCheck, Users, Columns3 } from "lucide-react";

// Local type for user_qualified_rank view (fields as in your view)
type UserQualifiedRank = {
  profile_id: string | null;
  user_id: string | null;
  email: string | null;
  referral_id: string | null;
  rank: string | null;
  status: string | null;
  personal_volume: number | null;
  total_left_volume: number | null;
  total_right_volume: number | null;
};

export function AdminQualificationPanel() {
  const [data, setData] = useState<UserQualifiedRank[]>([]);
  useEffect(() => {
    supabase
      .from("user_qualified_rank")
      .select("*")
      .then(({ data }: { data: UserQualifiedRank[] }) => setData(data || []));
  }, []);
  return (
    <div className="p-4">
      <h2 className="text-xl font-bold mb-2">User Qualification Overview</h2>
      <div className="mb-2 text-sm text-muted-foreground">To earn Binary Commission, a user must have <span className="font-semibold">100 PV points or more</span>.</div>
      <table className="w-full text-sm">
        <thead>
          <tr>
            <th>User Email</th>
            <th>Referral ID</th>
            <th>Rank</th>
            <th>Status</th>
            <th>Personal Volume</th>
            <th>Left Volume</th>
            <th>Right Volume</th>
          </tr>
        </thead>
        <tbody>
          {data.map((row, idx) => (
            <tr key={row.user_id || idx}>
              <td>{row.email || '-'}</td>
              <td>{row.referral_id || '-'}</td>
              <td>{row.rank || '-'}</td>
              <td>{row.status || '-'}</td>
              <td>{row.personal_volume ?? '-'}</td>
              <td>{row.total_left_volume ?? '-'}</td>
              <td>{row.total_right_volume ?? '-'}</td>
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
  user?: { full_name: string | null; email: string | null } | null;
  source?: { full_name: string | null; email: string | null } | null;
  order?: { id: string } | null;
}

export function AdminPV() {
  const [summary, setSummary] = useState<PVSummarized | null>(null);
  const [entries, setEntries] = useState<PVEntry[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      // @ts-expect-error pv_admin_summary is created via migration and not yet in generated types
      const { data: summaryData, error: summaryError } = await supabase.rpc("pv_admin_summary");
      if (summaryError) throw summaryError;
      const summaryRow = (summaryData as unknown as PVSummarized[] | null)?.[0];
      setSummary(summaryRow || { total_pv: 0, left_pv: 0, right_pv: 0, personal_pv: 0, total_entries: 0 });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const client: any = supabase;
      const { data: ledgerData, error: ledgerError } = await (client
        .from("pv_ledger")
        .select(
          `id, amount, leg_side, event_type, note, created_at,
           user:user_id(full_name,email),
           source:source_user_id(full_name,email),
           order:order_id(id)`
        )
        .order("created_at", { ascending: false })
        .limit(50)) as unknown as { data: PVEntry[] | null; error: unknown };

      if (ledgerError) throw ledgerError;
      setEntries((ledgerData as PVEntry[] | null) || []);
    } catch (error) {
      console.error("PV admin load error:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-primary" /> PV Audit
          </h2>
          <p className="text-sm text-muted-foreground">Global PV totals with per-entry audit trail.</p>
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>
          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2 flex items-center justify-between">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total PV</CardTitle>
            <ShieldCheck className="w-4 h-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary?.total_pv?.toLocaleString() || 0}</div>
            <p className="text-xs text-muted-foreground">All legs combined</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2 flex items-center justify-between">
            <CardTitle className="text-sm font-medium text-muted-foreground">Left PV</CardTitle>
            <Columns3 className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary?.left_pv?.toLocaleString() || 0}</div>
            <p className="text-xs text-muted-foreground">Volume routed to left leg</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2 flex items-center justify-between">
            <CardTitle className="text-sm font-medium text-muted-foreground">Right PV</CardTitle>
            <Columns3 className="w-4 h-4 text-muted-foreground rotate-180" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary?.right_pv?.toLocaleString() || 0}</div>
            <p className="text-xs text-muted-foreground">Volume routed to right leg</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2 flex items-center justify-between">
            <CardTitle className="text-sm font-medium text-muted-foreground">Personal PV</CardTitle>
            <Users className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary?.personal_pv?.toLocaleString() || 0}</div>
            <p className="text-xs text-muted-foreground">Directly earned PV</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <div>
            <CardTitle className="text-base font-semibold">Recent PV Entries</CardTitle>
            <p className="text-xs text-muted-foreground">Latest 50 ledger rows</p>
          </div>
          <Badge variant="outline">{summary?.total_entries || 0} entries</Badge>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>User</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Leg</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Source</TableHead>
                <TableHead>Order</TableHead>
                <TableHead>Note</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {entries.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted-foreground py-6">
                    No PV entries yet.
                  </TableCell>
                </TableRow>
              )}
              {entries.map((entry) => (
                <TableRow key={entry.id}>
                  <TableCell className="text-sm text-muted-foreground">
                    {new Date(entry.created_at).toLocaleString()}
                  </TableCell>
                  <TableCell className="text-sm">
                    <div className="flex flex-col">
                      <span className="font-medium">{entry.user?.full_name || "Unknown"}</span>
                      <span className="text-xs text-muted-foreground">{entry.user?.email || "-"}</span>
                    </div>
                  </TableCell>
                  <TableCell className="font-semibold text-primary">{entry.amount.toLocaleString()}</TableCell>
                  <TableCell>
                    <Badge variant="secondary" className="capitalize">{entry.leg_side}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="capitalize">{entry.event_type}</Badge>
                  </TableCell>
                  <TableCell className="text-sm">
                    <div className="flex flex-col">
                      <span>{entry.source?.full_name || "-"}</span>
                      <span className="text-xs text-muted-foreground">{entry.source?.email || ""}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm font-mono">
                    {entry.order?.id ? `${entry.order.id.slice(0, 8)}...` : "-"}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">
                    {entry.note || ""}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
