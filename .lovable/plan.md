## Objetivo

Na aba **Atividades** do detalhe da demanda, aplicar a mesma regra de visibilidade do filtro **Analista** já usada no relatório **Produtividade da Equipe** (`RelatorioProdutividade.tsx`):

- **Usuário comum** → combo já vem preenchida com o **próprio usuário logado** e fica **desabilitada** (vê apenas seus lançamentos).
- **Admin / Gestor** → combo inicia em **"Todos"** e fica **liberada**, podendo escolher qualquer analista para ver lançamentos de terceiros.

## Escopo

Arquivo único: `src/features/sustentacao/components/DemandaDetail.tsx` (aba `horas`). Sem mexer em serviços, RLS ou cálculo do "Total Acumulado".

## Mudanças

1. Usar `useAuth()` (já importado) para obter `user` e `isAdmin`. Considerar também gestor: reaproveitar a mesma flag de permissão usada em outros pontos do arquivo para "lançar por outro" (ex.: `canManageHours`/`isAdmin`). Se só houver `isAdmin`, manter `isAdmin` como condição de liberação (igual ao Produtividade).

2. Estado inicial do filtro:
```ts
const [hoursAnalista, setHoursAnalista] = useState(
  () => isAdmin ? "all" : (user?.id ?? "all")
);
useEffect(() => {
  if (!isAdmin && user?.id && hoursAnalista === "all") setHoursAnalista(user.id);
}, [user?.id, isAdmin]);
```

3. Passar `analistaDisabled={!isAdmin}` para o `ReportFilterBar` (prop já suportada, conforme uso em `RelatorioProdutividade`).

4. Botão **Limpar** respeita a regra: reseta para `"all"` se admin, ou para `user.id` se comum.

5. A lista deduplicada de analistas continua a partir dos `hours[]` da demanda — usuário comum verá só seu próprio nome na combo (travada).

## Fora de escopo

- Não alterar paginação, total acumulado, ou outras abas.
- Não mexer em RLS — usuário comum já só consegue lançar/editar seus próprios registros; o filtro aqui é apenas de visualização sobre o array já carregado.

## Validação

1. Login como usuário comum (ex.: Tiago): aba Atividades abre com a combo travada no próprio nome, listando só seus lançamentos.
2. Login como admin: combo inicia em "Todos", liberada, pode escolher qualquer analista da demanda.
3. Botão Limpar respeita o perfil.
4. Total Acumulado permanece inalterado.
