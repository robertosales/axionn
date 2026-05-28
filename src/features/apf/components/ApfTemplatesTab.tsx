import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator
} from "@/components/ui/dropdown-menu";
import {
  Plus,
  MoreVertical,
  FileText,
  Table2,
  Copy,
  Trash2,
  CheckCircle2,
  History,
  Wand2,
  LayoutGrid,
  Star,
  Clock,
  FileCode,
  ShieldCheck,
  Zap
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { ApfTemplateModal } from "./ApfTemplateModal";
import {
  fetchTemplates,
  createTemplate,
  updateTemplate,
  duplicateTemplate,
  toggleTemplateActive,
  type ApfTemplate,
} from "../services/apf.service";
import { cn } from "@/lib/utils";

export function ApfTemplatesTab() {
  const { currentTeamId, user } = useAuth();
  const [templates, setTemplates] = useState<ApfTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<ApfTemplate | null>(null);

  const load = useCallback(async () => {
    if (!currentTeamId) return;
    setLoading(true);
    try {
      setTemplates(await fetchTemplates(currentTeamId));
    } catch {
      toast.error("Erro ao carregar templates");
    } finally {
      setLoading(false);
    }
  }, [currentTeamId]);

  useEffect(() => { load(); }, [load]);

  const handleSave = async (data: { name: string; description: string; output_type: string; prompt_content: string }) => {
    if (editing) {
      await updateTemplate(editing.id, editing.version, data);
      toast.success("Template atualizado!");
    } else {
      await createTemplate(currentTeamId!, user!.id, data);
      toast.success("Template criado!");
    }
    setEditing(null);
    load();
  };

  const handleDuplicate = async (t: ApfTemplate) => {
    try {
      await duplicateTemplate(t);
      toast.success("Template duplicado!");
      load();
    } catch {
      toast.error("Erro ao duplicar");
    }
  };

  const handleToggle = async (t: ApfTemplate) => {
    try {
      await toggleTemplateActive(t.id, t.is_active);
      toast.success(t.is_active ? "Template desativado" : "Template ativado");
      load();
    } catch {
      toast.error("Erro ao alterar status");
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-32 space-y-4">
        <div className="relative">
          <div className="h-12 w-12 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
          <Zap className="h-4 w-4 text-primary absolute inset-0 m-auto animate-pulse" />
        </div>
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">
          Sincronizando Galeria...
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-muted/30 p-6 rounded-2xl border border-border/50 shadow-sm">
        <div className="space-y-1">
          <h2 className="text-xl font-black text-foreground flex items-center gap-2 tracking-tighter uppercase">
            <LayoutGrid className="h-5 w-5 text-primary" />
            Galeria de Templates Mestres
          </h2>
          <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest opacity-70">
            Gerencie prompts ativos, rascunhos e padrões corporativos.
          </p>
        </div>
        <Button
          size="lg"
          onClick={() => { setEditing(null); setModalOpen(true); }}
          className="shadow-xl shadow-primary/20 font-black uppercase text-xs tracking-tighter h-12 px-6"
        >
          <Plus className="h-4 w-4 mr-2" /> Novo Template
        </Button>
      </div>

      {templates.length === 0 ? (
        <Card className="border-2 border-dashed border-border/50 bg-muted/5 rounded-3xl overflow-hidden">
          <CardContent className="flex flex-col items-center justify-center py-32 space-y-6">
            <div className="h-20 w-20 rounded-3xl bg-background shadow-2xl border border-border flex items-center justify-center rotate-3 hover:rotate-0 transition-transform duration-500">
              <Wand2 className="h-10 w-10 text-primary/40" />
            </div>
            <div className="text-center space-y-2">
              <p className="text-lg font-black uppercase tracking-tighter">Nenhum template encontrado</p>
              <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest max-w-[300px] opacity-60">
                Crie templates personalizados para padronizar a engenharia de requisitos.
              </p>
            </div>
            <Button variant="outline" className="font-black uppercase text-[10px] h-10 px-8 border-2" onClick={() => { setEditing(null); setModalOpen(true); }}>
              Criar primeiro template
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {templates.map((t) => (
            <Card key={t.id} className={cn(
              "relative overflow-hidden group transition-all duration-500 hover:shadow-2xl hover:-translate-y-1 border-border/50 rounded-2xl",
              !t.is_active && "opacity-75 grayscale-[0.3]"
            )}>
              {/* Status Header */}
              <div className={cn(
                "h-1.5 w-full",
                t.is_active ? "bg-primary shadow-[0_0_10px_rgba(var(--primary),0.5)]" : "bg-muted-foreground/20"
              )} />

              <CardHeader className="pb-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1.5 min-w-0">
                    <div className="flex items-center gap-2">
                      <CardTitle className="text-base font-black leading-tight truncate uppercase tracking-tight group-hover:text-primary transition-colors">
                        {t.name}
                      </CardTitle>
                      {t.is_active ? (
                        <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400 shrink-0" />
                      ) : (
                        <Clock className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-[9px] font-black uppercase tracking-tighter px-1.5 h-4 bg-muted/50 border-border/50">
                        v{t.version}
                      </Badge>
                      {t.is_active ? (
                        <Badge className="bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/10 border-emerald-200 text-[9px] font-black uppercase h-4 px-1.5">
                          ATIVO
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="text-[9px] font-black uppercase h-4 px-1.5 bg-muted/80">
                          INATIVO
                        </Badge>
                      )}
                    </div>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0 hover:bg-muted rounded-xl transition-all">
                        <MoreVertical className="h-5 w-5" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-56 p-2 rounded-xl shadow-2xl border-border/50">
                      <div className="px-2 py-1.5 mb-1 text-[9px] font-black uppercase text-muted-foreground tracking-widest">
                        Ações do Template
                      </div>
                      <DropdownMenuItem onClick={() => { setEditing(t); setModalOpen(true); }} className="gap-3 rounded-lg py-2 font-bold text-xs uppercase tracking-tight">
                        <FileCode className="h-4 w-4 text-primary" /> Editar Estrutura
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleDuplicate(t)} className="gap-3 rounded-lg py-2 font-bold text-xs uppercase tracking-tight">
                        <Copy className="h-4 w-4 text-primary" /> Duplicar Prompt
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleToggle(t)} className="gap-3 rounded-lg py-2 font-bold text-xs uppercase tracking-tight">
                        <ShieldCheck className={cn("h-4 w-4", t.is_active ? "text-amber-500" : "text-emerald-500")} />
                        {t.is_active ? "Desativar" : "Ativar Template"}
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem className="gap-3 rounded-lg py-2 font-bold text-xs uppercase tracking-tight text-destructive focus:text-destructive focus:bg-destructive/5">
                        <Trash2 className="h-4 w-4" /> Excluir Permanentemente
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </CardHeader>

              <CardContent className="space-y-6 pt-0">
                <p className="text-[11px] font-medium text-muted-foreground line-clamp-3 min-h-[48px] leading-relaxed">
                  {t.description || "Este template mestre não possui uma descrição técnica definida. Configure para orientar outros usuários."}
                </p>

                <div className="flex items-center justify-between pt-4 border-t border-border/30">
                  <div className="flex items-center gap-2">
                    {t.output_type === "docx" ? (
                      <div className="flex items-center gap-1.5 text-[9px] font-black text-blue-600 bg-blue-50 px-2 py-1 rounded-md uppercase tracking-tight">
                        <FileText className="h-3 w-3" /> DOCX
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5 text-[9px] font-black text-emerald-600 bg-emerald-50 px-2 py-1 rounded-md uppercase tracking-tight">
                        <Table2 className="h-3 w-3" /> XLSX
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col items-end">
                    <span className="text-[9px] font-bold text-muted-foreground flex items-center gap-1 uppercase opacity-60">
                      <Clock className="h-2.5 w-2.5" />
                      {new Date(t.created_at).toLocaleDateString("pt-BR")}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <ApfTemplateModal
        open={modalOpen}
        onClose={() => { setModalOpen(false); setEditing(null); }}
        onSave={handleSave}
        template={editing}
      />
    </div>
  );
}
