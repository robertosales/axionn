import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Calculator, Check, ChevronsUpDown, FileText, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { useApfDossierCreationOptions } from "../../hooks/useApfEvidenceDossiers";
import { createApfEvidenceDossier } from "../../services/apfEvidenceDossier.service";
import type { ApfCountingType, ApfDossierCreationSession, ApfDossierCreationUserStory } from "../../types/apfEvidenceDossier.types";
import { formatApfSessionOption, formatApfStatus } from "../../utils/apfDossierCreationPresentation";

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

  const selectStory = (value: string) => {
    setStoryId(value);
    const story = stories.find((item) => item.id === value);
    if (!story) return;
    setCode(`APF-${story.code}`);
    setTitle(`Evidência de contagem — ${story.code}: ${story.title}`);
  };

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

  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="max-h-[90dvh] overflow-hidden p-0 sm:max-w-2xl">
    <DialogHeader className="border-b px-6 pb-5 pt-6"><DialogTitle>Novo dossiê APF</DialogTitle><DialogDescription>Escolha o projeto e a história que originam a evidência. A sessão de contagem pode ser vinculada agora ou depois.</DialogDescription></DialogHeader>
    {isLoading ? <div className="flex min-h-36 items-center justify-center" role="status"><Loader2 className="mr-2 h-4 w-4 animate-spin motion-reduce:animate-none" />Carregando opções…</div>
      : isError ? <p role="alert" className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">Não foi possível carregar projetos e HUs.</p>
      : <div className="grid max-h-[calc(90dvh-11rem)] gap-5 overflow-y-auto px-6 py-5">
        <section className="grid gap-4 rounded-lg border bg-muted/20 p-4" aria-labelledby="dossier-origin-title">
          <div className="flex gap-3"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary"><FileText className="h-4 w-4" aria-hidden="true" /></span><div><h3 id="dossier-origin-title" className="text-sm font-semibold">Origem da evidência</h3><p className="text-xs text-muted-foreground">A história selecionada define o código e o título iniciais.</p></div></div>
          <Field label="Projeto" id="dossier-project"><Select value={projectId} onValueChange={setProjectId}><SelectTrigger id="dossier-project" className="min-h-11"><SelectValue placeholder="Selecione o projeto" /></SelectTrigger><SelectContent>{data?.projects.map((project) => <SelectItem key={project.id} value={project.id}>{project.name} · {project.contractName}</SelectItem>)}</SelectContent></Select></Field>
          <Field label="História de usuário" id="dossier-story" hint={!projectId ? "Selecione primeiro um projeto." : stories.length === 0 ? "Nenhuma história encontrada nos times vinculados a este projeto." : `${stories.length} história(s) disponível(is).`}>
            <StoryCombobox id="dossier-story" value={storyId} options={stories} onChange={selectStory} disabled={!projectId} />
          </Field>
        </section>

        <section className="grid gap-4 rounded-lg border p-4" aria-labelledby="dossier-count-title">
          <div className="flex gap-3"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary"><Calculator className="h-4 w-4" aria-hidden="true" /></span><div><h3 id="dossier-count-title" className="text-sm font-semibold">Contagem APF</h3><p className="text-xs text-muted-foreground">Os nomes do modelo, baseline, sprint e release identificam cada sessão.</p></div></div>
          <Field label="Sessão de contagem" id="dossier-session" hint={projectId && sessions.length === 0 ? "Nenhuma sessão encontrada para este projeto. Você poderá vinculá-la depois." : undefined}>
            <SessionCombobox id="dossier-session" value={sessionId} options={sessions} onChange={setSessionId} disabled={!projectId} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2"><Field label="Código do dossiê" id="dossier-code"><Input id="dossier-code" className="min-h-11" value={code} onChange={(event) => setCode(event.target.value)} placeholder="APF-HU-063" required /></Field><Field label="Tipo de contagem" id="dossier-type"><Select value={countingType} onValueChange={(value) => setCountingType(value as ApfCountingType)}><SelectTrigger id="dossier-type" className="min-h-11"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="impact">Evolutiva por impacto</SelectItem><SelectItem value="project">Projeto</SelectItem><SelectItem value="corrective">Corretiva</SelectItem><SelectItem value="recount">Recontagem</SelectItem></SelectContent></Select></Field></div>
          <Field label="Título" id="dossier-title-input"><Input id="dossier-title-input" className="min-h-11" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Evidência de contagem da HU" required /></Field>
        </section>
      </div>}
    <DialogFooter className="border-t bg-background px-6 py-4"><Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button><Button onClick={() => void submit()} disabled={saving || !projectId || !storyId || !code.trim() || !title.trim()}>{saving && <Loader2 className="mr-2 h-4 w-4 animate-spin motion-reduce:animate-none" />}Criar dossiê</Button></DialogFooter>
  </DialogContent></Dialog>;
}

