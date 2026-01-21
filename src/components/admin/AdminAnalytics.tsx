import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  BarChart,
  Bar,
  Legend,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle, RefreshCw, TrendingUp, TrendingDown } from "lucide-react";
import { Button } from "@/components/ui/button";

interface OrderRow {
  id: string;
  user_id: string | null;
  total_amount: number | null;
  payment_status: string | null;
  created_at: string;
}

interface ReferralRow {
  referrer_id: string;
  referred_user_id: string;
}

interface CommissionRow {
  id: string;
  amount: number | null;
  status: string | null;
  type: string | null;
  created_at: string;
}

const DATE_OPTIONS = [7, 30, 90];

function formatDateKey(dateStr: string) {
  return dateStr.slice(0, 10);
}

function currency(amount: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(amount);
}

export function AdminAnalytics() {
  const [rangeDays, setRangeDays] = useState<number>(30);
  const [rangeMode, setRangeMode] = useState<string>("30");
  const [customStart, setCustomStart] = useState<string>("");
  const [customEnd, setCustomEnd] = useState<string>("");
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [commissions, setCommissions] = useState<CommissionRow[]>([]);
  const [referrals, setReferrals] = useState<ReferralRow[]>([]);
  const [prevOrders, setPrevOrders] = useState<OrderRow[]>([]);
  const [prevCommissions, setPrevCommissions] = useState<CommissionRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        let since: string | undefined;
        let until: string | undefined;
        let prevSince: string | undefined;
        let prevUntil: string | undefined;

        if (rangeMode === "custom") {
          if (!customStart || !customEnd) {
            throw new Error("Please select custom start and end dates.");
          }
          const startDate = new Date(customStart);
          const endDate = new Date(customEnd);
          if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
            throw new Error("Invalid custom dates.");
          }
          endDate.setHours(23, 59, 59, 999);
          since = startDate.toISOString();
          until = endDate.toISOString();
          
          // Calculate previous period
          const duration = endDate.getTime() - startDate.getTime();
          const prevEndDate = new Date(startDate.getTime() - 1);
          const prevStartDate = new Date(prevEndDate.getTime() - duration);
          prevSince = prevStartDate.toISOString();
          prevUntil = prevEndDate.toISOString();
        } else {
          since = new Date(Date.now() - rangeDays * 24 * 60 * 60 * 1000).toISOString();
          prevSince = new Date(Date.now() - rangeDays * 2 * 24 * 60 * 60 * 1000).toISOString();
          prevUntil = since;
        }

        let ordersQuery = supabase
          .from("orders")
          .select("id,user_id,total_amount,payment_status,created_at")
          .gte("created_at", since);
        if (until) ordersQuery = ordersQuery.lte("created_at", until);

        let commissionsQuery = supabase
          .from("commissions")
          .select("id,amount,status,type,created_at")
          .gte("created_at", since);
        if (until) commissionsQuery = commissionsQuery.lte("created_at", until);

        // Previous period queries
        const prevOrdersQuery = supabase
          .from("orders")
          .select("id,user_id,total_amount,payment_status,created_at")
          .gte("created_at", prevSince)
          .lte("created_at", prevUntil);

        const prevCommissionsQuery = supabase
          .from("commissions")
          .select("id,amount,status,type,created_at")
          .gte("created_at", prevSince)
          .lte("created_at", prevUntil);

        const [ordersRes, commissionsRes, referralsRes, prevOrdersRes, prevCommissionsRes] = await Promise.all([
          ordersQuery,
          commissionsQuery,
          supabase.from("referrals").select("referrer_id,referred_user_id"),
          prevOrdersQuery,
          prevCommissionsQuery,
        ]);

        if (ordersRes.error) throw ordersRes.error;
        if (commissionsRes.error) throw commissionsRes.error;
        if (referralsRes.error) throw referralsRes.error;
        if (prevOrdersRes.error) throw prevOrdersRes.error;
        if (prevCommissionsRes.error) throw prevCommissionsRes.error;

        setOrders((ordersRes.data || []) as OrderRow[]);
        setCommissions((commissionsRes.data || []) as CommissionRow[]);
        setReferrals((referralsRes.data || []) as ReferralRow[]);
        setPrevOrders((prevOrdersRes.data || []) as OrderRow[]);
        setPrevCommissions((prevCommissionsRes.data || []) as CommissionRow[]);
        setLastUpdated(new Date());
      } catch (err: unknown) {
        console.error("Analytics load error", err);
        setError("Unable to load analytics data.");
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [rangeDays, rangeMode, customStart, customEnd]);

  const paidOrders = useMemo(() =>
    orders.filter((o) => (o.payment_status || "").toLowerCase() === "paid"),
  [orders]);

  const revenueTotal = useMemo(() =>
    paidOrders.reduce((sum, o) => sum + (o.total_amount || 0), 0),
  [paidOrders]);

  const ordersCount = paidOrders.length;
  const avgOrderValue = ordersCount > 0 ? revenueTotal / ordersCount : 0;

  const refunds = useMemo(() => {
    const refunded = orders.filter((o) => (o.payment_status || "").toLowerCase() === "refunded");
    const total = refunded.reduce((sum, o) => sum + (o.total_amount || 0), 0);
    return {
      count: refunded.length,
      total,
    };
  }, [orders]);

  const activeUsers = useMemo(() => {
    const now = Date.now();
    const oneDayAgo = now - 24 * 60 * 60 * 1000;
    const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;

    const seen24 = new Set<string>();
    const seen7 = new Set<string>();

    orders.forEach((o) => {
      if (!o.user_id) return;
      const ts = new Date(o.created_at).getTime();
      if (ts >= oneDayAgo) seen24.add(o.user_id);
      if (ts >= sevenDaysAgo) seen7.add(o.user_id);
    });

    return { last24h: seen24.size, last7d: seen7.size };
  }, [orders]);

  const commissionPaid = useMemo(() =>
    commissions
      .filter((c) => (c.status || "").toLowerCase() === "paid")
      .reduce((sum, c) => sum + (c.amount || 0), 0),
  [commissions]);

  const commissionPending = useMemo(() =>
    commissions
      .filter((c) => (c.status || "").toLowerCase() === "pending")
      .reduce((sum, c) => sum + (c.amount || 0), 0),
  [commissions]);

  const revenueSeries = useMemo(() => {
    const map: Record<string, number> = {};
    paidOrders.forEach((o) => {
      const key = formatDateKey(o.created_at);
      map[key] = (map[key] || 0) + (o.total_amount || 0);
    });
    return Object.entries(map)
      .sort(([a], [b]) => (a < b ? -1 : 1))
      .map(([date, value]) => ({ date, value }));
  }, [paidOrders]);

  const commissionSeries = useMemo(() => {
    const map: Record<string, { paid: number; pending: number; other: number }> = {};
    commissions.forEach((c) => {
      const type = (c.type || "unknown").toLowerCase();
      const status = (c.status || "unknown").toLowerCase();
      if (!map[type]) map[type] = { paid: 0, pending: 0, other: 0 };
      const amount = c.amount || 0;
      if (status === "paid") map[type].paid += amount;
      else if (status === "pending") map[type].pending += amount;
      else map[type].other += amount;
    });

    return Object.entries(map).map(([type, vals]) => ({ type, ...vals }));
  }, [commissions]);

  const topReferrers = useMemo(() => {
    const refLookup: Record<string, string> = {};
    referrals.forEach((r) => {
      refLookup[r.referred_user_id] = r.referrer_id;
    });

    const stats: Record<string, { revenue: number; orders: number }> = {};
    paidOrders.forEach((o) => {
      if (!o.user_id) return;
      const referrerId = refLookup[o.user_id];
      if (!referrerId) return;
      if (!stats[referrerId]) stats[referrerId] = { revenue: 0, orders: 0 };
      stats[referrerId].revenue += o.total_amount || 0;
      stats[referrerId].orders += 1;
    });

    return Object.entries(stats)
      .map(([referrerId, v]) => ({ referrerId, ...v }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10);
  }, [referrals, paidOrders]);

  // Previous period metrics for trends
  const prevPaidOrders = useMemo(() =>
    prevOrders.filter((o) => (o.payment_status || "").toLowerCase() === "paid"),
  [prevOrders]);

  const prevRevenueTotal = useMemo(() =>
    prevPaidOrders.reduce((sum, o) => sum + (o.total_amount || 0), 0),
  [prevPaidOrders]);

  const prevOrdersCount = prevPaidOrders.length;
  const prevAvgOrderValue = prevOrdersCount > 0 ? prevRevenueTotal / prevOrdersCount : 0;

  const prevCommissionPaid = useMemo(() =>
    prevCommissions
      .filter((c) => (c.status || "").toLowerCase() === "paid")
      .reduce((sum, c) => sum + (c.amount || 0), 0),
  [prevCommissions]);

  // Trend calculations
  const calculateTrend = (current: number, previous: number): { percent: number; direction: "up" | "down" | "neutral" } => {
    if (previous === 0) return { percent: 0, direction: "neutral" };
    const percent = ((current - previous) / previous) * 100;
    const direction = percent > 0 ? "up" : percent < 0 ? "down" : "neutral";
    return { percent: Math.abs(percent), direction: direction as "up" | "down" | "neutral" };
  };

  const revenueTrend = calculateTrend(revenueTotal, prevRevenueTotal);
  const ordersTrend = calculateTrend(ordersCount, prevOrdersCount);
  const aovTrend = calculateTrend(avgOrderValue, prevAvgOrderValue);
  const commissionTrend = calculateTrend(commissionPaid, prevCommissionPaid);

  // Order status breakdown for pie chart
  const orderStatusData = useMemo(() => {
    const statusCounts: Record<string, number> = {};
    orders.forEach((o) => {
      const status = (o.payment_status || "unknown").toLowerCase();
      statusCounts[status] = (statusCounts[status] || 0) + 1;
    });
    return Object.entries(statusCounts).map(([name, value]) => ({ name, value }));
  }, [orders]);

  const STATUS_COLORS: Record<string, string> = {
    paid: "#10b981",
    pending: "#f59e0b",
    refunded: "#ef4444",
    cancelled: "#8b5cf6",
    unknown: "#06b6d4",
  };

  const PIE_COLORS = ["#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4", "#ec4899", "#14b8a6", "#f97316"];

  const handleRefresh = async () => {
    setIsRefreshing(true);
    // Trigger re-fetch by updating a dependency
    setLastUpdated(null);
    // The useEffect will handle the actual refresh
    setTimeout(() => setIsRefreshing(false), 500);
  };

  const TrendIndicator = ({ trend }: { trend: { percent: number; direction: "up" | "down" | "neutral" } }) => {
    if (trend.direction === "neutral" || trend.percent === 0) return null;
    return (
      <span className={`inline-flex items-center gap-1 text-xs ${
        trend.direction === "up" ? "text-green-600" : "text-red-600"
      }`}>
        {trend.direction === "up" ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
        {trend.percent.toFixed(1)}%
      </span>
    );
  };

  const content = (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Date range</span>
          <Select
            value={rangeMode}
            onValueChange={(val) => {
              setRangeMode(val);
              if (val !== "custom") {
                setRangeDays(Number(val));
              }
            }}
          >
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {DATE_OPTIONS.map((d) => (
                <SelectItem key={d} value={String(d)}>{d} days</SelectItem>
              ))}
              <SelectItem value="custom">Custom</SelectItem>
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
        {rangeMode === "custom" && (
          <div className="flex items-center gap-2 flex-wrap text-sm text-muted-foreground">
            <span>From</span>
            <input
              type="date"
              className="border rounded px-2 py-1 text-sm bg-background"
              value={customStart}
              onChange={(e) => setCustomStart(e.target.value)}
            />
            <span>to</span>
            <input
              type="date"
              className="border rounded px-2 py-1 text-sm bg-background"
              value={customEnd}
              onChange={(e) => setCustomEnd(e.target.value)}
            />
          </div>
        )}
        {lastUpdated && (
          <span className="text-xs text-muted-foreground">Updated {lastUpdated.toLocaleString()}</span>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Revenue (paid)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-2">
              <div className="text-2xl font-bold">{currency(revenueTotal)}</div>
              <TrendIndicator trend={revenueTrend} />
            </div>
            <div className="text-xs text-muted-foreground">Paid orders only</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Orders</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-2">
              <div className="text-2xl font-bold">{ordersCount}</div>
              <TrendIndicator trend={ordersTrend} />
            </div>
            <div className="text-xs text-muted-foreground">Paid status</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Avg Order Value</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-2">
              <div className="text-2xl font-bold">{currency(avgOrderValue)}</div>
              <TrendIndicator trend={aovTrend} />
            </div>
            <div className="text-xs text-muted-foreground">Paid orders</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Commissions (paid)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-2">
              <div className="text-2xl font-bold">{currency(commissionPaid)}</div>
              <TrendIndicator trend={commissionTrend} />
            </div>
            <div className="text-xs text-muted-foreground flex items-center gap-2">
              Pending {currency(commissionPending)}
              {commissionPending > 0 && <Badge variant="secondary">Pending</Badge>}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Active users</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeUsers.last24h}</div>
            <div className="text-xs text-muted-foreground">Last 24h · Last 7d: {activeUsers.last7d}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Refunds</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{currency(refunds.total)}</div>
            <div className="text-xs text-muted-foreground">Count: {refunds.count}</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="h-[320px]">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Revenue over time</CardTitle>
          </CardHeader>
          <CardContent className="h-full">
            {revenueSeries.length === 0 ? (
              <div className="text-sm text-muted-foreground">No paid orders in range.</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={revenueSeries} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip formatter={(v: number) => currency(v)} />
                  <Line type="monotone" dataKey="value" stroke="#6366f1" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card className="h-[320px]">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Commissions by type</CardTitle>
          </CardHeader>
          <CardContent className="h-full">
            {commissionSeries.length === 0 ? (
              <div className="text-sm text-muted-foreground">No commissions in range.</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={commissionSeries} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="type" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip formatter={(v: number) => currency(v)} />
                  <Legend />
                  <Bar dataKey="paid" stackId="comm" fill="#10b981" name="Paid" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="pending" stackId="comm" fill="#f59e0b" name="Pending" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="other" stackId="comm" fill="#94a3b8" name="Other" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="h-[320px]">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Order status breakdown</CardTitle>
          </CardHeader>
          <CardContent className="h-full">
            {orderStatusData.length === 0 ? (
              <div className="text-sm text-muted-foreground">No orders in range.</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={orderStatusData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    label={(entry) => `${entry.name}: ${entry.value}`}
                  >
                    {orderStatusData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Top referrers (paid order revenue)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {topReferrers.length === 0 && (
              <div className="text-sm text-muted-foreground">No referral revenue in range.</div>
            )}
            {topReferrers.map((item) => (
              <div key={item.referrerId} className="flex items-center justify-between text-sm">
                <div className="flex flex-col">
                  <span className="truncate font-medium">Referrer #{item.referrerId.slice(0, 8)}</span>
                  <span className="text-xs text-muted-foreground">Orders: {item.orders}</span>
                </div>
                <span className="font-semibold">{currency(item.revenue)}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-48" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Skeleton className="h-80" />
          <Skeleton className="h-80" />
        </div>
        <Skeleton className="h-32" />
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Error</AlertTitle>
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  return content;
}
