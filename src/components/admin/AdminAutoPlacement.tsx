import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Clock, Play, RefreshCw, CheckCircle2 } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

interface AutoPlacementResult {
  placed_user_id: string;
  referrer_id: string;
  user_email: string;
  hours_overdue: number;
}

export function AdminAutoPlacement() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<AutoPlacementResult[]>([]);
  const [lastRun, setLastRun] = useState<Date | null>(null);

  const triggerAutoPlacement = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc(
        // @ts-expect-error: RPC function not in generated types yet
        'auto_place_overdue_referrals'
      );

      if (error) throw error;

      const resultData = (data as unknown as AutoPlacementResult[]) || [];
      const placedCount = resultData.length;
      setResults(resultData);
      setLastRun(new Date());

      toast({
        title: "Auto-Placement Complete",
        description: `Successfully placed ${placedCount} overdue referral${placedCount !== 1 ? 's' : ''}`,
      });
    } catch (error: unknown) {
      const err = error as { message?: string };
      toast({
        title: "Error",
        description: err.message || "Failed to run auto-placement",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Control Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Clock className="w-5 h-5" />
                Auto-Placement System
              </CardTitle>
              <CardDescription>
                Automatically places unplaced referrals after 48 hours using auto-placement strategy
              </CardDescription>
            </div>
            <Button
              onClick={triggerAutoPlacement}
              disabled={loading}
              className="gap-2"
            >
              {loading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Running...
                </>
              ) : (
                <>
                  <Play className="w-4 h-4" />
                  Run Now
                </>
              )}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-6 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4" />
              <span>
                Last run: {lastRun ? lastRun.toLocaleString() : "Never"}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4" />
              <span>Checks for referrals older than 48 hours</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Results Card */}
      {results.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Latest Auto-Placement Results</CardTitle>
            <CardDescription>
              {results.length} user{results.length !== 1 ? 's' : ''} placed in this run
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User Email</TableHead>
                  <TableHead>Hours Overdue</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {results.map((result, idx) => (
                  <TableRow key={idx}>
                    <TableCell className="font-medium">{result.user_email}</TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {Math.round(result.hours_overdue)} hours late
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge className="bg-green-500">
                        <CheckCircle2 className="w-3 h-3 mr-1" />
                        Placed
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Info Card */}
      <Card>
        <CardHeader>
          <CardTitle>Setup Instructions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <div>
            <h4 className="font-semibold mb-2">Automatic Scheduling (Recommended)</h4>
            <p className="text-muted-foreground mb-2">
              For production, set up a cron job to run this automatically every hour:
            </p>
            <div className="bg-muted p-3 rounded-lg font-mono text-xs">
              <pre>
{`-- Enable pg_cron extension in Supabase
SELECT cron.schedule(
  'auto-place-overdue-referrals',
  '0 * * * *',
  $$ SELECT public.auto_place_overdue_referrals(); $$
);`}
              </pre>
            </div>
          </div>
          <div>
            <h4 className="font-semibold mb-2">How It Works</h4>
            <ul className="list-disc list-inside space-y-1 text-muted-foreground">
              <li>Checks for referrals created more than 48 hours ago</li>
              <li>Only processes users without an existing placement</li>
              <li>Uses the "auto" placement strategy to find the best position</li>
              <li>Logs all placements for audit purposes</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
