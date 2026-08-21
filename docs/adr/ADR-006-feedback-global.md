# ADR-006 — Feedback global com Sonner

- Status: proposto — requer aprovação de Roberto
- Data: 2026-08-21
- Decisores: Roberto e responsáveis por Frontend/UX
- Escopo: notificações transitórias globais da aplicação web
- Decisão bloqueante: nenhuma migração deve começar antes da aprovação deste ADR

## Contexto

O Axionn mantém duas pilhas de toast montadas simultaneamente em `AppRoutes`: o `Toaster` baseado em Radix UI e o `Toaster` do Sonner. Isso permite diferenças de posição, duração, dismiss, aparência e semântica entre módulos, além de aumentar o custo de testes e manutenção.

O inventário estático de 2026-08-21 substitui os números históricos do roadmap:

| Indicador | Baseline atual |
| --- | ---: |
| Arquivos com invocação de `toast` | 137 |
| Invocações detectáveis de `toast` | 877 |
| Chamadas Sonner tipadas | 853 |
| `toast.error` | 510 |
| `toast.success` | 311 |
| `toast.info` | 17 |
| `toast.warning` | 15 |
| Chamadas Radix no formato `toast({ ... })` | 18 |
| Consumidores funcionais do hook Radix | 1 (`features/okr/OkrPage.tsx`) |
| Provedores globais montados | 2 |

Os números foram obtidos com busca estática em arquivos TypeScript/TSX. As 24 invocações não incluídas nas quatro categorias tipadas compreendem as 18 chamadas Radix e chamadas genéricas do Sonner, além da infraestrutura que declara as funções; por isso o total bruto não deve ser interpretado como número exato de mensagens exibidas em runtime.

O E2E `okr-cycle-closure.spec.ts` já consulta `[data-sonner-toast]`, embora `OkrPage.tsx` ainda emita pelo hook Radix. Não foram encontrados testes unitários dedicados ao comportamento dos dois provedores.

## Forças de decisão

- um contrato único para severidade, duração, ação, dismiss e posição;
- feedback acessível sem interromper indevidamente tecnologias assistivas;
- baixo risco de regressão sobre uma base com centenas de chamadas;
- API simples para operações assíncronas e mensagens atualizáveis;
- testes determinísticos e independentes da biblioteca escolhida;
- integração com o tema claro/escuro e os tokens visuais existentes;
- possibilidade de rollback por módulo.

## Alternativas consideradas

### Padronizar em Radix Toast

Vantagens:

- primitives permitem controle detalhado de composição, swipe, viewport e foco;
- a implementação local já oferece título, descrição, ação e variante destrutiva;
- o comportamento pode ser adaptado integralmente aos componentes do produto.

Desvantagens:

- apenas um consumidor funcional usa essa API, contra centenas de chamadas Sonner;
- exige migrar a ampla maioria do produto e recriar conveniências já usadas, como severidades, loading/promise e atualização por identificador;
- a implementação atual só modela `default` e `destructive` e não define contrato explícito de duração, posição ou prioridade de anúncio;
- eleva o risco e o custo de rollback sem benefício funcional demonstrado.

### Padronizar em Sonner

Vantagens:

- corresponde à adoção dominante e reduz a migração funcional ao consumidor legado de OKR;
- já está integrado ao tema e possui estilos por sucesso, erro, aviso e informação;
- oferece API imperativa, ações, dismiss, identificadores e fluxos assíncronos;
- o seletor estável `data-sonner-toast` já é usado no E2E.

Desvantagens:

- chamadas diretas à biblioteca hoje espalham detalhes de infraestrutura pelo domínio;
- o contrato atual não limita duração, deduplicação, conteúdo ou tratamento de erros sensíveis;
- a acessibilidade precisa ser validada como comportamento do produto, não apenas presumida pela biblioteca;
- mockar `sonner` em cada teste acoplaria a suíte à implementação.

### Manter as duas pilhas

Rejeitada. Preserva inconsistência perceptível, dois provedores globais e dois padrões de teste sem uma necessidade de domínio que justifique a variação.

## Decisão proposta

Adotar Sonner como mecanismo único de feedback transitório global e retirar o toast Radix após a migração do consumidor legado de OKR.

A aplicação não deve continuar importando Sonner diretamente em novos consumidores. A implementação posterior deste ADR deverá introduzir uma fachada interna, por exemplo `shared/feedback/notify`, que preserve uma API pequena e testável. O nome e a assinatura finais serão definidos no PR de fundação, sem alteração em massa no mesmo PR.

Feedback persistente, recuperável ou necessário para concluir uma tarefa não deve ser toast. Esses casos usam estado inline (`ErrorState`, alerta ou mensagem associada ao campo), mantendo conteúdo e ação disponíveis até resolução.

## Contrato funcional e de acessibilidade

