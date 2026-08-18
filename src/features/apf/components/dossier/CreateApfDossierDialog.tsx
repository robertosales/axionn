import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Calculator, Check, ChevronsUpDown, FileText, FolderKanban, Loader2, Plus } from "lucide-react";
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
import type { ApfCountingType, ApfDossierCreationProject, ApfDossierCreationSession, ApfDossierCreationUserStory } from "../../types/apfEvidenceDossier.types";
import { formatApfSessionOption, formatApfStatus } from "../../utils/apfDossierCreationPresentation";

export function CreateApfDossierDialog({ open, onOpenChange, organizationId, currentTeamId, currentTeamName, onCreated }: { open: boolean; onOpenChange: (open: boolean) => void; organizationId: string; currentTeamId: string | null; currentTeamName: string | null; onCreated: () => Promise<unknown> }) {
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
  useEffect(() => {
    if (!open || projectId || !currentTeamId || !data?.projects.length) return;
    const currentProject = data.projects.find((project) => project.teamIds.includes(currentTeamId));
    if (currentProject) setProjectId(currentProject.id);
  }, [currentTeamId, data, open, projectId]);

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

  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent style={{ width: "min(48rem, calc(100vw - 1rem))", maxWidth: "calc(100vw - 1rem)", height: "min(46rem, calc(100dvh - 1rem))", maxHeight: "calc(100dvh - 1rem)" }} className="!flex min-w-0 flex-col gap-0 overflow-hidden p-0">
    <DialogHeader data-testid="dossier-dialog-header" className="relative z-10 shrink-0 border-b bg-background px-5 pb-4 pt-5 sm:px-6"><DialogTitle className="flex items-center gap-2 text-lg"><span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary"><FileText className="h-4 w-4" aria-hidden="true" /></span>Novo dossiê APF</DialogTitle><DialogDescription className="max-w-2xl sm:pl-11">Selecione a origem da entrega e configure a contagem. Os dados da HU preencherão o dossiê automaticamente.</DialogDescription></DialogHeader>
    {isLoading ? <div className="flex min-h-48 flex-1 items-center justify-center" role="status"><Loader2 className="mr-2 h-4 w-4 animate-spin motion-reduce:animate-none" />Carregando projetos e histórias…</div>
      : isError ? <div className="flex flex-1 items-start px-5 py-6 sm:px-6"><p role="alert" className="w-full rounded-lg border border-destructive/20 bg-destructive/10 p-4 text-sm text-destructive">Não foi possível carregar projetos e HUs. Feche a janela e tente novamente.</p></div>
      : <div data-testid="dossier-dialog-body" className="grid min-h-0 min-w-0 flex-1 gap-4 overflow-x-hidden overflow-y-auto overscroll-contain px-5 py-4 sm:px-6 lg:grid-cols-2 lg:items-start">
        <section className="grid min-w-0 gap-4 rounded-lg border bg-muted/20 p-4" aria-labelledby="dossier-origin-title">
          <div className="flex min-w-0 gap-3"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary"><FileText className="h-4 w-4" aria-hidden="true" /></span><div className="min-w-0"><h3 id="dossier-origin-title" className="text-sm font-semibold">Origem da evidência</h3><p className="text-xs text-muted-foreground">A história selecionada define o código e o título iniciais.</p></div></div>
          <Field label="Projeto" id="dossier-project" required hint={currentTeamName ? `Time ativo: ${currentTeamName}. O projeto correspondente é sugerido automaticamente.` : `${data?.projects.length ?? 0} projeto(s) disponível(is).`}><ProjectCombobox id="dossier-project" value={projectId} options={data?.projects ?? []} onChange={setProjectId} currentTeamId={currentTeamId} /></Field>
          <Field label="História de usuário" id="dossier-story" hint={!projectId ? "Selecione primeiro um projeto." : stories.length === 0 ? "Nenhuma história encontrada nos times vinculados a este projeto." : `${stories.length} história(s) disponível(is).`}>
            <StoryCombobox id="dossier-story" value={storyId} options={stories} onChange={selectStory} disabled={!projectId} />
          </Field>
        </section>

        <section className="grid min-w-0 gap-4 rounded-lg border p-4" aria-labelledby="dossier-count-title">
          <div className="flex min-w-0 gap-3"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary"><Calculator className="h-4 w-4" aria-hidden="true" /></span><div className="min-w-0"><h3 id="dossier-count-title" className="text-sm font-semibold">Contagem APF</h3><p className="text-xs text-muted-foreground">Os nomes do modelo, baseline, sprint e release identificam cada sessão.</p></div></div>
          <Field label="Sessão de contagem" id="dossier-session" hint={projectId && sessions.length === 0 ? "Nenhuma sessão encontrada para este projeto. Você poderá vinculá-la depois." : undefined}>
            <SessionCombobox id="dossier-session" value={sessionId} options={sessions} onChange={setSessionId} disabled={!projectId} />
          </Field>
          <div className="grid min-w-0 gap-4 sm:grid-cols-2"><Field label="Código do dossiê" id="dossier-code"><Input id="dossier-code" className="min-h-11 min-w-0" value={code} onChange={(event) => setCode(event.target.value)} placeholder="APF-HU-063" required /></Field><Field label="Tipo de contagem" id="dossier-type"><Select value={countingType} onValueChange={(value) => setCountingType(value as ApfCountingType)}><SelectTrigger id="dossier-type" className="min-h-11 min-w-0"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="impact">Evolutiva por impacto</SelectItem><SelectItem value="project">Projeto</SelectItem><SelectItem value="corrective">Corretiva</SelectItem><SelectItem value="recount">Recontagem</SelectItem></SelectContent></Select></Field></div>
          <Field label="Título" id="dossier-title-input"><Input id="dossier-title-input" className="min-h-11" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Evidência de contagem da HU" required /></Field>
        </section>
      </div>}
    <DialogFooter data-testid="dossier-dialog-footer" className="relative z-10 shrink-0 flex-col-reverse gap-2 border-t bg-background px-5 py-4 sm:flex-row sm:px-6"><Button type="button" variant="outline" className="min-h-11 sm:min-w-28" onClick={() => onOpenChange(false)} disabled={saving}>Cancelar</Button><Button type="button" className="min-h-11 gap-2 sm:min-w-40" onClick={() => void submit()} disabled={saving || !projectId || !storyId || !code.trim() || !title.trim()}>{saving ? <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" /> : <Plus className="h-4 w-4" aria-hidden="true" />}{saving ? "Criando dossiê…" : "Criar dossiê"}</Button></DialogFooter>
  </DialogContent></Dialog>;
}

function Field({ label, id, hint, required, children }: { label: string; id: string; hint?: string; required?: boolean; children: ReactNode }) {
  return <div className="min-w-0 space-y-1.5"><Label htmlFor={id}>{label}{required && <span className="ml-1 text-destructive" aria-hidden="true">*</span>}</Label>{children}{hint && <p className="text-xs leading-relaxed text-muted-foreground">{hint}</p>}</div>;
}

function ProjectCombobox({ id, value, options, onChange, currentTeamId }: { id: string; value: string; options: ApfDossierCreationProject[]; onChange: (value: string) => void; currentTeamId: string | null }) {
  const [open, setOpen] = useState(false);
  const selected = options.find((item) => item.id === value);
  const orderedOptions = useMemo(
    () => [...options].sort((a, b) => Number(b.teamIds.includes(currentTeamId ?? "")) - Number(a.teamIds.includes(currentTeamId ?? "")) || a.name.localeCompare(b.name, "pt-BR")),
    [currentTeamId, options],
  );
  return <Popover open={open} onOpenChange={setOpen}><PopoverTrigger asChild><Button id={id} type="button" variant="outline" role="combobox" aria-expanded={open} className="min-h-11 w-full min-w-0 justify-between overflow-hidden px-3 font-normal"><span className={cn("min-w-0 truncate text-left", !selected && "text-muted-foreground")}>{selected ? `${selected.code ? `${selected.code} · ` : ""}${selected.name}` : "Selecione ou busque um projeto"}</span><ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" aria-hidden="true" /></Button></PopoverTrigger><PopoverContent sideOffset={6} collisionPadding={12} className="z-50 w-[var(--radix-popover-trigger-width)] max-w-[calc(100vw-1rem)] overflow-hidden p-0" align="start"><Command><CommandInput placeholder="Buscar por projeto, código ou contrato…" /><CommandList data-testid="dossier-project-list" className="max-h-[min(14rem,calc(var(--radix-popover-content-available-height)-3rem))] overscroll-contain"><CommandEmpty>Nenhum projeto encontrado.</CommandEmpty><CommandGroup>{orderedOptions.map((project) => { const isCurrentTeam = project.teamIds.includes(currentTeamId ?? ""); return <CommandItem key={project.id} value={`${project.code ?? ""} ${project.name} ${project.contractName}`} onSelect={() => { onChange(project.id); setOpen(false); }} className="items-start gap-2 py-3"><Check className={cn("mt-0.5 h-4 w-4 shrink-0", value === project.id ? "opacity-100" : "opacity-0")} aria-hidden="true" /><FolderKanban className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" /><span className="grid min-w-0 flex-1"><span className="truncate font-medium">{project.code ? `${project.code} · ` : ""}{project.name}</span><span className="truncate text-xs text-muted-foreground">{project.contractName}{isCurrentTeam ? " · Projeto do time ativo" : ""}</span></span></CommandItem>; })}</CommandGroup></CommandList></Command></PopoverContent></Popover>;
}