function Field({ label, id, hint, children }: { label: string; id: string; hint?: string; children: ReactNode }) {
  return <div className="space-y-1.5"><Label htmlFor={id}>{label}</Label>{children}{hint && <p className="text-xs text-muted-foreground">{hint}</p>}</div>;
}

function StoryCombobox({ id, value, options, onChange, disabled }: { id: string; value: string; options: ApfDossierCreationUserStory[]; onChange: (value: string) => void; disabled: boolean }) {
  const [open, setOpen] = useState(false);
  const selected = options.find((item) => item.id === value);
  return <Popover open={open} onOpenChange={setOpen}><PopoverTrigger asChild><Button id={id} type="button" variant="outline" role="combobox" aria-expanded={open} disabled={disabled} className="min-h-11 w-full justify-between px-3 font-normal"><span className={cn("truncate text-left", !selected && "text-muted-foreground")}>{selected ? `${selected.code} · ${selected.title}` : "Selecione ou busque uma história"}</span><ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" aria-hidden="true" /></Button></PopoverTrigger><PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start"><Command><CommandInput placeholder="Buscar por código ou título…" /><CommandList><CommandEmpty>Nenhuma história encontrada.</CommandEmpty><CommandGroup>{options.map((story) => <CommandItem key={story.id} value={`${story.code} ${story.title}`} onSelect={() => { onChange(story.id); setOpen(false); }} className="items-start gap-2 py-3"><Check className={cn("mt-0.5 h-4 w-4 shrink-0", value === story.id ? "opacity-100" : "opacity-0")} aria-hidden="true" /><span className="grid"><span className="font-medium">{story.code} · {story.title}</span><span className="text-xs text-muted-foreground">{formatApfStatus(story.status)}</span></span></CommandItem>)}</CommandGroup></CommandList></Command></PopoverContent></Popover>;
}

function SessionCombobox({ id, value, options, onChange, disabled }: { id: string; value: string; options: ApfDossierCreationSession[]; onChange: (value: string) => void; disabled: boolean }) {
  const [open, setOpen] = useState(false);
  const selected = options.find((item) => item.id === value);
  const selectedLabel = selected ? formatApfSessionOption(selected) : null;
  return <Popover open={open} onOpenChange={setOpen}><PopoverTrigger asChild><Button id={id} type="button" variant="outline" role="combobox" aria-expanded={open} disabled={disabled} className="min-h-11 w-full justify-between px-3 font-normal"><span className="min-w-0 truncate text-left">{selectedLabel?.label ?? "Vincular posteriormente"}</span><ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" aria-hidden="true" /></Button></PopoverTrigger><PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start"><Command><CommandInput placeholder="Buscar modelo, baseline, sprint ou release…" /><CommandList><CommandEmpty>Nenhuma sessão encontrada.</CommandEmpty><CommandGroup><CommandItem value="vincular posteriormente" onSelect={() => { onChange("none"); setOpen(false); }} className="items-start gap-2 py-3"><Check className={cn("mt-0.5 h-4 w-4 shrink-0", value === "none" ? "opacity-100" : "opacity-0")} aria-hidden="true" /><span className="grid"><span className="font-medium">Vincular posteriormente</span><span className="text-xs text-muted-foreground">Crie o dossiê agora e associe uma contagem depois.</span></span></CommandItem>{options.map((session) => { const option = formatApfSessionOption(session); return <CommandItem key={session.id} value={`${option.label} ${option.description}`} onSelect={() => { onChange(session.id); setOpen(false); }} className="items-start gap-2 py-3"><Check className={cn("mt-0.5 h-4 w-4 shrink-0", value === session.id ? "opacity-100" : "opacity-0")} aria-hidden="true" /><span className="grid"><span className="font-medium">{option.label}</span><span className="text-xs text-muted-foreground">{option.description}</span></span></CommandItem>; })}</CommandGroup></CommandList></Command></PopoverContent></Popover>;
}
