# Lovable — rollout do rate limiting distribuído

## Escopo

Este lote protege login, recuperação de senha e verificação MFA/TOTP. Não cria
tabela, policy, RPC, trigger ou migration SQL.

Em produção, a Edge Function opera em modo **fail-closed**: se Redis estiver
ausente ou indisponível, operações sensíveis retornam indisponibilidade temporária
em vez de remover a proteção contra brute force.

## Secrets obrigatórios no Lovable/Supabase

- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`
- `SITE_URL=https://axionn.lovable.app`
- `AUTH_RATE_LIMIT_ALLOW_MEMORY_FALLBACK=false`

Não usar prefixo `VITE_`. Esses valores pertencem exclusivamente à Edge Function
e nunca devem entrar no bundle do navegador.

## Deploy

1. Criar ou selecionar uma instância Redis Upstash da região mais próxima.
2. Configurar os quatro secrets no ambiente da Edge Function.
3. Republicar `auth-rate-limiter` com `verify_jwt=false`, pois ela precisa operar
   antes do login.
4. Não registrar URL, token, e-mail ou hash de identificador em logs.
5. Confirmar `X-RateLimit-Policy: distributed` nas respostas.

## Canário

1. Login válido abaixo do limite retorna `allowed=true`.
2. A 11ª tentativa no mesmo minuto e IP retorna HTTP 429.
3. Repetir tentativas contra a mesma conta a partir de IPs distintos e confirmar
   o bucket por identificador.
4. Recuperação de senha bloqueia após 3 solicitações em 5 minutos.
5. MFA bloqueia após 5 códigos em 60 segundos.
6. Aguardar `Retry-After` e confirmar a liberação.
7. Remover temporariamente um secret Redis em staging e confirmar HTTP 503 e
   bloqueio da operação sensível; restaurar imediatamente.
8. Confirmar que mensagens ao usuário não revelam se a conta existe.

## Desenvolvimento local

Somente em ambiente local isolado pode ser usado:

`AUTH_RATE_LIMIT_ALLOW_MEMORY_FALLBACK=true`

Esse valor nunca deve ser usado em staging ou produção.

## Rollback

Rollback de código exige republicar a versão anterior da Edge Function. Não
habilitar fallback em memória como rollback de produção. Se Redis falhar, manter
fail-closed, restaurar o serviço distribuído e acompanhar os alertas de 503.

## Evidências

- ID/versão do deploy da Edge Function.
- Região do Redis, sem URL ou token.
- Respostas 200, 429 e 503 com correlation timestamp.
- `Retry-After` e `X-RateLimit-Policy` observados.
- Confirmação de ausência de secrets no bundle e nos logs.