function StoryCombobox({ id, value, options, onChange, disabled }: { id: string; value: string; options: ApfDossierCreationUserStory[]; onChange: (value: string) => void; disabled: boolean }) {
  const [open, setOpen] = useState(false);
  const selected = options.find((item) => item.id === value);
  return <Popover open={open} onOpenChange={setOpen}><PopoverTrigger asChild><Button id={id} type="button" variant="outline" role="combobox" aria-expanded={open} disabled={disabled} className="min-h-11 w-full min-w-0 justify-between overflow-hidden px-3 font-normal"><span className={cn("min-w-0 truncate text-left", !selected && "text-muted-foreground")}>{selected ? `${selected.code} · ${selected.title}` : "Selecione ou busque uma história"}</span><ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" aria-hidden="true" /></Button></PopoverTrigger><PopoverContent sideOffset={6} collisionPadding={12} className="z-50 w-[var(--radix-popover-trigger-width)] max-w-[calc(100vw-1rem)] overflow-hidden p-0" align="start"><Command><CommandInput placeholder="Buscar por código ou título…" /><CommandList data-testid="dossier-story-list" className="max-h-[min(16rem,calc(var(--radix-popover-content-available-height)-3rem))] overscroll-contain"><CommandEmpty>Nenhuma história encontrada.</CommandEmpty><CommandGroup>{options.map((story) => <CommandItem key={story.id} value={`${story.code} ${story.title}`} onSelect={() => { onChange(story.id); setOpen(false); }} className="items-start gap-2 py-3"><Check className={cn("mt-0.5 h-4 w-4 shrink-0", value === story.id ? "opacity-100" : "opacity-0")} aria-hidden="true" /><span className="grid min-w-0"><span className="truncate font-medium">{story.code} · {story.title}</span><span className="text-xs text-muted-foreground">{formatApfStatus(story.status)}</span></span></CommandItem>)}</CommandGroup></CommandList></Command></PopoverContent></Popover>;
}

