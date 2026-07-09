# 📋 Axionn — Diretrizes do Projeto

> Este arquivo é a **fonte da verdade** para qualquer implementação no projeto.
> Antes de criar, alterar ou remover qualquer coisa, leia e siga estas diretrizes.

---

## 🏗️ Stack & Tecnologias

| Camada | Tecnologia |
|---|---|
| Frontend | React 18 + TypeScript (strict) |
| Build | Vite |
| Estilo | Tailwind CSS + shadcn/ui |
| Roteamento | React Router v6 |
| Backend / Auth | Supabase (cloud via Lovable) |
| Edge Functions | Deno (pasta `supabase/functions/`) |
| Notificações | Sonner (`toast`) |
| Ícones | Lucide React |
| Estado global | React Context (`src/contexts/`) |
| Gerenciador de pacotes | Bun |

---

## 📁 Estrutura de Pastas

```
src/
├── components/        # Componentes globais reutilizáveis
│   └── ui/            # shadcn/ui — NÃO editar diretamente
├── contexts/          # Contextos globais (AuthContext, etc.)
├── features/          # Módulos do sistema (ver abaixo)
│   ├── organization/  # Gestão de membros e organização
│   ├── sala_agil/     # Módulo Sala Ágil
│   ├── sustentacao/   # Módulo Sustentação
│   └── rdm/           # Módulo RDM
├── hooks/             # Hooks globais
├── integrations/      # Configurações de integrações (Supabase client)
├── lib/               # Utilitários (cn, etc.)
├── pages/             # Páginas de nível raiz (não-modulares)
└── types/             # Tipos TypeScript globais

supabase/
├── functions/         # Edge Functions Deno
│   └── admin-user-management/
└── migrations/        # Migrations SQL
```

### Regra de organização por feature

Cada feature dentro de `src/features/` deve seguir:
```
features/<modulo>/
├── components/   # Componentes exclusivos do módulo
├── hooks/        # Hooks exclusivos do módulo
├── pages/        # Páginas do módulo
└── types/        # Tipos do módulo (se necessário)
```

---

## ✅ Checklist — Antes de qualquer implementação

1. **Leia o código existente** — verifique se já existe algo similar antes de criar do zero
2. **Verifique a branch** — toda implementação vai para `develop`, nunca direto em `main`
3. **Não duplique lógica** — extraia em hook ou componente se for usar em 2+ lugares
4. **Não quebre o que funciona** — alterações em hooks/contexts compartilhados exigem atenção redobrada
5. **Edge Functions** — qualquer alteração em `supabase/functions/` requer bump no comentário de redeploy para o Lovable redeployar automaticamente
6. **Sem `console.log` em produção** — use apenas em desenvolvimento local
7. **Tipagem obrigatória** — nunca use `any` sem justificativa; prefira tipos explícitos
8. **Sem segredos no código** — credenciais, chaves e tokens sempre via variáveis de ambiente

---

## 🎨 Padrões de Layout & UI

### Design tokens
- **Espaçamento:** escala de 8px (use classes Tailwind: `p-4`, `gap-2`, `mt-6`, etc.)
- **Botões de ação em modais:** altura `h-11` (44px), padding `px-5`
- **Inputs:** altura padrão `h-10`
- **Bordas arredondadas:** `rounded-lg` para cards/containers, `rounded-full` para badges
- **Largura de modais:** `sm:max-w-[560px]` (padrão), `sm:max-w-md` (confirmações)

### Componentes UI
- **Sempre** usar componentes de `@/components/ui/` (shadcn) antes de criar um novo
- Não estilizar os componentes `ui/` diretamente — use `className` via prop
- Para ícones, **sempre** usar `lucide-react`
- Badges de módulos seguem o padrão de cores:
  - `sala_agil` → violeta
  - `sustentacao` → azul
  - `rdm` → roxo
  - `owner` → âmbar
  - `admin` → esmeralda
  - erro/inativo → rose/destructive

### Responsividade
- Mobile-first: sempre considerar telas pequenas primeiro
- Usar `truncate` + `min-w-0` em textos dentro de flex containers para evitar overflow
- Usar `shrink-0` em ícones e avatares para não serem comprimidos

### Dark mode
- Todas as cores devem ter variante `dark:` quando usar cores fixas (ex: `text-violet-700 dark:text-violet-300`)
- Prefira variáveis semânticas do Tailwind: `text-foreground`, `text-muted-foreground`, `bg-background`, `border-border`

---

## 🔒 Segurança & Auth

