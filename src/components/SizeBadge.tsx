import React from "react";
import { Badge } from "@/components/ui/badge";
import { getSizeByKey } from "@/lib/sizeReference";

interface Props {
  size?: string | null;
  sizeReference?: string | null;
  storyPoints?: number | null;
  className?: string;
}

export const SizeBadge = React.memo(function SizeBadge({ size, sizeReference, storyPoints, className }: Props) {
  const key = sizeReference ?? size;
  if (!key && !storyPoints) return null;
  const option = getSizeByKey(key);
  const label = option?.label ?? key ?? `${storyPoints} pts`;
  return (
    <Badge
      variant="outline"
      className={`text-[9px] px-1.5 py-0 h-4 font-semibold ${className ?? ""}`}
    >
      {label}{storyPoints ? ` · ${storyPoints}pts` : ""}
    </Badge>
  );
});