function SessionCombobox({ id, value, options, onChange, disabled }: { id: string; value: string; options: ApfDossierCreationSession[]; onChange: (value: string) => void; disabled: boolean }) {
  const [open, setOpen] = useState(false);
  const selected = options.find((item) => item.id === value);
  const selectedLabel = selected ? formatApfSessionOption(selected) : null;
  return <Popover open={open} onOpenChange={setOpen}><PopoverTrigger asChild><Button id={id} type="button" variant="outline" role="combobox" aria-expanded={open} disabled={disabled} className="min-h-11 w-full min-w-0 justify-between overflow-hidden px-3 font-normal"><span className="min-w-0 truncate text-left">{selectedLabel?.label ?? "Vincular posteriormente"}</span><ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" aria-hidden="true" /></Button></PopoverTrigger><PopoverContent sideOffset={6} collisionPadding={12} className="z-50 w-[var(--radix-popover-trigger-width)] max-w-[calc(100vw-1rem)] overflow-hidden p-0" align="start"><Command><CommandInput placeholder="Buscar modelo, baseline, sprint ou release…" /><CommandList className="max-h-[min(16rem,calc(var(--radix-popover-content-available-height)-3rem))] overscroll-contain"><CommandEmpty>Nenhuma sessão encontrada.</CommandEmpty><CommandGroup><CommandItem value="vincular posteriormente" onSelect={() => { onChange("none"); setOpen(false); }} className="items-start gap-2 py-3"><Check className={cn("mt-0.5 h-4 w-4 shrink-0", value === "none" ? "opacity-100" : "opacity-0")} aria-hidden="true" /><span className="grid min-w-0"><span className="font-medium">Vincular posteriormente</span><span className="text-xs text-muted-foreground">Crie o dossiê agora e associe uma contagem depois.</span></span></CommandItem>{options.map((session) => { const option = formatApfSessionOption(session); return <CommandItem key={session.id} value={`${option.label} ${option.description}`} onSelect={() => { onChange(session.id); setOpen(false); }} className="items-start gap-2 py-3"><Check className={cn("mt-0.5 h-4 w-4 shrink-0", value === session.id ? "opacity-100" : "opacity-0")} aria-hidden="true" /><span className="grid min-w-0"><span className="truncate font-medium">{option.label}</span><span className="text-xs text-muted-foreground">{option.description}</span></span></CommandItem>; })}</CommandGroup></CommandList></Command></PopoverContent></Popover>;
}
