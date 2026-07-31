import { useEffect, useMemo, useState } from "react";
import { CheckCheck, Search, ShieldQuestion, X } from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { RBAC_PERMISSION_GROUPS } from "@/features/rbac/rbacCatalog";
import type { RbacPermission } from "@/features/rbac/types";

interface RbacPermissionMatrixProps {
  permissions: RbacPermission[];
  selectedKeys: string[];
  onChange: (permissionKeys: string[]) => void;
  readOnly?: boolean;
}

export function RbacPermissionMatrix({
  permissions,
  selectedKeys,
  onChange,
  readOnly = false,
}: RbacPermissionMatrixProps) {
  const [query, setQuery] = useState("");
  const [openGroups, setOpenGroups] = useState<string[]>([]);
  const selected = useMemo(() => new Set(selectedKeys), [selectedKeys]);

  const filtered = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase("pt-BR");
    if (!normalizedQuery) return permissions;
    return permissions.filter((permission) =>
      [permission.label, permission.description, permission.key]
        .filter(Boolean)
        .some((value) =>
          String(value).toLocaleLowerCase("pt-BR").includes(normalizedQuery),
        ),
    );
  }, [permissions, query]);

  const groups = useMemo(() => {
    const grouped = new Map<string, RbacPermission[]>();
    filtered.forEach((permission) => {
      const current = grouped.get(permission.groupKey) ?? [];
      current.push(permission);
      grouped.set(permission.groupKey, current);
    });
    return [...grouped.entries()].sort(([left], [right]) => {
      const leftLabel = RBAC_PERMISSION_GROUPS[left]?.label ?? left;
      const rightLabel = RBAC_PERMISSION_GROUPS[right]?.label ?? right;
      return leftLabel.localeCompare(rightLabel, "pt-BR");
    });
  }, [filtered]);

  useEffect(() => {
    if (query.trim()) {
      setOpenGroups(groups.map(([groupKey]) => groupKey));
    } else if (openGroups.length === 0 && groups[0]) {
      setOpenGroups([groups[0][0]]);
    }
  }, [groups, openGroups.length, query]);

  function togglePermission(permissionKey: string, checked: boolean) {
    const next = new Set(selected);
    if (checked) next.add(permissionKey);
    else next.delete(permissionKey);
    onChange([...next]);
  }

  function setGroup(permissionGroup: RbacPermission[], checked: boolean) {
    const next = new Set(selected);
    permissionGroup.forEach((permission) => {
      if (checked) next.add(permission.key);
      else next.delete(permission.key);
    });
    onChange([...next]);
  }

  return (
    <div className="space-y-4">
      <div className="sticky top-0 z-10 rounded-xl border bg-background/95 p-3 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-background/85">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="h-11 pl-9 pr-10 text-base sm:text-sm"
              placeholder="Pesquisar permissões por nome ou código"
              aria-label="Pesquisar permissões"
            />
            {query && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute right-0 top-0 h-11 w-11"
                onClick={() => setQuery("")}
                aria-label="Limpar pesquisa de permissões"
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
          <div className="flex items-center justify-between gap-2 sm:justify-end">
            <Badge variant="secondary" className="h-8 px-3 tabular-nums">
              {selected.size} selecionadas
            </Badge>
            {!readOnly && (
              <>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-10"
                  onClick={() => onChange(permissions.map((permission) => permission.key))}
                >
                  <CheckCheck className="mr-2 h-4 w-4" />
                  Todas
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-10"
                  onClick={() => onChange([])}
                >
                  Limpar
                </Button>
              </>
            )}
          </div>
        </div>
      </div>

      {groups.length === 0 ? (
        <div className="flex min-h-48 flex-col items-center justify-center rounded-xl border border-dashed p-6 text-center">
          <ShieldQuestion className="h-8 w-8 text-muted-foreground" aria-hidden="true" />
          <h3 className="mt-3 text-sm font-semibold">Nenhuma permissão encontrada</h3>
          <p className="mt-1 max-w-md text-sm text-muted-foreground">
            Ajuste a busca ou volte ao passo anterior para selecionar outro módulo.
          </p>
        </div>
      ) : (
        <Accordion
          type="multiple"
          value={openGroups}
          onValueChange={setOpenGroups}
          className="space-y-3"
        >
          {groups.map(([groupKey, groupPermissions]) => {
            const metadata = RBAC_PERMISSION_GROUPS[groupKey] ??
              RBAC_PERMISSION_GROUPS.general;
            const GroupIcon = metadata.icon;
            const selectedInGroup = groupPermissions.filter((permission) =>
              selected.has(permission.key),
            ).length;
            const allSelected = selectedInGroup === groupPermissions.length;
            const partiallySelected = selectedInGroup > 0 && !allSelected;

            return (
              <AccordionItem
                key={groupKey}
                value={groupKey}
                className="overflow-hidden rounded-xl border bg-card px-4"
              >
                <AccordionTrigger className="min-h-14 py-3 hover:no-underline">
                  <span className="flex min-w-0 flex-1 items-center gap-3 text-left">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted">
                      <GroupIcon className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold">
                        {metadata.label}
                      </span>
                      <span className="block text-xs font-normal text-muted-foreground tabular-nums">
                        {selectedInGroup} de {groupPermissions.length} selecionadas
                      </span>
                    </span>
                  </span>
                </AccordionTrigger>
                <AccordionContent className="pb-4">
                  {!readOnly && (
                    <div className="mb-3 flex min-h-11 items-center justify-between rounded-lg bg-muted/50 px-3">
                      <div className="flex items-center gap-3">
                        <Checkbox
                          id={`group-${groupKey}`}
                          checked={
                            allSelected ? true : partiallySelected ? "indeterminate" : false
                          }
                          onCheckedChange={(checked) =>
                            setGroup(groupPermissions, checked === true)
                          }
                          aria-label={`Selecionar todas as permissões de ${metadata.label}`}
                        />
                        <Label htmlFor={`group-${groupKey}`} className="cursor-pointer text-sm">
                          Selecionar grupo inteiro
                        </Label>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {groupPermissions.length} permissões
                      </span>
                    </div>
                  )}

                  <div className="grid gap-2 lg:grid-cols-2">
                    {groupPermissions.map((permission) => {
                      const permissionId = `permission-${permission.key.replace(/[^a-z0-9_-]/gi, "-")}`;
                      const checked = selected.has(permission.key);
                      return (
                        <div
                          key={permission.key}
                          className={cn(
                            "flex min-h-16 items-start gap-3 rounded-lg border p-3 transition-colors duration-200 motion-reduce:transition-none",
                            checked
                              ? "border-primary/40 bg-primary/[0.04]"
                              : "border-border/70 bg-background hover:bg-muted/40",
                          )}
                        >
                          <Checkbox
                            id={permissionId}
                            className="mt-0.5"
                            checked={checked}
                            disabled={readOnly}
                            onCheckedChange={(value) =>
                              togglePermission(permission.key, value === true)
                            }
                          />
                          <Label
                            htmlFor={permissionId}
                            className={cn(
                              "min-w-0 flex-1 leading-5",
                              readOnly ? "cursor-default" : "cursor-pointer",
                            )}
                          >
                            <span className="block text-sm font-medium text-foreground">
                              {permission.label}
                            </span>
                            <span className="mt-0.5 block break-all text-xs font-normal text-muted-foreground">
                              {permission.description || permission.key}
                            </span>
                          </Label>
                        </div>
                      );
                    })}
                  </div>
                </AccordionContent>
              </AccordionItem>
            );
          })}
        </Accordion>
      )}
    </div>
  );
}
