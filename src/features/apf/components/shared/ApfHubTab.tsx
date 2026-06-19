/**
 * ApfHubTab
 * ---------
 * Hub central do APF — provedor de IA compartilhado entre todas as abas.
 */
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Bot } from "lucide-react";

export function ApfHubTab() {
  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Bot className="h-5 w-5 text-primary" />
            Hub de IA
          </CardTitle>
          <CardDescription>
            Escolha o provedor de IA usado em todas as abas do APF. Lovable AI é grátis e recomendado.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Configure o provedor de IA padrão em <strong>Admin → IAs</strong>. As demais abas
            (Gerar HUs, Contar PF, Gerar Doc, Previsão) usarão automaticamente o provedor ativo.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}