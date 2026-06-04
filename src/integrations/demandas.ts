/**
 * @deprecated Use `fetchDemandasEnriched` de
 * `@/features/sustentacao/services/demandas.service` diretamente,
 * ou o hook `useDemandasWithResponsaveis` que agora usa TanStack Query
 * com cache compartilhado.
 *
 * Este arquivo é mantido apenas para não quebrar imports existentes.
 */
export type { Demanda as DemandaWithProjeto } from '@/features/sustentacao/types/demanda';
export { fetchDemandasEnriched as getDemandasWithResponsaveis } from '@/features/sustentacao/services/demandas.service';
