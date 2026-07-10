## Objetivo
Reativar `roberto.sales@gmail.com` para que consiga acessar o sistema normalmente.

## Diagnóstico
- Auth do Supabase: OK (login retorna 200, `email_confirmed_at` preenchido, sem `banned_until`/`deleted_at`).
- `profiles.is_active = false` — foi desativado pela limpeza de usuários de Sustentação executada anteriormente (o filtro pegou usuários que pertenciam a times marcados como `module = 'sustentacao'`, e Roberto era um deles).
- Consequência: o app bloqueia a entrada de perfis inativos, mesmo com a autenticação sendo bem-sucedida.

## Alteração
Usar o tool de dados para rodar:

```sql
UPDATE public.profiles
SET is_active = true
WHERE user_id = '3c472f37-eabb-4a95-a859-1a1cf89f5d37';
```

## Fora de escopo
- Não mexer em roles, times ou memberships de organização (o membership admin dele em SALES CONSULTORIA já está garantido pela operação `20260704_02c`).
- Não alterar código nem RLS.
- Não reativar outros usuários da limpeza — se houver mais casos, trate individualmente.