| Tipo | Uso | Anúncio esperado | Duração inicial | Ação |
| --- | --- | --- | ---: | --- |
| `success` | operação concluída | não interruptivo | 4 s | opcional |
| `info` | mudança de contexto ou orientação breve | não interruptivo | 5 s | opcional |
| `warning` | risco reversível que não bloqueia o fluxo | não interruptivo | 7 s | recomendada quando houver recuperação |
| `error` | falha transitória já preservada no contexto | anúncio prioritário, validado com leitor de tela | 8 s | recomendada para tentar novamente |
| `loading` | operação assíncrona relevante | uma única mensagem atualizável | até conclusão | cancelar, quando suportado |

Regras obrigatórias:

1. Não comunicar informação somente por cor ou ícone.
2. Título deve ser curto; detalhes ficam em descrição e não devem expor stack trace, identificadores secretos ou resposta bruta do backend.
3. Ações possuem nome acessível explícito e devem funcionar por teclado.
4. Loading deve ser atualizado pelo mesmo identificador para evitar mensagens duplicadas.
5. Erro que remove dados da tela, bloqueia continuação ou exige decisão permanece também inline.
6. O tempo de exibição deve pausar quando a biblioteca oferecer interação por hover/foco; o teste de aceitação verificará leitura e acionamento sem depender do tempo real.
7. A política de região viva (`polite` para estados informativos e tratamento prioritário de erros) será confirmada por teste no DOM e leitor de tela antes da remoção do Radix. Se o Sonner não satisfizer esse contrato com configuração suportada, a decisão volta para revisão.

## Plano de implementação após aprovação

### Fase 1 — Fundação

- criar a fachada tipada e testes unitários do mapeamento de severidade, duração, descrição, ação e identificador;
- centralizar as opções do `Toaster` Sonner e documentar o uso de feedback inline;
- adicionar teste de integração do viewport, fechamento por teclado e atualização de loading;
- adicionar regra de lint ou teste de contrato que impeça novas importações diretas fora da fachada e do adaptador.

Gate: testes de unidade e acessibilidade passam, sem migrar consumidores existentes.

### Fase 2 — Piloto OKR

- migrar as 18 chamadas de `OkrPage.tsx` para a fachada;
- adaptar o E2E de ciclo OKR para validar mensagem, ação e ausência de duplicação sem depender exclusivamente do seletor da biblioteca;
- remover o `Toaster` Radix de `AppRoutes`, mantendo seus arquivos temporariamente para rollback.

Gate: fluxos criar, editar, arquivar, Key Result e atualização automática passam em desktop e teclado; somente um provedor aparece no DOM.

### Fase 3 — Encapsulamento progressivo

- migrar imports diretos de Sonner por domínio, em lotes pequenos;
- priorizar autenticação, operações destrutivas, uploads, Sala Ágil e backoffice;
- revisar cada toast contra a regra transitório versus inline;
- evitar alterações de texto ou regras de negócio no mesmo lote, salvo correção de segurança/acessibilidade documentada.

Gate por lote: testes do domínio, lint, build e busca estática sem novos imports diretos.

### Fase 4 — Limpeza

- remover `hooks/use-toast.ts`, `components/ui/toaster.tsx`, `components/ui/use-toast.ts` e primitives de toast Radix quando não houver consumidor;
- remover `@radix-ui/react-toast` se nenhum outro uso permanecer;
- atualizar documentação e baseline do inventário.

Gate final: zero uso do hook legado, um provedor global, zero import direto de Sonner fora da infraestrutura autorizada e suíte completa verde.

## Estratégia de testes

- unidade: fachada, sanitização de erro, defaults e atualização por id;
- componente: roles/regiões vivas, texto, foco, ação e dismiss;
- integração: tema claro/escuro e coexistência bloqueada de provedores;
- E2E: sucesso, erro, retry e loading em OKR, com relógio controlado quando aplicável;
- acessibilidade manual: NVDA + Chrome no Windows, contemplando anúncio, ordem, ação via teclado e ausência de interrupções repetidas.

Testes de domínio devem mockar a fachada interna, não `sonner`, para preservar liberdade de implementação.

## Rollback

Cada migração será isolada por domínio. Durante o piloto, os arquivos Radix permanecem disponíveis e o rollback consiste em restaurar seu provedor e o import de OKR. A dependência só será removida na Fase 4, depois do gate final. Não será usado feature flag permanente para escolher biblioteca em runtime, pois isso perpetuaria dois contratos.

## Consequências

Positivas:

- um único comportamento global e um único provedor;
- menor superfície de migração inicial;
- testes desacoplados da biblioteca;
- regras explícitas para acessibilidade e para feedback persistente.

Negativas:

- a etapa completa ainda exige encapsular uma base extensa de imports diretos;
- haverá manutenção temporária da fachada e de consumidores ainda não migrados;
- a validação de leitor de tela é gate manual e precisa constar no checklist de release.

## Aprovação

- [ ] Roberto revisou a recomendação e os gates.
- [ ] Frontend confirmou a estratégia de fachada e lint.
- [ ] UX/Acessibilidade aprovou severidades, duração e validação com leitor de tela.
- [ ] Migração autorizada.

Até que os quatro itens estejam registrados, este ADR permanece `proposto` e nenhuma chamada de produção deve ser migrada.
