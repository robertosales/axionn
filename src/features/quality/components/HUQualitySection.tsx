import { useQuery } from "@tanstack/react-query";
import { ClipboardCheck, ExternalLink } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export function HUQualitySection({ huId, organizationId }:{huId:string;organizationId:string}) {
 const navigate=useNavigate();
 const query=useQuery({queryKey:["quality",organizationId,"hu",huId],queryFn:async()=>{const {data:links,error}=await supabase.from("quality_test_case_links").select("id,test_case_id").eq("organization_id",organizationId).eq("entity_type","user_story").eq("entity_id",huId);if(error)throw error;if(!links?.length)return [];const {data:cases,error:caseError}=await supabase.from("quality_test_cases").select("id,code,title,status").eq("organization_id",organizationId).in("id",links.map(l=>l.test_case_id));if(caseError)throw caseError;return cases??[];}});
 return <section aria-labelledby="hu-quality-title" className="rounded-lg border bg-primary/[0.03] p-4"><div className="flex items-start justify-between gap-3"><div><h3 id="hu-quality-title" className="flex items-center gap-2 text-sm font-semibold"><ClipboardCheck className="h-4 w-4 text-primary"/>Qualidade</h3><p className="mt-1 text-xs text-muted-foreground">{query.data?.length??0} caso(s) vinculado(s) a esta HU</p></div><Button type="button" variant="outline" size="sm" onClick={()=>navigate("/sala-agil/qualidade/casos")}><ExternalLink className="mr-2 h-3.5 w-3.5"/>Abrir casos</Button></div>{query.isLoading?<p className="mt-3 text-xs text-muted-foreground">Carregando cobertura…</p>:query.isError?<p role="alert" className="mt-3 text-xs text-destructive">Cobertura indisponível.</p>:query.data?.length?<ul className="mt-3 space-y-2">{query.data.slice(0,4).map(item=><li key={item.id} className="flex items-center justify-between gap-3 text-sm"><span className="truncate"><span className="mr-2 font-mono text-xs text-primary">{item.code}</span>{item.title}</span><Badge variant="secondary">{item.status}</Badge></li>)}</ul>:<p className="mt-3 text-xs text-muted-foreground">Nenhum caso cobre esta história ainda.</p>}</section>;
}
