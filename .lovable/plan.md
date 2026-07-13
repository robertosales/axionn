## Pendência 1 — Corrigir teste `operationalConsole.contract.test.ts`

O App.tsx atual não usa mais `LegacyOperationalRoute` para `/admin/gitlab-integrations`; ele redireciona diretamente:

```tsx
<Route path="/admin/gitlab-integrations"
  element={<Navigate to="/organization/gitlab-integrations" replace />} />
<Route path="/organization/gitlab-integrations" element={<AdminGitlabIntegrationsPage />} />
```

A assertion `expect(app).toContain('platformPath={undefined}')` está obsoleta.

**Ação (somente no teste, sem tocar produção):**

Em `src/features/organization/operationalConsole.contract.test.ts`, no bloco `it("does not redirect the gitlab integrations route to platform plans", ...)`, substituir:

```ts
expect(app).toContain('path="/admin/gitlab-integrations"');
expect(app).toContain('platformPath={undefined}');
```

por asserções que refletem o comportamento atual:

```ts
expect(app).toContain('path="/admin/gitlab-integrations"');
expect(app).toContain('to="/organization/gitlab-integrations"');
expect(app).not.toContain('platformPath="/platform"\n              >\n                <AdminGitlabIntegrationsPage');
```

(a última garante que a rota gitlab não está mais envolvida por `LegacyOperationalRoute` com redirect para platform).

Resultado esperado: 149/149 testes passando.

## Pendência 2 — Deploy da Edge Function `gitlab-webhook-register`

Importante esclarecer: no Lovable Cloud **não existe `npx supabase login` nem deploy manual via CLI** — as Edge Functions são deployadas automaticamente pela plataforma quando o código muda, e podem ser re-deployadas via a ferramenta interna `supabase--deploy_edge_functions`.

**Ação:**

1. Chamar `supabase--deploy_edge_functions(["gitlab-webhook-register"])` para forçar o redeploy.
2. Fazer um smoke test via `supabase--curl_edge_functions` em `/gitlab-webhook-register` com um `integrationId` inexistente para confirmar que a função responde 404 (prova de que está ativa e alcançável).
3. Reportar ao usuário que o smoke test end-to-end (criar integração real com token GitLab válido) só pode ser feito por ele na UI, já que exige credenciais reais do GitLab — e indicar a tabela de troubleshooting já fornecida caso o toast retorne "Registre o webhook manualmente".

## Fora de escopo (confirmado)

Nenhuma alteração em: `git-webhook-handler`, `HUEditDrawer.tsx`, `AdminGitlabIntegrationsPage.tsx`, migrations, ou qualquer componente de produção.
