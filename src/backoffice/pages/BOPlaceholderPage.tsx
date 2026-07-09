import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

const COPY: Record<string, { title: string; description: string; cta?: string; to?: string }> = {
  clientes: {
    title: "Clientes",
    description:
      "Listagem e detalhe de tenants entram no proximo lote. Por enquanto, use Assinaturas para plano e status das organizacoes.",
    cta: "Abrir assinaturas",
    to: "/platform/subscriptions",
  },
  financeiro: {
    title: "Financeiro",
    description:
      "Faturas, receitas e inadimplencia serao implementadas sobre billing_records no lote financeiro.",
    cta: "Gerenciar planos",
    to: "/platform/plans",
  },
  suporte: {
    title: "Suporte",
    description:
      "Tickets e helpdesk serao adicionados com workflow proprio e SLA visual.",
  },
  analitico: {
    title: "Analitico SaaS",
    description:
      "Metricas como MRR, ARR, churn e conversao trial para pago entram apos a base financeira.",
  },
  configuracoes: {
    title: "Configuracoes",
    description:
      "Preferencias do Backoffice e trilhas de auditoria administrativas entram nos lotes de refinamento.",
  },
};

export default function BOPlaceholderPage({ kind }: { kind: keyof typeof COPY }) {
  const copy = COPY[kind];

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold">{copy.title}</h1>
        <p className="text-sm text-muted-foreground">Backoffice Roberto Sales LTDA</p>
      </div>

      <Card>
        <CardContent className="space-y-4 p-6">
          <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
            {copy.description}
          </p>
          {copy.cta && copy.to && (
            <Button asChild className="gap-2">
              <Link to={copy.to}>
                {copy.cta}
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
