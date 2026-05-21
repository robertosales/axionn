/**
 * PERF-002: useDerivedSprint
 * Hook centralizado para derivar dados pesados do SprintContext com useMemo.
 * Evita recalcular listas filtradas em múltiplos componentes simultaneamente.
 *
 * Uso:
 *   const { storiesBySprint, activitiesByHU, totalHoursByHU } = useDerivedSprint();
 */
import { useMemo } from "react";
import { useSprint } from "@/contexts/SprintContext";
import { getTotalHoursForHU } from "@/types/sprint";

export function useDerivedSprint() {
  const { userStories, activities, sprints, activeSprint } = useSprint() as any;

  const storiesBySprint = useMemo(() => {
    const map = new Map<string, any[]>();
    (userStories ?? []).forEach((hu: any) => {
      const key = hu.sprintId ?? "__backlog__";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(hu);
    });
    return map;
  }, [userStories]);

  const activitiesByHU = useMemo(() => {
    const map = new Map<string, any[]>();
    (activities ?? []).forEach((a: any) => {
      if (!map.has(a.huId)) map.set(a.huId, []);
      map.get(a.huId)!.push(a);
    });
    return map;
  }, [activities]);

  const totalHoursByHU = useMemo(() => {
    const map = new Map<string, number>();
    (userStories ?? []).forEach((hu: any) => {
      map.set(hu.id, getTotalHoursForHU(activities, hu.id));
    });
    return map;
  }, [userStories, activities]);

  const sprintById = useMemo(() => {
    const map = new Map<string, any>();
    (sprints ?? []).forEach((s: any) => map.set(s.id, s));
    return map;
  }, [sprints]);

  const openImpedimentsByHU = useMemo(() => {
    const map = new Map<string, any[]>();
    (userStories ?? []).forEach((hu: any) => {
      const open = (hu.impediments ?? []).filter((i: any) => !i.resolvedAt);
      if (open.length > 0) map.set(hu.id, open);
    });
    return map;
  }, [userStories]);

  return {
    storiesBySprint,
    activitiesByHU,
    totalHoursByHU,
    sprintById,
    openImpedimentsByHU,
    activeSprint,
  };
}
