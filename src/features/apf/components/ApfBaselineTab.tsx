import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Database,
  FileSpreadsheet,
  Loader2,
  Trash2,
  Upload,
} from "lucide-react";
import { useApfBaselineImport } from "../hooks/useApfBaselineImport";

export function ApfBaselineTab() {
  const baseline = useApfBaselineImport();
  const hasErrors = Boolean(baseline.integrity?.errors.length);

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Database className="h-4 w-4" /> Baseline funcional do projeto
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            A baseline pertence ao projeto e é reutilizada nas contagens de todas as sprints. A sprint define apenas o escopo da medição.
          </p>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Projeto</Label>
              <Select value={baseline.projectId} onValueChange={baseline.setProjectId}>
                <SelectTrigger><SelectValue placeholder="Selecione o projeto" /></SelectTrigger>
                <SelectContent>
                  {baseline.projects.map((project) => (
                    <SelectItem key={project.id} value={project.id}>{project.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Planilha oficial da baseline do projeto</Label>
              <Input
                type="file"
                accept=".xlsx,.xls"
                disabled={!baseline.projectId || baseline.importing}
                onChange={(event) => baseline.handleFile(event.target.files?.[0] ?? null)}
              />
            </div>
          </div>

          {baseline.parsed && baseline.totals && (
            <div className="space-y-4 rounded-lg border p-4">
              <div className="flex flex-wrap items-center gap-2">
                <FileSpreadsheet className="h-4 w-4 text-primary" />
                <span className="font-medium">{baseline.fileName}</span>
                <Badge variant="outline">
                  {baseline.parsed.systemName ?? "Sistema não identificado"}
                </Badge>
                <Badge variant="outline">Escopo: projeto</Badge>
                {baseline.integrity && (
                  hasErrors ? (
                    <Badge variant="destructive" className="gap-1">
                      <AlertCircle className="h-3 w-3" /> Reprovada
                    </Badge>
                  ) : (
                    <Badge className="gap-1 bg-emerald-100 text-emerald-700">
                      <CheckCircle2 className="h-3 w-3" /> Validada
                    </Badge>
                  )
                )}
              </div>

              <div className="grid gap-3 sm:grid-cols-5">
                <Metric label="Processos/EFs" value={baseline.totals.processes} />
                <Metric label="Itens mensuráveis" value={baseline.totals.measurable} />
                <Metric label="Não mensuráveis" value={baseline.totals.nonMeasurable} />
                <Metric label="PF Bruto" value={baseline.totals.pfBruto.toFixed(2)} />
                <Metric label="PF Baseline" value={baseline.totals.pfFs.toFixed(2)} primary />
              </div>

              {baseline.integrity?.errors.length ? (
                <div className="rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-800">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                    <div>
                      <p className="font-medium">A baseline não pode ser ativada.</p>
                      <ul className="mt-1 list-disc space-y-1 pl-5">
                        {baseline.integrity.errors.map((error) => (
                          <li key={error}>{error}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              ) : null}

              {baseline.integrity?.warnings.length ? (
                <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                    <ul className="list-disc space-y-1 pl-5">
                      {baseline.integrity.warnings.map((warning) => (
                        <li key={warning}>{warning}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              ) : null}

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Versão da baseline do projeto</Label>
                  <Input value={baseline.version} onChange={(event) => baseline.setVersion(event.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>Descrição</Label>
                  <Input value={baseline.label} onChange={(event) => baseline.setLabel(event.target.value)} />
                </div>
              </div>

              <div className="max-h-72 overflow-auto rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Processo</TableHead>
                      <TableHead>Item funcional</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Impacto baseline</TableHead>
                      <TableHead>Complexidade</TableHead>
                      <TableHead className="text-right">PF Bruto</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {baseline.parsed.items.slice(0, 60).map((item) => (
                      <TableRow key={item.item_ref}>
                        <TableCell className="font-mono text-xs">{item.process_ref}</TableCell>
                        <TableCell className="max-w-[420px] truncate" title={item.description}>
                          {item.description}
                        </TableCell>
                        <TableCell>{item.function_sigla}</TableCell>
                        <TableCell>{item.factor_sigla}</TableCell>
                        <TableCell>{item.complexity}</TableCell>
                        <TableCell className="text-right font-medium">{item.pf_bruto.toFixed(2)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <Button
                onClick={baseline.importBaseline}
                disabled={baseline.importing || !baseline.version.trim() || hasErrors}
                className="gap-2"
              >
                {baseline.importing
                  ? <Loader2 className="h-4 w-4 animate-spin" />
                  : <Upload className="h-4 w-4" />}
                Validar, importar e ativar baseline do projeto
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Baselines importadas do projeto</CardTitle></CardHeader>
        <CardContent>
          {baseline.loading ? (
            <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin" /></div>
          ) : baseline.baselines.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nenhuma baseline importada para este projeto.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Versão</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead>Arquivo</TableHead>
                  <TableHead>Escopo</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Importação</TableHead>
                  <TableHead className="text-right">Ação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {baseline.baselines.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium">{item.version}</TableCell>
                    <TableCell>{item.label ?? "—"}</TableCell>
                    <TableCell>{item.source_file_name ?? "—"}</TableCell>
                    <TableCell><Badge variant="outline">Projeto</Badge></TableCell>
                    <TableCell>
                      {item.status === "active" ? (
                        <Badge className="gap-1 bg-emerald-100 text-emerald-700">
                          <CheckCircle2 className="h-3 w-3" /> Ativa
                        </Badge>
                      ) : (
                        <Badge variant="outline">{item.status}</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {item.imported_at ? new Date(item.imported_at).toLocaleString("pt-BR") : "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-destructive hover:text-destructive"
                        disabled={baseline.deletingId === item.id}
                        onClick={() => {
                          const confirmed = window.confirm(
                            item.status === "active"
                              ? "Excluir a baseline ativa? O projeto ficará sem baseline até que outra seja importada ou ativada. Contagens anteriores serão preservadas para auditoria."
                              : "Excluir esta baseline importada?",
                          );
                          if (confirmed) baseline.deleteBaseline(item);
                        }}
                      >
                        {baseline.deletingId === item.id
                          ? <Loader2 className="h-4 w-4 animate-spin" />
                          : <Trash2 className="h-4 w-4" />}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Metric({
  label,
  value,
  primary,
}: {
  label: string;
  value: string | number;
  primary?: boolean;
}) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`text-xl font-semibold ${primary ? "text-primary" : ""}`}>{value}</p>
    </div>
  );
}
