import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { archiveTestCase, listTestCases, saveTestCase } from "../services/qualityTestCases.service";

export const qualityKeys = { all: (org: string) => ["quality", org] as const, cases: (org: string, search: string) => ["quality", org, "cases", search] as const, detail: (org: string, id: string) => ["quality", org, "case", id] as const };

export function useTestCases(organizationId: string | null, search: string) { return useQuery({ queryKey: qualityKeys.cases(organizationId ?? "", search), queryFn: () => listTestCases(organizationId!, search), enabled: Boolean(organizationId) }); }
export function useSaveTestCase(organizationId: string) { const client=useQueryClient(); return useMutation({ mutationFn: ({ payload,id }:{payload:Record<string,unknown>;id?:string})=>saveTestCase(organizationId,payload,id), onSuccess:()=>client.invalidateQueries({queryKey:qualityKeys.all(organizationId)}) }); }
export function useArchiveTestCase(organizationId: string) { const client=useQueryClient(); return useMutation({ mutationFn:(id:string)=>archiveTestCase(organizationId,id), onSuccess:()=>client.invalidateQueries({queryKey:qualityKeys.all(organizationId)}) }); }