- **Autenticação:** gerenciada pelo `AuthContext` via Supabase Auth
- **Autorização por módulo:** verificada via `organization_members.module_keys[]`
- **Autorização de admin:** verificada na tabela `user_roles` com `role = 'admin'`
- **Edge Functions:** sempre validar o token do caller antes de executar qualquer ação
- **Nunca** retornar `action_link` ou tokens one-time no body de respostas HTTP
- **Nunca** expor `SERVICE_ROLE_KEY` no frontend — uso exclusivo de Edge Functions
- Senhas temporárias geradas **sempre no servidor** (Edge Function), nunca no browser

---

## 🗄️ Supabase — Convenções

### Queries
- Sempre usar `.maybeSingle()` ao buscar um único registro (evita erro 406)
- Prefira `.select("campo1, campo2")` em vez de `.select("*")` para economizar banda
- Erros de query devem ser tratados explicitamente — nunca ignore o campo `error`

### Tabelas principais
| Tabela | Uso |
|---|---|
| `profiles` | Dados públicos do usuário (displayName, email, must_change_password) |
| `user_roles` | Papel global do usuário (admin) |
| `organizations` | Dados da organização |
| `organization_members` | Membros, papéis e módulos liberados |
| `organization_invitations` | Convites pendentes/expirados |
| `user_management_audit_log` | Auditoria de ações administrativas |

### Edge Functions
- Toda função deve validar CORS antes de qualquer lógica (`getCorsHeaders`)
- Toda função deve verificar o token do caller e seu papel antes de executar
- Bump obrigatório no comentário de redeploy ao alterar: `// Redeploy bump: YYYY-MM-DD — descrição`
- Actions disponíveis em `admin-user-management`: `reset_password`, `change_email`

---

## 🧩 Módulos do Sistema

| Chave | Nome | Status |
|---|---|---|
| `sala_agil` | Sala Ágil | ✅ Ativo |
| `sustentacao` | Sustentação | ✅ Ativo |
| `rdm` | RDM | ✅ Ativo |

Novos módulos devem ser adicionados:
1. Na constante `MODULES` em `OrganizationMembersPage.tsx`
2. No tipo `OrganizationModuleKey` em `useOrganizationMembers.ts`
3. Na documentação desta tabela

---

## 📝 Convenções de Código

### TypeScript
- Tipos de props sempre explícitos em componentes
- Prefira `type` a `interface` para objetos simples
- Use `as const` em objetos de mapeamento estáticos
- Evite `!` (non-null assertion) — prefira guards ou optional chaining

### React
- Componentes funcionais com tipagem explícita de props
- `useCallback` em handlers passados como props ou usados em `useEffect`
- `useMemo` para cálculos derivados de listas grandes
- Evite `useEffect` para lógica que pode ser derivada diretamente
- Estado de loading/erro sempre tratado na UI (nunca deixe tela em branco)

### Nomenclatura
- Componentes: `PascalCase`
- Hooks: `useCamelCase`
- Funções handler: `handleNomeDoEvento`
- Arquivos de componente: `NomeDoComponente.tsx`
- Arquivos de hook: `useNomeDoHook.ts`

### Commits
- Prefixos obrigatórios: `feat:`, `fix:`, `chore:`, `docs:`, `refactor:`, `style:`
- Mensagem em português do Brasil
- Exemplo: `fix: corrige geração de senha temporária na edge function`

---

## 🚀 Fluxo de Deploy (via Lovable)

1. Todo commit na branch `develop` é detectado pelo Lovable
2. Lovable faz build e deploy automático do frontend
3. Alterações em `supabase/functions/**` triggerem redeploy das Edge Functions
4. **Não há CLI local** — todo deploy é via push para o GitHub
5. Variáveis de ambiente são gerenciadas no painel do Lovable/Supabase

---

## ⚠️ Erros Conhecidos & Soluções

| Erro | Causa | Solução |
|---|---|---|
| `400 invalid_credentials` no login | Senha não foi aplicada no Supabase Auth | Gerar nova senha temporária pelo modal após redeploy da Edge Function |
| `403` na Edge Function | Caller não tem `role = 'admin'` em `user_roles` | Verificar registro na tabela `user_roles` |
| Edge Function retorna código antigo | Lovable não redeployou | Fazer bump no comentário da função |
| Modal exibe senha que não funciona | Senha gerada localmente (bug antigo) | Corrigido em 2026-07-06 — sempre usar `action: reset_password` via Edge Function |

---

_Última atualização: 2026-07-06_
