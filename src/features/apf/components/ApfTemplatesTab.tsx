import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Plus, MoreVertical, FileText, Table2, Copy, Trash2, CheckCircle2, History, Wand2 } from "lucide-react";
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
      <div className="flex items-center justify-center py-20">
        <Loader2 className="animate-spin h-8 w-8 text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-foreground">Galeria de Templates</h2>
          <p className="text-xs text-muted-foreground">Gerencie seus prompts mestres ativos para geração de evidências.</p>
        </div>
        <Button size="sm" onClick={() => { setEditing(null); setModalOpen(true); }} className="shadow-sm">
          <Plus className="h-4 w-4 mr-1" /> Novo Template
        </Button>
      </div>

      {templates.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-20 space-y-4">
            <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center">
              <Wand2 className="h-8 w-8 text-muted-foreground/40" />
            </div>
            <div className="text-center">
              <p className="font-semibold">Nenhum template cadastrado</p>
              <p className="text-xs text-muted-foreground max-w-[250px] mt-1">Crie templates personalizados para padronizar a saída da sua IA.</p>
            </div>
            <Button variant="outline" size="sm" onClick={() => { setEditing(null); setModalOpen(true); }}>Criar primeiro template</Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {templates.map((t) => (
            <Card key={t.id} className={cn(
              "relative overflow-hidden group transition-all duration-300 hover:shadow-lg border-border/50",
              !t.is_active && "opacity-75 grayscale-[0.5]"
            )}>
              <div className={cn(
                "absolute top-0 left-0 w-1 h-full",
                t.is_active ? "bg-primary" : "bg-muted-foreground/30"
              )} />

              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <CardTitle className="text-base font-bold leading-none pr-6 group-hover:text-primary transition-colors">{t.name}</CardTitle>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-[9px] uppercase tracking-tighter px-1 h-4">v{t.version}</Badge>
                      {t.is_active ? (
                        <Badge className="bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/10 border-emerald-200 text-[9px] h-4">Ativo</Badge>
                      ) : (
                        <Badge variant="secondary" className="text-[9px] h-4">Inativo</Badge>
                      )}
                    </div>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0 hover:bg-muted">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-48">
                      <DropdownMenuItem onClick={() => { setEditing(t); setModalOpen(true); }} className="gap-2">
                        <FileText className="h-4 w-4" /> Editar Template
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleDuplicate(t)} className="gap-2">
                        <Copy className="h-4 w-4" /> Duplicar
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleToggle(t)} className="gap-2">
                        <CheckCircle2 className="h-4 w-4" /> {t.is_active ? "Desativar" : "Ativar"}
                      </DropdownMenuItem>
                      <DropdownMenuItem className="gap-2 text-destructive focus:text-destructive">
                        <Trash2 className="h-4 w-4" /> Excluir
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </CardHeader>

              <CardContent className="space-y-4">
                <p className="text-xs text-muted-foreground line-clamp-3 min-h-[48px] leading-relaxed">
                  {t.description || "Sem descrição disponível para este template mestre."}
                </p>

                <div className="flex items-center justify-between pt-2 border-t border-border/40">
                  <div className="flex items-center gap-1.5">
                    {t.output_type === "docx" ? (
                      <div className="flex items-center gap-1 text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded uppercase">
                        <FileText className="h-3 w-3" /> DOCX
                      </div>
                    ) : (
                      <div className="flex items-center gap-1 text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded uppercase">
                        <Table2 className="h-3 w-3" /> XLSX
                      </div>
                    )}
                  </div>
                  <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                    <History className="h-3 w-3" />
                    {new Date(t.created_at).toLocaleDateString("pt-BR")}
                  </span>
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

function Loader2(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </svg>
  );
}
