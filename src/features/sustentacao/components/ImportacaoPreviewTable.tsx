import React from "react";
import { SITUACAO_LABELS, SITUACAO_COLORS } from "../types/demanda";

interface PreviewRow {
  rhm: string;
  titulo: string;
  projeto: string;
  situacao: string;
  tipo: string;
  descricao: string;
  demandante: string;
  responsavel_dev: string;
  sla: string;
}

interface Props {
  rows: PreviewRow[];
}

export default function ImportacaoPreviewTable({ rows }: Props) {
  if (rows.length === 0) return null;

  return (
    <div className="overflow-x-auto rounded-md border">
      <table className="w-full text-sm">
        <thead className="bg-muted/50">
          <tr>
            <th className="px-3 py-2 text-left font-medium text-muted-foreground">RHM</th>
            <th className="px-3 py-2 text-left font-medium text-muted-foreground">Título</th>
            <th className="px-3 py-2 text-left font-medium text-muted-foreground">Projeto</th>
            <th className="px-3 py-2 text-left font-medium text-muted-foreground">Situação</th>
            <th className="px-3 py-2 text-left font-medium text-muted-foreground">Tipo</th>
            <th className="px-3 py-2 text-left font-medium text-muted-foreground">Dev</th>
            <th className="px-3 py-2 text-left font-medium text-muted-foreground">SLA</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => {
            const situacaoLabel = SITUACAO_LABELS[row.situacao] ?? row.situacao;
            const situacaoColor = SITUACAO_COLORS[row.situacao] ?? "bg-gray-100 text-gray-700 border-gray-300";
            const isConcluida = row.situacao === "fila_concluida";

            return (
              <tr
                key={i}
                className={`border-t transition-colors hover:bg-muted/30 ${isConcluida ? "bg-green-50/40" : ""}`}
              >
                <td className="px-3 py-2 font-mono text-xs">{row.rhm || "—"}</td>
                <td className="px-3 py-2 max-w-xs truncate" title={row.titulo}>
                  {row.titulo || "—"}
                </td>
                <td className="px-3 py-2 text-muted-foreground">{row.projeto || "—"}</td>
                <td className="px-3 py-2">
                  <span
                    className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${
                      situacaoColor
                    }`}
                  >
                    {isConcluida && (
                      <svg
                        className="mr-1 h-3 w-3"
                        viewBox="0 0 12 12"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                      >
                        <path d="M2 6l3 3 5-5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                    {situacaoLabel}
                  </span>
                </td>
                <td className="px-3 py-2 text-muted-foreground">{row.tipo || "—"}</td>
                <td className="px-3 py-2 text-muted-foreground">{row.responsavel_dev || "—"}</td>
                <td className="px-3 py-2 uppercase text-muted-foreground">{row.sla || "—"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
