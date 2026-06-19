/**
 * ApfTemplatesTab (v2 — Fase 3)
 * --------------------------------
 * Melhorias:
 *  1. Barra de busca por nome/descrição
 *  2. Filtros por módulo e por tipo de saída
 *  3. Badge de contador de variáveis no card
 *  4. Ordenação: ativos primeiro, depois por data
 *  5. Aba lateral "Lixeira" (inativos)
 */
import { useState, useEffect, useCallback, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge }  from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input }  from "@/components/ui/input";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuTrigger, DropdownMenuSeparator
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select";
import {
  Plus, MoreVertical, FileText, Table2, Copy, Trash2, Clock,
  FileCode, ShieldCheck, LayoutGrid, Wand2, Star, FileDown, Boxes, Search, Filter, X
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useApfModules } from "../hooks/useApfModules";
import { toast } from "sonner";
import { ApfTemplateModal } from "./ApfTemplateModal";
import {
  fetchTemplates, createTemplate, updateTemplate,
  duplicateTemplate, toggleTemplateActive, deleteTemplate,
  type ApfTemplate,
} from "../services/apf.service";
import { extractVariables } from "../utils/templateVariables";
import { cn } from "@/lib/utils";

function OutputTypeBadge({ type }: { type: string }) {
  if (type === "docx") return (
    <div className="flex items-center gap-1.5 text-[10px] font-semibold text-blue-600 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-md">
      <FileText className="h-3 w-3" /> DOCX
    </div>
  );
  if (type === "md") return (
    <div className="flex items-center gap-1.5 text-[10px] font-semibold text-violet-600 bg-violet-50 border border-violet-200 px-2 py-0.5 rounded-md">
      <FileDown className="h-3 w-3" /> Markdown
    </div>
  );
  return (
    <div className="flex items-center gap-1.5 text-[10px] font-semibold text-emerald-600 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md">
      <Table2 className="h-3 w-3" /> XLSX
    </div>
  );
}

function ModuleBadge({ name }: { name?: string | null }) {
  if (!name) return (
    <div className="flex items-center gap-1.5 text-[10px] font-semibold text-muted-foreground bg-muted border border-border px-2 py-0.5 rounded-md">
      <Boxes className="h-3 w-3" /> Todos
    </div>
  );
  return (
    <div className="flex items-center gap-1.5 text-[10px] font-semibold text-primary bg-primary/5 border border-primary/20 px-2 py-0.5 rounded-md max-w-[140px] truncate">
      <Boxes className="h-3 w-3 shrink-0" />
      <span className="truncate">{name}</span>
    </div>
  );
}

