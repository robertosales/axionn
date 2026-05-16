import { useState } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { MoreHorizontal, Pencil, Trash2, ArrowUp, ArrowDown } from "lucide-react";
import type { FluxoColuna } from "../hooks/useFluxoAdmin";

interface Props {
  colunas: FluxoColuna[];
  onEdit:     (coluna: FluxoColuna) => void;
  onDelete:   (id: string) => Promise<boolean>;
  onMoveUp:   (id: string) => void;
  onMoveDown: (id: string) => void;
}

export function FluxoTable({ colunas, onEdit, onDelete, onMoveUp, onMoveDown }: Props) {
  const [confirmId, setConfirmId] = useState<string | null>(null);

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-12 text-center">Ordem</TableHead>
            <TableHead>Coluna</TableHead>
            <TableHead>Chave (key)</TableHead>
            <TableHead className="text-center">WIP</TableHead>
            <TableHead className="text-right">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {colunas.length === 0 && (
            <TableRow>
              <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                Nenhuma coluna configurada para este time.
              </TableCell>
            </TableRow>
          )}
          {colunas.map((col, idx) => (
            <TableRow key={col.id}>
              {/* Ordem */}
              <TableCell className="text-center">
                <div className="flex flex-col gap-0.5 items-center">
                  <Button
                    variant="ghost" size="icon"
                    className="h-5 w-5"
                    disabled={idx === 0}
                    onClick={() => onMoveUp(col.id)}
                  >
                    <ArrowUp className="h-3 w-3" />
                  </Button>
                  <span className="text-xs text-muted-foreground">{idx + 1}</span>
                  <Button
                    variant="ghost" size="icon"
                    className="h-5 w-5"
                    disabled={idx === colunas.length - 1}
                    onClick={() => onMoveDown(col.id)}
                  >
                    <ArrowDown className="h-3 w-3" />
                  </Button>
                </div>
              </TableCell>

              {/* Label com prévia de cor */}
              <TableCell>
                <div className="flex items-center gap-2">
                  <div className={`h-2.5 w-2.5 rounded-full shrink-0 ${col.dot_color}`} />
                  <Badge variant="outline" className={`text-[11px] ${col.color_class}`}>
                    {col.label}
                  </Badge>
                </div>
              </TableCell>

              {/* Key */}
              <TableCell>
                <code className="text-xs bg-muted px-1.5 py-0.5 rounded">{col.key}</code>
              </TableCell>

              {/* WIP */}
              <TableCell className="text-center">
                {col.wip_limit != null
                  ? <Badge variant="secondary" className="text-xs">{col.wip_limit}</Badge>
                  : <span className="text-xs text-muted-foreground">—</span>
                }
              </TableCell>

              {/* Ações */}
              <TableCell className="text-right">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-7 w-7">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => onEdit(col)} className="gap-2">
                      <Pencil className="h-3.5 w-3.5" /> Editar
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => setConfirmId(col.id)}
                      className="gap-2 text-destructive focus:text-destructive"
                    >
                      <Trash2 className="h-3.5 w-3.5" /> Excluir
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <AlertDialog open={!!confirmId} onOpenChange={v => { if (!v) setConfirmId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir coluna?</AlertDialogTitle>
            <AlertDialogDescription>
              Colunas com HUs atribuídas não podem ser excluídas. Mova as HUs antes de continuar.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90"
              onClick={async () => { if (confirmId) { await onDelete(confirmId); setConfirmId(null); } }}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
