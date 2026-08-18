import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(resolve("supabase/migrations/20260818310000_apf_draft_lifecycle.sql"), "utf8");
const component = readFileSync(resolve("src/features/apf/components/dossier/ApfDossierSpecification.tsx"), "utf8");

describe("ciclo de vida do rascunho APF", () => {
  it("restringe edição e exclusão a rascunhos com permissão de revisão", () => {
    expect(migration).toContain("apf.dossier.review");
    expect(migration).toContain("v_dossier.status <> 'draft'");
    expect(migration).toContain("security definer");
  });

  it("mantém a imutabilidade fora da exclusão transacional autorizada", () => {
    expect(migration).toContain("current_setting('app.apf_draft_delete', true)");
    expect(migration).toContain("apf_dossier_version_is_immutable");
  });

  it("expõe ações traduzidas, confirmação e bloqueio durante exclusão", () => {
    expect(component).toContain('hasPermission("apf.dossier.review")');
    expect(component).toContain("Editar dossiê");
    expect(component).toContain("Excluir permanentemente");
    expect(component).toContain("disabled={deleting}");
    expect(component).toContain("APF_DOSSIER_STATUS_LABELS[dossier.status]");
    expect(component).toContain("APF_COUNTING_TYPE_LABELS[dossier.countingType]");
  });
});
