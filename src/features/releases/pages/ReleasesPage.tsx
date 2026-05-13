import { useState, useEffect } from "react";
import { useReleases } from "../hooks/useReleases";
import { Button }  from "@/components/ui/button";
import { Badge }   from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Input }   from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tag, Plus, Trash2, Edit2, ChevronDown, ChevronUp, FileText } from "lucide-react";
import type { Release, ReleaseStatus, ReleaseHU } from "../hooks/useReleases";

const STATUS_CONFIG: Record<ReleaseStatus, { label: string; color: string }> = {
  planned:     { label: "Planejada",    color: "text-blue-500 border-blue-300 bg-blue-50/40 dark:bg-blue-950/20" },
  in_progress: { label: "Em progresso", color: "text-amber-500 border-amber-300 bg-amber-50/40 dark:bg-amber-950/20" },
  released:    { label: "Lançada",      color: "text-emerald-600 border-emerald-300 bg-emerald-50/40 dark:bg-emerald-950/20" },
  cancelled:   { label: "Cancelada",    color: "text-muted-foreground border-border" },
};

const DONE_STATUSES = ["done", "concluido", "concluído"];

export function ReleasesPage() {
  const { releases, sprints, loading, createRelease, updateRelease, deleteRelease, getHUs } = useReleases();
  const [newOpen,    setNewOpen]    = useState(false);
  const [editTarget, setEditTarget] = useState<Release | null>(null);
  const [expanded,   setExpanded]   = useState<string | null>(null);
  const [huMap,      setHuMap]      = useState<Record<string, ReleaseHU[]>>({});

  // Form state
  const [version,    setVersion]    = useState("");
  const [name,       setName]       = useState("");
  const [status,     setStatus]     = useState<ReleaseStatus>("planned");
  const [releaseDate,setReleaseDate]= useState("");
  const [description,setDescription]= useState("");
  const [changelog,  setChangelog]  = useState("");
  const [selectedSprints, setSelectedSprints] = useState<string[]>([]);

  const resetForm = () => { setVersion(""); setName(""); setStatus("planned"); setReleaseDate(""); setDescription(""); setChangelog(""); setSelectedSprints([]); };

  const openEdit = (r: Release) => {
    setEditTarget(r);
    setVersion(r.version); setName(r.name); setStatus(r.status);
    setReleaseDate(r.release_date ?? ""); setDescription(r.description ?? "");
    setChangelog(r.changelog ?? ""); setSelectedSprints(r.sprint_ids ?? []);
  };

  const handleSave = async () => {
    const data = { version, name, status, release_date: releaseDate || null, description: description || null, changelog: changelog || null, sprint_ids: selectedSprints };
    if (editTarget) { await updateRelease(editTarget.id, data); setEditTarget(null); }
    else { await createRelease(data as any); setNewOpen(false); }
    resetForm();
  };

  const toggleExpand = async (r: Release) => {
    if (expanded === r.id) { setExpanded(null); return; }
    setExpanded(r.id);
    if (!huMap[r.id]) {
      const hus = await getHUs(r.sprint_ids ?? []);
      setHuMap(prev => ({ ...prev, [r.id]: hus }));
    }
  };

  const toggleSprint = (id: string) =>
    setSelectedSprints(prev => prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]);

  if (loading) return <div className="space-y-3 p-4">{[1,2,3].map(i => <Skeleton key={i} className="h-24 rounded-xl" />)}</div>;

  const FormDialog = ({ open, onClose, title }: { open: boolean; onClose: () => void; title: string }) => (
    <Dialog open={open} onOpenChange={v => { if (!v) { onClose(); resetForm(); } }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>{title}</DialogTitle></DialogHeader>
        <div className="space-y-3 py-1">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium">Versão *</label>
              <Input value={version} onChange={e => setVersion(e.target.value)} className="h-8 text-xs" placeholder="ex: v2.1.0" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium">Status</label>
              <Select value={status} onValueChange={v => setStatus(v as ReleaseStatus)}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>{Object.entries(STATUS_CONFIG).map(([k,v]) => <SelectItem key={k} value={k} className="text-xs">{v.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium">Nome</label>
            <Input value={name} onChange={e => setName(e.target.value)} className="h-8 text-xs" placeholder="ex: Release Kanban Avançado" />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium">Data de lançamento</label>
            <Input type="date" value={releaseDate} onChange={e => setReleaseDate(e.target.value)} className="h-8 text-xs" />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium">Sprints incluídos</label>
            <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto rounded-lg border border-border p-2">
              {sprints.map(s => (
                <button key={s.id} onClick={() => toggleSprint(s.id)}
                  className={`px-2 py-0.5 rounded text-[10px] border transition-colors ${
                    selectedSprints.includes(s.id)
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-muted/30 border-border hover:border-primary/50"
                  }`}>{s.name}</button>
              ))}
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium">Descrição</label>
            <Textarea value={description} onChange={e => setDescription(e.target.value)} className="text-xs min-h-16 resize-none" placeholder="Objetivo desta release..." />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium">Changelog (Markdown)</label>
            <Textarea value={changelog} onChange={e => setChangelog(e.target.value)} className="text-xs min-h-24 resize-none font-mono" placeholder="## O que há de novo\n- Feature X\n- Correção Y" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => { onClose(); resetForm(); }} className="text-xs h-8">Cancelar</Button>
          <Button onClick={handleSave} disabled={!version} className="text-xs h-8 gap-1"><Plus className="h-3.5 w-3.5" /> Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  return (
    <div className="space-y-6 p-4 max-w-5xl mx-auto">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-lg font-bold flex items-center gap-2"><Tag className="h-5 w-5 text-primary" /> Releases</h1>
          <p className="text-xs text-muted-foreground mt-0.5">Gerencie versões e changelogs do projeto.</p>
        </div>
        <Button size="sm" className="gap-1.5" onClick={() => setNewOpen(true)}><Plus className="h-3.5 w-3.5" /> Nova Release</Button>
      </div>

      {releases.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground">
          <Tag className="h-10 w-10 opacity-20" />
          <p className="text-sm">Nenhuma release criada.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {releases.map(r => {
            const cfg = STATUS_CONFIG[r.status];
            const hus  = huMap[r.id] ?? [];
            const isExpanded = expanded === r.id;
            const doneHUs = hus.filter(h => DONE_STATUSES.some(ds => h.status?.toLowerCase().includes(ds)));
            return (
              <div key={r.id} className="rounded-xl border border-border bg-card overflow-hidden">
                <div className="flex items-start justify-between gap-4 p-4">
                  <div className="flex items-start gap-3">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-sm font-mono">{r.version}</span>
                        {r.name && <span className="text-sm text-muted-foreground">{r.name}</span>}
                        <Badge variant="outline" className={`text-[10px] ${cfg.color}`}>{cfg.label}</Badge>
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-[11px] text-muted-foreground">
                        {r.release_date && <span>📅 {r.release_date}</span>}
                        {r.hu_count !== undefined && (
                          <span>📦 {r.done_count}/{r.hu_count} HUs concluídas</span>
                        )}
                        {r.sprint_ids?.length > 0 && <span>🏋 {r.sprint_ids.length} sprint{r.sprint_ids.length !== 1 ? "s" : ""}</span>}
                      </div>
                      {r.description && <p className="text-xs text-muted-foreground mt-1.5 max-w-xl">{r.description}</p>}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(r)}><Edit2 className="h-3.5 w-3.5" /></Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => deleteRelease(r.id)}><Trash2 className="h-3.5 w-3.5 text-muted-foreground" /></Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => toggleExpand(r)}>
                      {isExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                    </Button>
                  </div>
                </div>

                {isExpanded && (
                  <div className="border-t border-border">
                    <Tabs defaultValue="hus" className="p-4">
                      <TabsList className="mb-3">
                        <TabsTrigger value="hus" className="text-xs gap-1">📦 HUs ({hus.length})</TabsTrigger>
                        {r.changelog && <TabsTrigger value="changelog" className="text-xs gap-1"><FileText className="h-3 w-3" /> Changelog</TabsTrigger>}
                      </TabsList>
                      <TabsContent value="hus">
                        {hus.length === 0 ? (
                          <p className="text-xs text-muted-foreground">Nenhuma HU nos sprints desta release.</p>
                        ) : (
                          <div className="space-y-1.5">
                            {hus.map(h => (
                              <div key={h.id} className="flex items-center justify-between gap-3 rounded-lg border border-border/50 px-3 py-2 text-xs hover:bg-muted/30">
                                <div className="flex items-center gap-2 min-w-0">
                                  <span className="font-mono text-[10px] text-muted-foreground shrink-0">{h.code}</span>
                                  <span className="truncate">{h.title}</span>
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                  <span className="text-muted-foreground text-[10px]">{h.assignee}</span>
                                  <Badge variant={DONE_STATUSES.some(ds => h.status.toLowerCase().includes(ds)) ? "default" : "secondary"} className="text-[9px]">
                                    {DONE_STATUSES.some(ds => h.status.toLowerCase().includes(ds)) ? "✅" : h.status}
                                  </Badge>
                                  {h.story_points > 0 && <Badge variant="outline" className="text-[9px]">{h.story_points}pt</Badge>}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </TabsContent>
                      {r.changelog && (
                        <TabsContent value="changelog">
                          <pre className="text-xs text-muted-foreground whitespace-pre-wrap font-mono bg-muted/30 rounded-lg p-3">{r.changelog}</pre>
                        </TabsContent>
                      )}
                    </Tabs>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <FormDialog open={newOpen} onClose={() => setNewOpen(false)} title="Nova Release" />
      <FormDialog open={!!editTarget} onClose={() => setEditTarget(null)} title="Editar Release" />
    </div>
  );
}
