# Redesign de Perfis e Permissões (RBAC)

## Diagnóstico

A tela atual se chama **Perfis (RBAC)**, mas sua arquitetura é centrada em usuários. O administrador encontra uma tabela de pessoas e abre um painel lateral para escolher módulos e papéis predefinidos. Isso atende à atribuição, porém não à governança de perfis.

Principais problemas:

1. **Modelo mental incorreto:** definição de perfil e atribuição ao usuário aparecem como se fossem a mesma tarefa.
2. **Baixa visibilidade:** não existe catálogo de perfis, quantidade de permissões, módulos cobertos, origem ou impacto.
3. **Escalabilidade limitada:** um painel lateral simples não comporta centenas de permissões com segurança.
4. **Densidade excessiva:** textos muito pequenos, ações escondidas e tabela pouco adaptável a dispositivos móveis.
5. **Feedback incompleto:** loading baseado apenas em spinner e estados vazio/erro sem orientação suficiente.
6. **Risco operacional:** não há revisão consolidada antes de aplicar um conjunto amplo de privilégios.

## Arquitetura da informação

```text
Perfis e permissões
├── Perfis de acesso
│   ├── Indicadores
│   ├── Busca e filtros
│   ├── Catálogo de perfis
│   └── Wizard de criação/edição
│       ├── 1. Identidade
│       ├── 2. Módulos
│       ├── 3. Permissões
│       └── 4. Revisão
├── Atribuições
│   ├── Busca de usuários
│   ├── Módulos e perfis atribuídos
│   ├── Times e status
│   └── Ações administrativas existentes
├── Simulador
│   ├── Busca de membro
│   ├── Perfis efetivos por módulo
│   ├── Permissões agrupadas
│   └── Alertas de bypass administrativo e conta inativa
└── Histórico
    ├── Busca e filtros por evento/perfil
    ├── Linha do tempo tenant-scoped
    └── Exportação CSV
```

## Fluxo principal

1. O administrador entra em **Perfis de acesso** e entende o estado do RBAC pelos indicadores.
2. Pesquisa, filtra ou abre um perfil existente.
3. Ao criar um perfil, informa identidade e contexto antes de visualizar permissões.
4. Seleciona os módulos que fazem parte do escopo.
5. Pesquisa permissões, expande grupos e usa seleção individual ou em massa.
6. Revisa módulos, permissões e usuários impactados.
7. Salva e recebe confirmação; em erro, permanece no passo atual com uma ação de recuperação.
8. Compara dois perfis antes de substituir ou duplicar responsabilidades.
9. Simula o acesso efetivo de um membro sem alterar sua atribuição.
10. Consulta e exporta o histórico global de mudanças RBAC da organização.

## Wireframe

```text
┌──────────────────────────────────────────────────────────────────────┐
│ Perfis e permissões                                [ + Novo perfil ] │
│ Controle quem acessa cada recurso do Axionn.                         │
├──────────────────────────────────────────────────────────────────────┤
│ [ Perfis de acesso ] [ Atribuições ]                                 │
│                                                                      │
│ [ Total ] [ Personalizados ] [ Permissões ] [ Em uso ]               │
│                                                                      │
│ [ Buscar perfil...        ] [Categoria] [Módulo] [ + Novo perfil ]  │
│                                                                      │
│ ┌──────────────────────┐  ┌──────────────────────┐                   │
│ │ ◈ Desenvolvedor      │  │ ◎ Scrum Master      │                   │
│ │ Engenharia · Ativo   │  │ Agilidade · Sistema │                   │
│ │ 2 módulos · 18 perms │  │ 2 módulos · 31 perms │                  │
│ │ 24 usuários          │  │ 8 usuários           │                  │
│ │ [Ver detalhes] [•••] │  │ [Ver detalhes] [•••] │                  │
│ └──────────────────────┘  └──────────────────────┘                   │
└──────────────────────────────────────────────────────────────────────┘

Wizard
┌──────────────────────────────────────────────────────────────────────┐
│ Novo perfil                                                          │
│ ① Identidade ─── ② Módulos ─── ③ Permissões ─── ④ Revisão           │
│ [progresso]                                                          │
├──────────────────────────────────────────────────────────────────────┤
│ Conteúdo progressivo do passo atual                                  │
├──────────────────────────────────────────────────────────────────────┤
│ [Cancelar]                                      [Voltar] [Continuar] │
└──────────────────────────────────────────────────────────────────────┘
```

## Decisões de design

- **Separação entre perfis e atribuições:** reduz ambiguidade e permite que cada fluxo cresça independentemente.
- **Wizard:** aplica divulgação progressiva e reduz a carga cognitiva de uma matriz extensa.
- **Accordion por grupo:** mantém contexto e suporta centenas de permissões sem renderizar uma lista visualmente interminável.
- **Busca e ações em massa:** reduz o custo de operação para administradores avançados.
- **Revisão final:** cria um ponto deliberado de confirmação antes de alterar privilégios.
- **Cards responsivos:** melhor leitura no catálogo; a tabela continua apenas onde comparação tabular é necessária.
- **Tokens semânticos:** cores, bordas e superfícies herdam light/dark mode do Axionn.
- **Acessibilidade:** labels persistentes, foco visível, alvos de 44px, estados anunciados e informação que não depende apenas de cor.

## Estrutura React

```text
features/rbac/
├── RbacWorkspace.tsx
├── hooks/useRbacProfiles.ts
├── types.ts
├── rbacCatalog.tsx
└── components/
    ├── RbacProfileCard.tsx
    ├── RbacProfileWizard.tsx
    ├── RbacPermissionMatrix.tsx
    ├── RbacProfilesManager.tsx
    ├── RbacProfileComparisonDialog.tsx
    ├── RbacAccessSimulator.tsx
    └── RbacAuditPanel.tsx
```

## Evoluções entregues na fase de insights

- Comparação lado a lado entre dois perfis, com diferenças por permissão.
- Simulador “ver como usuário” com perfis efetivos por módulo.
- Histórico global tenant-scoped com busca, filtros e exportação CSV.

## Evoluções entregues na fase de governança

- Aprovação em duas etapas para alterações de perfis privilegiados, com separação obrigatória entre solicitante e revisor.
- Atribuições temporárias por módulo, com prazo máximo de 365 dias, justificativa auditável e expiração aplicada nos verificadores de runtime.
- Central de governança com solicitações pendentes, acessos temporários e recomendações de menor privilégio.
- Recomendações baseadas em evidências reais de atividade dos últimos 90 dias, status do membro e expiração; a interface explicita que esses sinais não medem cada permissão individualmente.
