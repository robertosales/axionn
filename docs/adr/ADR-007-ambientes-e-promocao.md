# ADR-007 — Ambientes e promoção imutável

- Status: aceito como guarda-corpo técnico; provisionamento depende do operador
- Data: 2026-08-21

## Contexto

O estado operacional mais recente registra que o Lovable Cloud é produção e que não há Supabase de staging separado. Em paralelo, o repositório possui um workflow capaz de vincular a CLI e aplicar migrations a um projeto configurado como staging. Sem validação de identidade, um secret incorreto poderia apontar esse workflow para produção.

O workflow de release também alterava `develop` depois do disparo por tag. Assim, a release poderia não representar o conteúdo imutável da tag.

## Decisão

1. Lovable Cloud continua sendo produção e nunca será alvo da Supabase CLI.
2. Validação remota automatizada só pode rodar em projeto Supabase separado e homologado.
3. O environment protegido `staging` deve possuir refs distintas de staging e produção; o workflow falha quando forem iguais.
4. Toda execução exige confirmação explícita. Aplicar migrations exige confirmação diferente da validação.
5. A URL do banco deve pertencer à ref de staging declarada.
6. Na ausência desse ambiente, somente testes locais/CI e operações manuais autorizadas no Lovable são permitidos; o gate remoto permanece pendente.
7. Uma release é criada somente a partir de tag cujo commit já pertence a `main` e cuja versão coincide com `package.json`. O workflow não altera branches nem arquivos.

## Configuração obrigatória de `staging`

- aprovação manual de mantenedor;
- `SUPABASE_STAGING_PROJECT_REF`;
- `SUPABASE_PRODUCTION_PROJECT_REF`, usada somente para impedir identidade entre ambientes;
- `SUPABASE_STAGING_DB_PASSWORD`;
- `SUPABASE_STAGING_DB_URL`;
- `SUPABASE_ACCESS_TOKEN` restrito ao staging quando suportado.

Confirmações:

- `VALIDATE-ISOLATED-STAGING`: dry-run e testes;
- `APPLY-ISOLATED-STAGING`: aplicação de migrations e testes.

## Consequências

- o workflow não funciona até existir staging real e isolado, o que é intencional;
- produção não pode ser usada para satisfazer os gates remotos;
- tags criadas antes da promoção para `main` falham em vez de publicar artefato divergente;
- o bump de versão precisa ser commitado e validado antes da tag.

## Rollback

As mudanças são guards de CI. Em caso de falso negativo, corrigir a configuração ou o parser do host; não remover a comparação com produção nem executar a CLI no Lovable.
