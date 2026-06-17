# Edição de lançamento de horas não persiste para usuários comuns

## Diagnóstico

Tiago (usuário comum, não admin) clica em "Salvar" no modal de edição de lançamento. O sistema mostra "Registro atualizado com sucesso", mas o registro continua igual.

A causa é uma **policy RLS faltante** na tabela `public.demanda_hours`:

- Hoje só existem policies de UPDATE para administradores:
  - `Admin full access demanda_hours` → `has_role(auth.uid(), 'admin')`
  - `demanda_hours_update_admin` → `team_members.role = 'admin'`
- Para DELETE existe `Member delete own demanda_hours` (`user_id = auth.uid()`), mas **não há equivalente para UPDATE**.

Como o Supabase com RLS ativo retorna sucesso silencioso quando o UPDATE não afeta nenhuma linha (linhas filtradas pelas policies), o `updateHour()` em `demandas.service.ts` não recebe erro, o hook dispara o toast de sucesso e a UI reabre com os dados antigos.

A regra de negócio definida na memória (`mem://features/sustentacao/time-tracking` e commit `324b6be`) já diz que o dono do lançamento pode editar/excluir suas próprias atividades — falta apenas a policy de UPDATE no banco.

## Mudanças

### 1. Migration — adicionar policy de UPDATE para o dono

Nova migration em `supabase/migrations/` com:

```sql
CREATE POLICY "Member update own demanda_hours"
ON public.demanda_hours
FOR UPDATE
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());
```

Mantém as policies de admin existentes (gestor continua editando qualquer lançamento) e libera o dono a editar apenas os próprios.

### 2. Hardening em `updateHour` (`src/features/sustentacao/services/demandas.service.ts`)

Hoje o serviço não detecta UPDATE que afeta 0 linhas. Para evitar o mesmo "falso sucesso" em qualquer cenário futuro de RLS:

- Trocar `.update(payload).eq("id", id)` por `.update(payload).eq("id", id).select("id")`.
- Se o array retornado vier vazio, lançar um erro (`Sem permissão para editar este lançamento ou registro não encontrado`).

Assim o hook `useDemandas.update` cai no `catch` e mostra o toast de erro correto em vez de "Registro atualizado com sucesso".

## Validação

- Logar como Tiago (usuário comum, membro do time), abrir uma demanda → aba Atividades → editar um lançamento próprio → salvar. Esperado: a linha da tabela reflete a nova hora/fase/descrição.
- Logar como admin e editar um lançamento de outro usuário. Esperado: continua funcionando.
- Tentar (via console) editar um lançamento de outro usuário como membro comum. Esperado: toast de erro, não mais "sucesso".
