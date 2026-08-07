import { Component, type ErrorInfo, type ReactNode } from "react";
import { RefreshCw, TriangleAlert } from "lucide-react";

import { Button } from "@/components/ui/button";
import { isChunkLoadError, retryApplication } from "@/lib/chunkRecovery";

type Props = { children: ReactNode };
type State = { error: Error | null };

export class AppErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error("[AppErrorBoundary] Falha não recuperada na interface.", error, info);
  }

  render(): ReactNode {
    if (!this.state.error) return this.props.children;

    const outdatedVersion = isChunkLoadError(this.state.error);
    return (
      <main className="flex min-h-screen items-center justify-center bg-background px-4 py-10 text-foreground">
        <section
          className="w-full max-w-lg rounded-2xl border border-border bg-card p-6 text-center shadow-lg sm:p-8"
          role="alert"
          aria-live="assertive"
        >
          <span className="mx-auto mb-5 flex size-12 items-center justify-center rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400">
            <TriangleAlert aria-hidden="true" className="size-6" />
          </span>
          <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">
            {outdatedVersion ? "Uma nova versão está disponível" : "Não foi possível abrir esta tela"}
          </h1>
          <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-muted-foreground sm:text-base">
            {outdatedVersion
              ? "Atualize a aplicação para carregar os arquivos mais recentes. Seus dados já salvos não serão alterados."
              : "Ocorreu uma falha inesperada na interface. Recarregue a aplicação para tentar novamente."}
          </p>
          <Button className="mt-6 w-full sm:w-auto" onClick={() => retryApplication()} autoFocus>
            <RefreshCw aria-hidden="true" />
            Recarregar aplicação
          </Button>
        </section>
      </main>
    );
  }
}