export function ApfTemplatesTab() {
  const { currentTeamId, user } = useAuth();
  const { modules } = useApfModules();

  const [templates, setTemplates]       = useState<ApfTemplate[]>([]);
  const [loading, setLoading]           = useState(true);
  const [modalOpen, setModalOpen]       = useState(false);
  const [editing, setEditing]           = useState<ApfTemplate | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ApfTemplate | null>(null);
  const [deleting, setDeleting]         = useState(false);

  // ── Filtros (Fase 3) ─────────────────────────────────────────────────
  const [search, setSearch]             = useState("");
  const [filterModule, setFilterModule] = useState("all");
  const [filterType, setFilterType]     = useState("all");
  const [showInactive, setShowInactive] = useState(false);

  const load = useCallback(async () => {
    if (!currentTeamId) return;
    setLoading(true);
    try { setTemplates(await fetchTemplates(currentTeamId)); }
    catch { toast.error("Erro ao carregar templates"); }
    finally { setLoading(false); }
  }, [currentTeamId]);

  useEffect(() => { load(); }, [load]);

  // ── Filtragem + ordenação (Fase 3) ─────────────────────────────────────
  const filtered = useMemo(() => {
    return templates
      .filter((t) => {
        if (!showInactive && !t.is_active) return false;
        if (showInactive && t.is_active)  return false;
        if (search) {
          const q = search.toLowerCase();
          if (!t.name.toLowerCase().includes(q) && !(t.description ?? "").toLowerCase().includes(q)) return false;
        }
        if (filterModule !== "all" && t.module_id !== filterModule) return false;
        if (filterType   !== "all" && t.output_type !== filterType)  return false;
        return true;
      })
      .sort((a, b) => {
        if (a.is_active !== b.is_active) return a.is_active ? -1 : 1;
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });
  }, [templates, search, filterModule, filterType, showInactive]);

  const activeCount   = templates.filter((t) =>  t.is_active).length;
  const inactiveCount = templates.filter((t) => !t.is_active).length;
  const hasFilters    = search || filterModule !== "all" || filterType !== "all";

  const clearFilters  = () => { setSearch(""); setFilterModule("all"); setFilterType("all"); };

  const handleSave = async (data: {
    name: string; description: string;
    output_type: string; prompt_content: string; module_id: string | null;
  }) => {
    try {
      if (editing) {
        await updateTemplate(editing.id, editing.version, data);
        toast.success("Template atualizado!");
      } else {
        if (!currentTeamId || !user?.id) throw new Error("Sessão ou time inválido");
        await createTemplate(currentTeamId, user.id, data);
        toast.success("Template criado!");
      }
      setModalOpen(false); setEditing(null); load();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Erro ao salvar template");
      throw e;
    }
  };

  const handleDuplicate = async (t: ApfTemplate) => {
    try { await duplicateTemplate(t); toast.success("Template duplicado!"); load(); }
    catch { toast.error("Erro ao duplicar"); }
  };

  const handleToggle = async (t: ApfTemplate) => {
    try {
      await toggleTemplateActive(t.id, t.is_active);
      toast.success(t.is_active ? "Template desativado" : "Template ativado");
      load();
    } catch { toast.error("Erro ao alterar status"); }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try { await deleteTemplate(deleteTarget.id); toast.success("Template excluído!"); setDeleteTarget(null); load(); }
    catch { toast.error("Erro ao excluir template"); }
    finally { setDeleting(false); }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-32 space-y-3">
        <div className="h-8 w-8 rounded-full border-2 border-primary/20 border-t-primary animate-spin" />
        <p className="text-xs text-muted-foreground">Carregando templates...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-4 border-b border-border">
        <div className="min-w-0">
          <h2 className="text-base font-semibold flex items-center gap-2">
            <LayoutGrid className="h-4 w-4 text-primary shrink-0" />
            Gerenciar Templates
          </h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            {activeCount} ativo{activeCount !== 1 ? "s" : ""}{inactiveCount > 0 && `, ${inactiveCount} inativo${inactiveCount !== 1 ? "s" : ""}`}
          </p>
        </div>
        <Button size="sm" onClick={() => { setEditing(null); setModalOpen(true); }} className="gap-2 shrink-0">
          <Plus className="h-4 w-4" /> Novo Template
        </Button>
      </div>

      {/* Toggle Ativos / Inativos */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setShowInactive(false)}
          className={cn(
            "text-xs px-3 py-1.5 rounded-md border transition-colors",
            !showInactive ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:bg-muted"
          )}
        >
          Ativos ({activeCount})
        </button>
        <button
          type="button"
          onClick={() => setShowInactive(true)}
          className={cn(
            "text-xs px-3 py-1.5 rounded-md border transition-colors",
            showInactive ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:bg-muted"
          )}
        >
          Inativos ({inactiveCount})
        </button>
      </div>

      {/* Barra de busca e filtros */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nome ou descrição..."
            className="pl-9 h-9"
          />
        </div>
        <Select value={filterModule} onValueChange={setFilterModule}>
          <SelectTrigger className="w-full sm:w-44 h-9">
            <Filter className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" />
            <SelectValue placeholder="Módulo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os módulos</SelectItem>
            {modules.map((m) => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="w-full sm:w-36 h-9">
            <SelectValue placeholder="Tipo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os tipos</SelectItem>
            <SelectItem value="docx">DOCX</SelectItem>
            <SelectItem value="md">Markdown</SelectItem>
          </SelectContent>
        </Select>
        {hasFilters && (
          <Button size="sm" variant="ghost" onClick={clearFilters} className="gap-1.5 h-9 text-muted-foreground">
            <X className="h-3.5 w-3.5" /> Limpar
          </Button>
        )}
      </div>

      {/* Grid de cards */}
      {filtered.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16 space-y-4">
            <Wand2 className="h-8 w-8 text-muted-foreground/40" />
            <div className="text-center">
              <p className="text-sm font-medium">
                {hasFilters ? "Nenhum template encontrado com estes filtros" : "Nenhum template aqui"}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {hasFilters ? "Tente limpar os filtros." : (showInactive ? "Todos os templates estão ativos." : "Crie o primeiro template.")}
              </p>
            </div>
            {!hasFilters && !showInactive && (
              <Button variant="outline" size="sm" onClick={() => { setEditing(null); setModalOpen(true); }}>
                Criar primeiro template
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((t) => {
            const varCount = extractVariables(t.prompt_content ?? "").length;
            return (
              <Card key={t.id} className={cn(
                "relative overflow-hidden transition-shadow hover:shadow-md border-l-4",
                t.is_active ? "border-l-primary" : "border-l-border opacity-75"
              )}>
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 space-y-1">
                      <CardTitle className="text-sm font-semibold truncate flex items-center gap-1.5">
                        {t.is_active
                          ? <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400 shrink-0" />
                          : <Clock className="h-3.5 w-3.5 text-muted-foreground shrink-0" />}
                        {t.name}
                      </CardTitle>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <Badge variant="outline" className="text-[10px] h-4 px-1.5">v{t.version}</Badge>
                        {t.is_active
                          ? <Badge className="text-[10px] h-4 px-1.5 bg-emerald-500/10 text-emerald-600 border-emerald-200 hover:bg-emerald-500/10">Ativo</Badge>
                          : <Badge variant="secondary" className="text-[10px] h-4 px-1.5">Inativo</Badge>}
                        {varCount > 0 && (
                          <Badge variant="outline" className="text-[10px] h-4 px-1.5 border-primary/30 text-primary">
                            {varCount} var{varCount !== 1 ? "s" : ""}
                          </Badge>
                        )}
                      </div>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-48">
                        <DropdownMenuItem onClick={() => { setEditing(t); setModalOpen(true); }} className="gap-2 text-sm">
                          <FileCode className="h-4 w-4" /> Editar
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleDuplicate(t)} className="gap-2 text-sm">
                          <Copy className="h-4 w-4" /> Duplicar
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleToggle(t)} className="gap-2 text-sm">
                          <ShieldCheck className={cn("h-4 w-4", t.is_active ? "text-amber-500" : "text-emerald-500")} />
                          {t.is_active ? "Desativar" : "Ativar"}
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={() => setDeleteTarget(t)}
                          className="gap-2 text-sm text-destructive focus:text-destructive focus:bg-destructive/5"
                        >
                          <Trash2 className="h-4 w-4" /> Excluir
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </CardHeader>

                <CardContent className="space-y-3 pt-0">
                  {t.description && (
                    <p className="text-xs text-muted-foreground line-clamp-2">{t.description}</p>
                  )}
                  <div className="flex items-center justify-between pt-2 border-t border-border gap-2 flex-wrap">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <OutputTypeBadge type={t.output_type} />
                      <ModuleBadge name={t.apf_modules?.name} />
                    </div>
                    <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                      <Clock className="h-2.5 w-2.5" />
                      {new Date(t.created_at).toLocaleDateString("pt-BR")}
                    </span>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <ApfTemplateModal
        open={modalOpen}
        onClose={() => { setModalOpen(false); setEditing(null); }}
        onSave={handleSave}
        template={editing}
      />

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir template?</AlertDialogTitle>
            <AlertDialogDescription>
              O template <strong>{deleteTarget?.name}</strong> será excluído permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {deleting ? "Excluindo..." : "Excluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
