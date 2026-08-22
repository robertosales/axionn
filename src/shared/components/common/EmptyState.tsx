import { FilterX, Plus, type LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export type EmptyStateVariant = "empty" | "filtered-empty";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  actionIcon?: LucideIcon;
  variant?: EmptyStateVariant;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  actionLabel,
  onAction,
  actionIcon,
  variant = "empty",
}: EmptyStateProps) {
  const ActionIcon = actionIcon ?? (variant === "filtered-empty" ? FilterX : Plus);

  return (
    <Card
      className="border-dashed"
      data-state-variant={variant}
      role="status"
      aria-live="polite"
    >
      <CardContent className="flex flex-col items-center justify-center py-12 text-muted-foreground">
        <Icon className="h-12 w-12 mb-3 opacity-30" aria-hidden="true" />
        <p className="font-medium">{title}</p>
        {description && <p className="text-sm mt-1 text-center max-w-sm">{description}</p>}
        {actionLabel && onAction && (
          <Button size="sm" className="mt-4 gap-1.5" onClick={onAction}>
            <ActionIcon className="h-4 w-4" aria-hidden="true" /> {actionLabel}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
