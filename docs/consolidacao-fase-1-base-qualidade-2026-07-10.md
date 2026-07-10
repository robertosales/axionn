# Consolidação — Fase 1: base, documentação e qualidade

**Data:** 10/07/2026  
**Estado:** concluída  
**Banco:** nenhuma migration criada ou alterada

## Objetivo

Organizar a base local com mudanças pequenas e reversíveis, melhorar a documentação de entrada e remover erros de qualidade conhecidos sem alterar regras de negócio ou dados publicados.

## Mudanças realizadas

### 1. README consolidado

O README genérico do Lovable foi substituído por documentação específica do Axionn, contendo:

- visão de produto e módulos existentes;
- stack e estrutura de diretórios;
- setup e validação local;
- regras de secrets e segurança;
- política de preservação de migrations publicadas;
- modelo de autorização;
- links para documentação operacional.

### 2. Lint do Teams Bot

Dois erros `no-case-declarations` foram corrigidos em `supabase/functions/teams-bot/index.ts` adicionando escopo explícito aos blocos `case/default`.

A correção não altera consultas, retorno, comandos, payloads ou comportamento da função. Ela apenas torna o escopo lexical válido para ESLint/JavaScript.

### 3. Importação de impedimentos

`ImpedimentManager` era importado estaticamente por componentes do Kanban e, ao mesmo tempo, dinamicamente por `Index.tsx`. Como o módulo já integrava o bundle estático, o `lazy()` não produzia divisão de código e gerava alerta do Vite.

`ImpedimentList` agora usa importação estática coerente. O comportamento visual e funcional permanece o mesmo, e o alerta de importação mista desapareceu.

### 4. Registro da dívida de lint

O lint completo inicialmente apresentou:

```text
1635 problemas
2 erros
1633 avisos
```

Após a correção:

```text
1633 problemas
0 erros
1633 avisos
exit code 0
```

Os avisos são majoritariamente `no-explicit-any`, dependências de hooks, exports incompatíveis com Fast Refresh e pequenos padrões legados. Não foram corrigidos em massa para evitar alterações comportamentais amplas. A redução deve ocorrer por domínio, acompanhada de testes.

## Validação

| Verificação | Resultado |
|---|---|
| ESLint completo | Aprovado, 0 erros |
| Vitest | 18 arquivos, 127 testes, 0 falhas |
| Build de produção | Aprovado |
| `git diff --check` | Aprovado |

O build não apresenta mais o alerta de importação estática/dinâmica de `ImpedimentManager`.

## Alertas preservados para tratamento gradual

- Browserslist/caniuse com base desatualizada;
- dependência transitiva `bluebird` utiliza `eval`;
- chunks grandes de APF, bibliotecas de documentos/planilhas e bundle principal;
- fallback de configuração Supabase durante alguns testes;
- 1.633 avisos de lint históricos.

## Decisões de segurança

- Nenhuma migration existente foi modificada.
- Nenhum SQL novo foi criado nesta fase.
- Nenhuma Edge Function foi publicada automaticamente.
- Nenhum dado ou configuração remota foi alterado.
- A correção em `teams-bot` precisará ser publicada apenas quando o fluxo normal de deploy de Edge Functions for acionado pelo responsável.

## Critério de saída

- documentação de entrada representa o produto real;
- lint sem erros bloqueantes;
- testes e build preservados;
- alerta falso de code-splitting removido;
- dívida técnica restante explicitamente catalogada.

## Próximo passo

A Fase 2 deve consolidar a fundação enterprise sem reescrever o banco publicado. O primeiro lote deve mapear uma autoridade canônica de permissões e os caminhos legados, adicionar testes de contrato e, quando houver necessidade de banco, gerar migration nova, incremental e ordenada para aplicação manual no Lovable.
