import { useCallback, useEffect, useMemo, useState } from "react";
import { getMyBackofficeStaffProfile } from "@/backoffice/services/backoffice.service";
import type { BackofficeRole, BackofficeStaffMember } from "@/backoffice/types/backoffice.types";

export function useBackofficeAuth() {
  const [staffMember, setStaffMember] = useState<BackofficeStaffMember | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setStaffMember(await getMyBackofficeStaffProfile());
    } catch (err) {
      console.warn("[Backoffice] acesso negado ou perfil indisponivel", err);
      setStaffMember(null);
      setError("Acesso ao backoffice nao autorizado.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const hasRole = useCallback(
    (roles?: BackofficeRole[]) =>
      Boolean(staffMember) && (!roles || roles.includes(staffMember!.role)),
    [staffMember],
  );

  return useMemo(
    () => ({ staffMember, loading, error, refresh, hasRole }),
    [error, hasRole, loading, refresh, staffMember],
  );
}
