import { AlertCircle, RotateCcw } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface ErrorStateProps {
  message?: string;
  onRetry?: () => void;
}

export function ErrorState({ message = "Erro ao carregar dados", onRetry }: ErrorStateProps) {
  return (
    <Card className="border-destructive/30" role="alert">
      <CardContent className="flex flex-col items-center justify-center py-10 text-destructive">
        <AlertCircle className="h-10 w-10 mb-3 opacity-50" aria-hidden="true" />
        <p className="font-medium">{message}</p>
        {onRetry && (
          <Button variant="outline" size="sm" className="mt-3 gap-1.5" onClick={onRetry}>
            <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" /> Tentar novamente
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
