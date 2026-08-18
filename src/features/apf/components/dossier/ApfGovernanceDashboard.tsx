import { useEffect, useState } from "react";
import { AlertTriangle, BadgeCheck, Scale, Sparkles } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { getApfGovernanceMetrics } from "../../services/apfEvidenceDossier.service";
import type { ApfGovernanceMetrics } from "../../types/apfEvidenceDossier.types";

export function ApfGovernanceDashboard({organizationId}:{organizationId:string}){
 const[data,setData]=useState<ApfGovernanceMetrics|null>(null);useEffect(()=>{let active=true;void getApfGovernanceMetrics(organizationId).then(value=>active&&setData(value)).catch(()=>active&&setData(null));return()=>{active=false;};},[organizationId]);
 if(!data)return null;
 const metrics=[{label:"PF aprovado",value:data.approvedPf.toLocaleString("pt-BR"),detail:`${data.disputedPf.toLocaleString("pt-BR")} PF em glosa`,icon:BadgeCheck},{label:"Taxa de glosa",value:`${data.glosaRate}%`,detail:"sobre lotes com decisão",icon:Scale},{label:"Acurácia das sugestões",value:`${data.suggestionAcceptanceRate}%`,detail:`${data.suggestionReviewCount} sugestões revisadas`,icon:Sparkles},{label:"Riscos abertos",value:String(data.openAuditFindings),detail:`${data.criticalOpenFindings} críticos · divergência ${data.countingDivergencePf.toLocaleString("pt-BR")} PF`,icon:AlertTriangle}];
 return <section aria-labelledby="apf-governance-title" className="space-y-2"><h3 id="apf-governance-title" className="font-semibold">Governança e acurácia</h3><div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">{metrics.map(({label,value,detail,icon:Icon})=><Card key={label}><CardContent className="flex gap-3 p-4"><Icon className="mt-0.5 h-4 w-4 text-primary" aria-hidden="true"/><div><p className="text-xl font-semibold tabular-nums">{value}</p><p className="text-xs font-medium">{label}</p><p className="text-[11px] text-muted-foreground">{detail}</p></div></CardContent></Card>)}</div></section>;
}
