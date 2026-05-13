import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  Sparkles,
  ListTodo,
  Kanban,
  PlayCircle,
  CheckCircle2,
  ChevronRight,
  ChevronLeft,
  Rocket,
  SkipForward,
} from "lucide-react";
import { useNavigate } from "react-router-dom";

interface Step {
  id: number;
  icon: React.ReactNode;
  title: string;
  description: string;
  tip: string;
  action?: { label: string; path: string };
}

const STEPS: Step[] = [
  {
    id: 1,
    icon: <Sparkles className="h-10 w-10 text-primary" />,
    title: "Bem-vindo ao AXION — Sala Ágil!",
    description:
      "O AXION é sua central de gestão ágil: sprints, backlog, Kanban, Planning Poker, Retrospectivas e muito mais, tudo integrado em um único lugar.",
    tip: "💡 Este tutorial leva menos de 2 minutos e pode ser refeito a qualquer momento em Configurações.",
  },
  {
    id: 2,
    icon: <ListTodo className="h-10 w-10 text-success" />,
    title: "Crie seu primeiro Sprint",
    description:
      "Sprints são ciclos de trabalho com duração definida (geralmente 1–2 semanas). No Backlog você cria, ativa e gerencia sprints e as Histórias de Usuário (HUs) que os compõem.",
    tip: "✅ Dica: ative apenas um sprint por vez para manter o foco da equipe.",
    action: { label: "Ir para o Backlog", path: "/sala-agil/backlog" },
  },
  {
    id: 3,
    icon: <Kanban className="h-10 w-10 text-warning" />,
    title: "Adicione Histórias de Usuário",
    description:
      "Cada HU representa uma funcionalidade do ponto de vista do usuário. Use o formato \"Como [perfil], quero [ação], para [objetivo]\" e associe critérios de aceite claros.",
    tip: "🎯 Dica: defina HUs pequenas o suficiente para concluir em 1 sprint.",
    action: { label: "Ver Backlog", path: "/sala-agil/backlog" },
  },
  {
    id: 4,
    icon: <PlayCircle className="h-10 w-10 text-primary" />,
    title: "Configure o Planning Poker",
    description:
      "O Planning Poker permite que sua equipe estime o esforço de cada HU de forma colaborativa. Escolha o baralho (Fibonacci, Horas ou Customizado), inicie uma sessão e vote em tempo real.",
    tip: "🃏 Dica: use o baralho \"Referência em Horas\" para alinhar estimativas com a capacidade real do time.",
    action: { label: "Abrir Planning Poker", path: "/sala-agil/planning-poker" },
  },
  {
    id: 5,
    icon: <CheckCircle2 className="h-10 w-10 text-success" />,
    title: "Tudo pronto! 🚀",
    description:
      "Você já sabe o básico para começar. Explore também o Kanban para acompanhar o progresso das HUs, as Retrospectivas ao final de cada sprint e os Relatórios para métricas da equipe.",
    tip: "🔄 Para refazer este tutorial, acesse Configurações → Geral → Refazer tutorial.",
  },
];

interface OnboardingWizardProps {
  open: boolean;
  onComplete: () => void;
}

export function OnboardingWizard({ open, onComplete }: OnboardingWizardProps) {
  const [step, setStep] = useState(0);
  const navigate = useNavigate();
  const current = STEPS[step];
  const isFirst = step === 0;
  const isLast = step === STEPS.length - 1;

  const handleNext = () => {
    if (isLast) { onComplete(); return; }
    setStep((s) => s + 1);
  };

  const handleBack = () => setStep((s) => Math.max(0, s - 1));

  const handleAction = (path: string) => {
    onComplete();
    navigate(path);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onComplete(); }}>
      <DialogContent className="max-w-lg" onInteractOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <div className="flex items-center gap-1.5 mb-4">
            {STEPS.map((s, i) => (
              <div
                key={s.id}
                className={cn(
                  "h-1.5 rounded-full transition-all",
                  i <= step ? "bg-primary" : "bg-muted",
                  i === step ? "flex-[2]" : "flex-1",
                )}
              />
            ))}
          </div>

          <div className="flex flex-col items-center text-center gap-3 py-2">
            {current.icon}
            <Badge variant="outline" className="text-[10px] font-mono">
              Passo {step + 1} de {STEPS.length}
            </Badge>
            <DialogTitle className="text-lg leading-snug">{current.title}</DialogTitle>
            <DialogDescription className="text-sm text-foreground/80 leading-relaxed">
              {current.description}
            </DialogDescription>
          </div>

          <div className="mt-3 rounded-lg bg-muted/50 border px-4 py-2.5">
            <p className="text-xs text-muted-foreground">{current.tip}</p>
          </div>
        </DialogHeader>

        <DialogFooter className="flex-col sm:flex-row gap-2 pt-2">
          <div className="flex items-center gap-2 w-full sm:w-auto">
            {!isLast && (
              <Button variant="ghost" size="sm" className="text-muted-foreground gap-1 text-xs" onClick={onComplete}>
                <SkipForward className="h-3.5 w-3.5" /> Pular tutorial
              </Button>
            )}
          </div>

          <div className="flex items-center gap-2 ml-auto">
            {!isFirst && (
              <Button variant="outline" size="sm" onClick={handleBack} className="gap-1">
                <ChevronLeft className="h-4 w-4" /> Anterior
              </Button>
            )}

            {current.action && (
              <Button
                variant="outline"
                size="sm"
                className="gap-1 border-primary/40 text-primary hover:bg-primary/5"
                onClick={() => handleAction(current.action!.path)}
              >
                {current.action.label} <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            )}

            <Button size="sm" onClick={handleNext} className="gap-1">
              {isLast ? (
                <><Rocket className="h-4 w-4" /> Começar!</>
              ) : (
                <>Próximo <ChevronRight className="h-4 w-4" /></>
              )}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
