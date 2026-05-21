import React from "react";
import { Skeleton } from "@/components/ui/skeleton";

interface Props {
  count?: number;
  variant?: "row" | "card" | "line";
  className?: string;
}

export const SkeletonList = React.memo(function SkeletonList({ count = 5, variant = "row", className }: Props) {
  const items = Array.from({ length: count });

  if (variant === "card") {
    return (
      <div className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 ${className ?? ""}`}>
        {items.map((_, i) => (
          <div key={i} className="rounded-lg border p-4 space-y-3">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-2/3" />
            <div className="flex gap-2 pt-1">
              <Skeleton className="h-5 w-12 rounded-full" />
              <Skeleton className="h-5 w-16 rounded-full" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (variant === "line") {
    return (
      <div className={`space-y-2 ${className ?? ""}`}>
        {items.map((_, i) => (
          <Skeleton key={i} className="h-3 w-full" style={{ width: `${70 + (i % 3) * 10}%` }} />
        ))}
      </div>
    );
  }

  // variant === "row" (default)
  return (
    <div className={`space-y-2 ${className ?? ""}`}>
      {items.map((_, i) => (
        <div key={i} className="flex items-center gap-3 p-3 rounded-lg border">
          <Skeleton className="h-8 w-8 rounded-full shrink-0" />
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-3.5 w-1/2" />
            <Skeleton className="h-3 w-3/4" />
          </div>
          <Skeleton className="h-6 w-16 rounded" />
        </div>
      ))}
    </div>
  );
});
