# Lovable — rollout de MFA obrigatório no Backoffice

## Escopo

Este lote usa exclusivamente o MFA TOTP nativo do Supabase Auth. Não cria tabela,
policy, função, trigger ou migration SQL.

O código permanece em modo de preparação enquanto
`VITE_BACKOFFICE_MFA_REQUIRED=false`. Nesse modo, cada membro do staff pode
configurar o autenticador em **Backoffice → Configurações**, sem ser bloqueado.

## Ações para executar no Lovable

1. Abrir a configuração de autenticação do projeto Supabase usado pelo ambiente.
2. Confirmar que MFA/TOTP está habilitado para usuários autenticados.
3. Manter `VITE_BACKOFFICE_MFA_REQUIRED=false` no primeiro deploy.
4. Publicar o frontend e testar o cadastro em `/security/mfa` com uma conta de
   staff não crítica.
5. Encerrar a sessão, entrar novamente e confirmar que o código promove a sessão
   de `aal1` para `aal2`.
6. Repetir com pelo menos um usuário de cada papel do Backoffice.
7. Somente após o canário, definir `VITE_BACKOFFICE_MFA_REQUIRED=true` e publicar
   novamente.

## Evidências esperadas

- QR Code renderizado sem aparecer em logs ou telemetria.
- Fator TOTP listado como `verified` no usuário de teste.
- Login comum cria sessão `aal1` e redireciona o Backoffice para `/security/mfa`.
- Código válido promove a sessão a `aal2` e retorna à rota originalmente pedida.
- Código inválido não libera o Backoffice.
- Usuário sem fator é conduzido ao cadastro.
- Rotas fora do Backoffice continuam acessíveis conforme as permissões existentes.

## Recuperação e suporte

Antes de tornar MFA obrigatório, documentar quem pode remover um fator perdido no
painel administrativo do Supabase e exigir validação de identidade fora de banda.
Nunca solicitar ao usuário QR Code, chave TOTP ou código temporário.

O suporte deve registrar: usuário, motivo, aprovador, horário, fator removido e
correlation ID do atendimento. Não armazenar segredos do autenticador.

## Rollback

Definir `VITE_BACKOFFICE_MFA_REQUIRED=false` e republicar o frontend. Isso remove
o bloqueio do Backoffice sem apagar fatores já cadastrados. Não remover fatores em
massa durante rollback.

## Critério de aprovação

- Todos os cenários do canário aprovados.
- Procedimento de recuperação testado com uma conta descartável.
- Owner operacional definido.
- Equipe avisada antes da ativação obrigatória.
- Evidências anexadas ao registro de release.
