import React from "react";
import { Badge } from "@/components/ui/badge";
import { SIZE_OPTIONS } from "@/lib/constants";

interface Props {
  size: string | null | undefined;
  className?: string;
}

export const SizeBadge = React.memo(function SizeBadge({ size, className }: Props) {
  if (!size) return null;
  const option = SIZE_OPTIONS.find((o) => o.value === size);
  if (!option) return null;
  return (
    <Badge
      variant="outline"
      className={`text-[9px] px-1.5 py-0 h-4 font-semibold ${option.color ?? ""} ${className ?? ""}`}
    >
      {option.label}
    </Badge>
  );
});
