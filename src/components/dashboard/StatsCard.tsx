import { ReactNode } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface StatsCardProps {
  title: string;
  value: string;
  change?: string;
  changeType?: "positive" | "negative" | "neutral";
  icon: ReactNode;
  className?: string;
}

export function StatsCard({
  title,
  value,
  change,
  changeType = "neutral",
  icon,
  className,
}: StatsCardProps) {
  return (
    <Card className={cn("bg-card border-border/50", className)}>
      <CardContent className="p-4 md:p-6">
        <div className="flex items-start justify-between">
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">{title}</p>
            <p className="text-2xl md:text-3xl font-bold text-foreground">{value}</p>
            {change && (
              <p
                className={cn(
                  "text-xs font-medium",
                  changeType === "positive" && "text-success",
                  changeType === "negative" && "text-destructive",
                  changeType === "neutral" && "text-muted-foreground"
                )}
              >
                {change}
              </p>
            )}
          </div>
          <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center">
            {icon}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
