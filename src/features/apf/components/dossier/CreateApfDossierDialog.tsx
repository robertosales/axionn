import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useApfDossierCreationOptions } from "../../hooks/useApfEvidenceDossiers";
import { createApfEvidenceDossier } from "../../services/apfEvidenceDossier.service";
import type { ApfCountingType } from "../../types/apfEvidenceDossier.types";

export function CreateApfDossierDialog({ open, onOpenChange, organizationId, onCreated }: { open: boolean; onOpenChange: (open: boolean) => void; organizationId: string; onCreated: () => Promise<unknown> }) {
  const { data, isLoading, isError } = useApfDossierCreationOptions(organizationId, open);
  const [projectId, setProjectId] = useState("");
  const [storyId, setStoryId] = useState("");
  const [sessionId, setSessionId] = useState("none");
  const [code, setCode] = useState("");
  const [title, setTitle] = useState("");
  const [countingType, setCountingType] = useState<ApfCountingType>("impact");
  const [saving, setSaving] = useState(false);

  const stories = useMemo(() => data?.userStories.filter((story) => story.projectId === projectId) ?? [], [data, projectId]);
  const sessions = useMemo(() => data?.sessions.filter((session) => session.projectId === projectId) ?? [], [data, projectId]);
  useEffect(() => { setStoryId(""); setSessionId("none"); }, [projectId]);

  const submit = async () => {
    const project = data?.projects.find((item) => item.id === projectId);
    const userStory = stories.find((item) => item.id === storyId);
    const session = sessions.find((item) => item.id === sessionId) ?? null;
    if (!project || !userStory || !code.trim() || !title.trim()) return;
    setSaving(true);
    try {
      await createApfEvidenceDossier({ organizationId, dossierCode: code, title, countingType, project, userStory, session });
      toast.success("Dossiê criado com as referências congeladas.");
      onOpenChange(false);
      await onCreated();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível criar o dossiê.");
    } finally { setSaving(false); }
  };

  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="sm:max-w-xl">
    <DialogHeader><DialogTitle>Novo dossiê APF</DialogTitle><DialogDescription>Selecione a HU e a contagem existente. As referências contratuais serão congeladas neste momento.</DialogDescription></DialogHeader>
    {isLoading ? <div className="flex min-h-36 items-center justify-center" role="status"><Loader2 className="mr-2 h-4 w-4 animate-spin motion-reduce:animate-none" />Carregando opções…</div>
      : isError ? <p role="alert" className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">Não foi possível carregar projetos e HUs.</p>
      : <div className="grid gap-4 py-2">
        <Field label="Projeto" id="dossier-project"><Select value={projectId} onValueChange={setProjectId}><SelectTrigger id="dossier-project"><SelectValue placeholder="Selecione o projeto" /></SelectTrigger><SelectContent>{data?.projects.map((project) => <SelectItem key={project.id} value={project.id}>{project.name} · {project.contractName}</SelectItem>)}</SelectContent></Select></Field>
        <Field label="História de usuário" id="dossier-story"><Select value={storyId} onValueChange={setStoryId} disabled={!projectId}><SelectTrigger id="dossier-story"><SelectValue placeholder="Selecione a HU" /></SelectTrigger><SelectContent>{stories.map((story) => <SelectItem key={story.id} value={story.id}>{story.code} · {story.title}</SelectItem>)}</SelectContent></Select></Field>
        <Field label="Sessão de contagem" id="dossier-session"><Select value={sessionId} onValueChange={setSessionId} disabled={!projectId}><SelectTrigger id="dossier-session"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">Vincular posteriormente</SelectItem>{sessions.map((session) => <SelectItem key={session.id} value={session.id}>{session.sprintRef ?? session.id.slice(0, 8)} · {session.status}</SelectItem>)}</SelectContent></Select></Field>
        <div className="grid gap-4 sm:grid-cols-2"><Field label="Código do dossiê" id="dossier-code"><Input id="dossier-code" value={code} onChange={(event) => setCode(event.target.value)} placeholder="APF-HU-063" required /></Field><Field label="Tipo de contagem" id="dossier-type"><Select value={countingType} onValueChange={(value) => setCountingType(value as ApfCountingType)}><SelectTrigger id="dossier-type"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="impact">Evolutiva por impacto</SelectItem><SelectItem value="project">Projeto</SelectItem><SelectItem value="corrective">Corretiva</SelectItem><SelectItem value="recount">Recontagem</SelectItem></SelectContent></Select></Field></div>
        <Field label="Título" id="dossier-title-input"><Input id="dossier-title-input" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Evidência de contagem da HU" required /></Field>
      </div>}
    <DialogFooter><Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button><Button onClick={() => void submit()} disabled={saving || !projectId || !storyId || !code.trim() || !title.trim()}>{saving && <Loader2 className="mr-2 h-4 w-4 animate-spin motion-reduce:animate-none" />}Criar dossiê</Button></DialogFooter>
  </DialogContent></Dialog>;
}

function Field({ label, id, children }: { label: string; id: string; children: ReactNode }) {
  return <div className="space-y-1.5"><Label htmlFor={id}>{label}</Label>{children}</div>;
}
