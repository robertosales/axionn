import { Skeleton } from "@/components/ui/skeleton";

export function QualityPageSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-3" role="status" aria-label="Carregando conteúdo de qualidade">
      {Array.from({ length: rows }).map((_, index) => (
        <div key={index} className="flex min-h-20 items-center gap-4 rounded-xl border bg-card p-4">
          <Skeleton className="h-10 w-10 rounded-lg" />
          <div className="flex-1 space-y-2"><Skeleton className="h-4 w-1/3" /><Skeleton className="h-3 w-2/3" /></div>
          <Skeleton className="h-8 w-24" />
        </div>
      ))}
      <span className="sr-only">Carregando…</span>
    </div>
  );
}
