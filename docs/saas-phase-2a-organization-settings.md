# Axion SaaS — Fase 2A / Lote 5: configurações da organização

## Objetivo

Permitir que owners e administradores editem dados seguros da organização ativa e consultem a trilha de auditoria das alterações.

## Campos editáveis

- nome da organização;
- nome do contato administrativo;
- e-mail de contato;
- URL HTTPS da logo.

O slug, o plano, o status e os limites não são editáveis nesta tela.

## Segurança

- acesso restrito a owner, admin da organização e platform admin;
- atualização executada por RPC tenant-scoped;
- validação de nome, e-mail e URL da logo no banco;
- lock da organização durante a atualização;
- tabela de auditoria sem acesso direto do frontend;
- nenhuma alteração de slug, plano, status, entitlement ou quota;
- atualizações sem mudança real não geram evento duplicado.

## Auditoria

Cada alteração registra:

- organização;
- usuário responsável;
- campos alterados;
- estado anterior;
- estado posterior;
- data e hora.

## Interface

A tela fica disponível em **Configurações**, no menu da organização. Durante a transição de rotas, o endereço utilizado é:

`/organization/usage?view=settings`

A tela apresenta:

- formulário de identidade e contato;
- slug somente leitura;
- plano e status somente leitura;
- prévia da logo;
- histórico das últimas 50 alterações.

## Implantação no Lovable Cloud

Executar manualmente:

`supabase/operations/20260704_05_organization_settings_rollout.sql`

Resultado obrigatório:

```text
organization_settings_rollout_ok = true
```

Depois, publicar o frontend da `develop` e validar com um owner/admin controlado.

## Validação funcional

1. abrir o menu da organização;
2. acessar **Configurações**;
3. alterar somente um campo;
4. salvar;
5. confirmar a atualização no cabeçalho e no seletor;
6. confirmar o evento no histórico;
7. acessar com um usuário `member` e confirmar o bloqueio;
8. confirmar que slug, plano, status e limites permaneceram intactos.
