# Liberar troca de contrato para Admin/Gestor

## Problema
Roberto Sales é **administrador master** e também atua como **gestor**, mas o sistema o trata como "admin de contrato fixo" (porque existe registro em `user_contracts` vinculando-o ao "Contrato de Fábrica PF"). Resultado: a sidebar mostra o contrato como bloco estático, sem o seletor — ele não consegue visualizar dados de outros contratos.

A regra atual em `ContractContext.tsx` é:
- Tem `user_contracts` → admin de contrato (locked).
- Não tem `user_contracts` + role `admin` → gestor master (pode escolher).

Isso é restritivo demais: qualquer usuário com role `admin` deveria poder navegar entre contratos.

## Solução (regra nova)
A **role `admin` tem precedência** sobre o vínculo em `user_contracts`. O vínculo passa a ser apenas a "preferência inicial" do contrato exibido.

| Caso | isGestor | Contrato inicial | Pode trocar? |
|------|----------|------------------|--------------|
| Admin **sem** `user_contracts` | `true` | primeiro contrato da lista | ✅ Sim (+ "Todos") |
| Admin **com** `user_contracts` (Roberto) | `true` | o contrato vinculado | ✅ Sim (+ "Todos") |
| Não-admin **com** `user_contracts` | `false` | o contrato vinculado | ❌ Não (locked) |
| Não-admin **sem** `user_contracts` | `false` | nenhum | ❌ Não |

## Alterações

### 1. `src/features/admin/contexts/ContractContext.tsx`
Refatorar o `useEffect` de bootstrap:
1. Buscar role `admin` em `user_roles` **e** `user_contracts` em paralelo.
2. Se for admin → `setIsGestor(true)` e usar `user_contracts.contract_id` como pré-seleção se existir (senão `null`, e o `useEffect` seguinte continuará escolhendo o primeiro contrato automaticamente).
3. Caso contrário, mantém comportamento atual (locked no contrato vinculado).

Nenhuma mudança em `ContractSwitcher` é necessária — ele já renderiza o seletor completo quando `isGestor === true`.

### 2. UX no header (`src/pages/AdminDashboard.tsx`)
Hoje o "badge" amarelo no topo (`CONTRATO DE FABRICA PF`) é apenas decorativo. Para reforçar a percepção de que o admin/gestor pode trocar:
- Quando `isGestor === true`, transformar o badge em um **botão** com ícone `ChevronDown` que rola/foca o `ContractSwitcher` da sidebar (em mobile, abre a sidebar).
- Quando `isGestor === false`, manter como está (somente leitura).

Mudança pequena: extrair o badge em um pequeno componente local, condicionar o `as="button"` ao `isGestor`.

## Fora de escopo
- Sem migrações de banco (a regra é puramente client-side, baseada em `user_roles`).
- Sem alterar permissões/RLS das outras páginas — `useAdminKpis(selectedContractId)` já recebe o id selecionado e refaz a query.
- Sem mudar a aparência do dropdown nem do badge para o admin de contrato (não-gestor).

## Validação
- Login Roberto Sales → sidebar mostra o seletor com "Contrato de Fábrica PF" pré-selecionado e opção "Todos os contratos".
- Trocar contrato no seletor → KPIs da Visão Geral recarregam para o novo contrato; badge no header atualiza.
- Login usuário comum vinculado a 1 contrato → continua locked (sem seletor).
