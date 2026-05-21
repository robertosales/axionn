import React, { useMemo } from "react";
import { AlertTriangle } from "lucide-react";
import { useSprint } from "@/contexts/SprintContext";

interface Props {
  sprintId: string;
  onManage?: () => void;
}

export const SprintImpedimentsBanner = React.memo(function SprintImpedimentsBanner({ sprintId, onManage }: Props) {
  const { userStories } = useSprint() as any;

  const openImpediments = useMemo(() => {
    const allImpediments: any[] = [];
    (userStories ?? []).forEach((hu: any) => {
      (hu.impediments ?? []).forEach((imp: any) => {
        if (!imp.resolvedAt && hu.sprintId === sprintId) {
          allImpediments.push({ ...imp, huCode: hu.code, huTitle: hu.title });
        }
      });
    });
    return allImpediments;
  }, [userStories, sprintId]);

  if (openImpediments.length === 0) return null;

  return (
    <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-400 text-xs">
      <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
      <span className="font-medium">
        {openImpediments.length} impedimento{openImpediments.length > 1 ? "s" : ""} em aberto
      </span>
      {onManage && (
        <button
          onClick={onManage}
          className="ml-auto underline underline-offset-2 hover:no-underline font-medium"
        >
          Gerenciar
        </button>
      )}
    </div>
  );
});
