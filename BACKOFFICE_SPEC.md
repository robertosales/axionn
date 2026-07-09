# 📋 BACKOFFICE_SPEC.md
## Especificação Técnica — Módulo Backoffice Axionn
### Empresa: Roberto Sales LTDA | Versão: 1.0.0 | Data: 2026-07-08

---

## 1. Visão Geral

O **Axionn Backoffice** é um braço administrativo e financeiro da plataforma Axionn, acessível exclusivamente pelos funcionários da **Roberto Sales LTDA** — empresa idealizadora e proprietária do produto. Este módulo é completamente isolado da experiência dos clientes (tenants) e permite à equipe interna gerenciar contratos, receitas, clientes, suporte e operações da plataforma SaaS.

### 1.1 Objetivos

- Dar visibilidade financeira e operacional da plataforma para a equipe interna
- Gerenciar contratos, planos e faturamento de clientes
- Controlar o acesso de funcionários da Roberto Sales LTDA com roles específicos
- Oferecer suporte e helpdesk centralizado para os clientes do Axionn
- Monitorar métricas SaaS (MRR, ARR, Churn, Trial Conversion)

### 1.2 Escopo

**IN SCOPE:**
- Dashboard operacional interno
- Gestão de clientes/tenants (organizações cadastradas)
- Módulo financeiro (faturamento, receitas, inadimplência)
- Cadastro e gestão de funcionários internos (Roberto Sales LTDA)
- Suporte e helpdesk
- Analytics e métricas SaaS

**OUT OF SCOPE (v1.0):**
- Portal do cliente (já existente no sistema principal)
- Integrações com ERPs externos
- Geração automática de notas fiscais (planejado para v2.0)

---

## 2. Arquitetura

### 2.1 Estrutura de Diretórios

```
src/
  backoffice/
    pages/
      BODashboard.tsx          ← KPIs e visão geral operacional
      BOClientes.tsx           ← Gestão de tenants e contratos
      BOFinanceiro.tsx         ← Receitas, faturas, assinaturas
      BOEquipe.tsx             ← Funcionários Roberto Sales LTDA
      BOSuporte.tsx            ← Tickets e helpdesk
      BOAnalitico.tsx          ← Métricas SaaS (MRR, Churn, NPS)
      BOConfiguracoes.tsx      ← Configurações do backoffice
    components/
      BackofficeSidebar.tsx    ← Sidebar exclusiva do backoffice
      BackofficeHeader.tsx     ← Header com identidade Roberto Sales
      MetricCard.tsx           ← Card de KPI reutilizável
      ClienteStatusBadge.tsx   ← Badge de status de cliente
      FaturaTable.tsx          ← Tabela de faturas
    guards/
      BackofficeGuard.tsx      ← Proteção de rota por role owner_staff
    hooks/
      useBackofficeAuth.ts     ← Hook de autenticação backoffice
      useClientes.ts           ← Hook de dados de clientes
      useFinanceiro.ts         ← Hook de dados financeiros
      useMetricasSaaS.ts       ← Hook de métricas agregadas
    types/
      backoffice.types.ts      ← Tipos TypeScript do módulo
```

### 2.2 Rotas

| Rota | Componente | Roles Permitidos |
|------|-----------|-----------------|
| `/backoffice` | BODashboard | admin, financeiro, suporte, comercial, dev |
| `/backoffice/clientes` | BOClientes | admin, comercial, financeiro |
| `/backoffice/financeiro` | BOFinanceiro | admin, financeiro |
| `/backoffice/equipe` | BOEquipe | admin |
| `/backoffice/suporte` | BOSuporte | admin, suporte, comercial |
| `/backoffice/analitico` | BOAnalitico | admin, financeiro, comercial |
| `/backoffice/configuracoes` | BOConfiguracoes | admin |

### 2.3 Proteção de Acesso

A rota `/backoffice/*` é protegida pela `BackofficeGuard`. O fluxo de autenticação:

1. Usuário autentica normalmente via Supabase Auth
2. Guard verifica se `user_id` existe em `owner_staff_members` com `is_active = true`
3. Guard carrega o `role` do staff e injeta no contexto
4. Componentes usam o role para renderização condicional de features
5. Qualquer acesso não autorizado redireciona para `/` sem expor a existência da rota

```typescript
// src/backoffice/guards/BackofficeGuard.tsx (pseudocódigo)
const BackofficeGuard = ({ children, requiredRoles }) => {
  const { staffMember, isLoading } = useBackofficeAuth();

  if (isLoading) return <LoadingSpinner />;
  if (!staffMember) return <Navigate to="/" replace />;
  if (requiredRoles && !requiredRoles.includes(staffMember.role)) {
    return <Navigate to="/backoffice" replace />;
  }
  return children;
};
```

---

## 3. Banco de Dados (Supabase / PostgreSQL)

### 3.1 Tabelas Necessárias

#### `owner_staff_members` — Funcionários da Roberto Sales LTDA

```sql
CREATE TABLE owner_staff_members (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name     TEXT NOT NULL,
  email         TEXT NOT NULL,
  role          TEXT NOT NULL CHECK (role IN ('admin', 'financeiro', 'suporte', 'comercial', 'dev')),
  department    TEXT,
  avatar_url    TEXT,
  is_active     BOOLEAN DEFAULT true,
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now(),
  last_login_at TIMESTAMPTZ,
  UNIQUE(user_id),
  UNIQUE(email)
);

-- RLS: apenas o próprio usuário e admins podem acessar
ALTER TABLE owner_staff_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "staff_can_read_own" ON owner_staff_members
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "admin_full_access" ON owner_staff_members
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM owner_staff_members
      WHERE user_id = auth.uid() AND role = 'admin' AND is_active = true
    )
  );
```

#### `billing_records` — Registro de Faturas e Cobranças

```sql
CREATE TABLE billing_records (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id      UUID REFERENCES organizations(id) ON DELETE SET NULL,
  tenant_name    TEXT NOT NULL,
  amount         DECIMAL(10,2) NOT NULL,
  currency       TEXT DEFAULT 'BRL',
  status         TEXT NOT NULL CHECK (status IN ('pending', 'paid', 'overdue', 'cancelled', 'refunded')),
  plan_type      TEXT NOT NULL CHECK (plan_type IN ('starter', 'professional', 'enterprise', 'custom')),
  billing_period TEXT NOT NULL CHECK (billing_period IN ('monthly', 'quarterly', 'annual')),
  due_date       DATE NOT NULL,
  paid_at        TIMESTAMPTZ,
  invoice_url    TEXT,
  notes          TEXT,
  created_by     UUID REFERENCES owner_staff_members(id),
  created_at     TIMESTAMPTZ DEFAULT now(),
  updated_at     TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE billing_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "staff_financeiro_access" ON billing_records
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM owner_staff_members
      WHERE user_id = auth.uid()
        AND role IN ('admin', 'financeiro')
        AND is_active = true
    )
  );
```

#### `support_tickets` — Tickets de Suporte Interno

```sql
CREATE TABLE support_tickets (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_number TEXT UNIQUE NOT NULL,
  tenant_id     UUID REFERENCES organizations(id) ON DELETE SET NULL,
  tenant_name   TEXT NOT NULL,
  reporter_name TEXT NOT NULL,
  reporter_email TEXT NOT NULL,
  subject       TEXT NOT NULL,
  description   TEXT NOT NULL,
  category      TEXT CHECK (category IN ('bug', 'feature_request', 'billing', 'access', 'other')),
  priority      TEXT CHECK (priority IN ('low', 'medium', 'high', 'critical')),
  status        TEXT CHECK (status IN ('open', 'in_progress', 'waiting_client', 'resolved', 'closed')),
  assigned_to   UUID REFERENCES owner_staff_members(id),
  resolved_at   TIMESTAMPTZ,
  sla_deadline  TIMESTAMPTZ,
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE support_tickets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "staff_suporte_access" ON support_tickets
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM owner_staff_members
      WHERE user_id = auth.uid()
        AND role IN ('admin', 'suporte', 'comercial')
        AND is_active = true
    )
  );
```

#### `saas_metrics_snapshots` — Snapshots de Métricas (diários)

```sql
CREATE TABLE saas_metrics_snapshots (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  snapshot_date   DATE UNIQUE NOT NULL,
  total_tenants   INTEGER DEFAULT 0,
  active_tenants  INTEGER DEFAULT 0,
  trial_tenants   INTEGER DEFAULT 0,
  churned_tenants INTEGER DEFAULT 0,
  mrr             DECIMAL(12,2) DEFAULT 0,
  arr             DECIMAL(12,2) DEFAULT 0,
  new_mrr         DECIMAL(12,2) DEFAULT 0,
  churned_mrr     DECIMAL(12,2) DEFAULT 0,
  total_users     INTEGER DEFAULT 0,
  active_users_30d INTEGER DEFAULT 0,
  open_tickets    INTEGER DEFAULT 0,
  created_at      TIMESTAMPTZ DEFAULT now()
);
```

### 3.2 Migration Script

Arquivo a criar: `supabase/migrations/[timestamp]_create_backoffice_tables.sql`

---

## 4. Módulos Funcionais Detalhados

### 4.1 Dashboard (BODashboard)

**KPIs exibidos em cards:**
- 💰 MRR atual (Receita Recorrente Mensal)
- 📈 ARR (Receita Recorrente Anual)
- 🏢 Total de clientes ativos
- 🔄 Churn rate do mês
- 🎫 Tickets abertos
- ⚠️ Faturas em atraso

**Gráficos:**
- Evolução MRR (últimos 12 meses) — linha
- Novos clientes vs Churned (últimos 6 meses) — barras
- Distribuição por plano — pizza
- Status dos tickets — donut

---

### 4.2 Gestão de Clientes (BOClientes)

**Lista de tenants com:**
- Nome da organização
- Plano contratado (Starter / Professional / Enterprise / Custom)
- Status (trial | active | suspended | churned)
- Data de início e vencimento
- Quantidade de usuários ativos
- MRR individual
- Ações: Ver detalhes, Editar contrato, Suspender, Renovar

**Detalhe do cliente:**
- Histórico de faturas
- Usuários cadastrados
- Features habilitadas (licenciamento por módulo)
- Log de atividade
- Tickets abertos

---

### 4.3 Módulo Financeiro (BOFinanceiro)

**Visão resumo:**
- Receita do mês atual vs meta
- Faturas pagas / pendentes / vencidas
- Próximos vencimentos (30 dias)

**Tabela de faturas:**
- Filtros: status, período, plano, cliente
- Exportação CSV/PDF
- Ações: Marcar como pago, Enviar lembrete, Cancelar, Ver fatura

**Gestão de planos:**
- Cadastro e edição de planos (nome, valor, features incluídas, limites)
- Histórico de alterações de preço

---

### 4.4 Gestão de Equipe (BOEquipe)

**Cadastro de funcionários:**
- Nome completo, e-mail, departamento
- Role do backoffice (admin | financeiro | suporte | comercial | dev)
- Status ativo/inativo
- Data de acesso

**Ações:**
- Convidar novo funcionário (envio de e-mail com link de acesso)
- Revogar acesso imediato
- Alterar role
- Ver log de atividades do funcionário

---

### 4.5 Suporte e Helpdesk (BOSuporte)

**Kanban ou Lista de tickets:**
- Colunas: Aberto → Em Progresso → Aguardando Cliente → Resolvido
- Filtros: prioridade, categoria, atribuído a, cliente
- SLA visual: verde (no prazo), amarelo (próximo), vermelho (vencido)

**Detalhe do ticket:**
- Thread de comentários internos e externos
- Histórico de status
- Atribuição para membro da equipe
- Marcação de resolução com causa raiz

---

### 4.6 Analytics SaaS (BOAnalitico)

**Métricas principais:**
- MRR Growth Rate
- Churn Rate (mensal e anual)
- Customer Lifetime Value (LTV)
- CAC (Customer Acquisition Cost — input manual)
- NPS Score (input manual ou integração futura)
- Trial → Paid Conversion Rate
- Feature Adoption Rate (por módulo)

**Relatórios exportáveis:**
- Relatório mensal financeiro (PDF)
- Relatório de churn (CSV)
- Relatório de uso por feature (CSV)

---

## 5. Componentes de UI

### 5.1 Layout do Backoffice

O backoffice terá identidade visual diferenciada do painel cliente:
- Sidebar com fundo escuro (distinguível do painel principal)
- Header com logo "Axionn | Backoffice" e badge "Roberto Sales LTDA"
- Cores de acento: manter paleta Axionn mas com variação para indicar contexto interno

### 5.2 Componentes Reutilizáveis

| Componente | Descrição |
|-----------|-----------|
| `MetricCard` | Card com ícone, valor, variação percentual e período |
| `StatusBadge` | Badge colorido para status de clientes/faturas/tickets |
| `DataTable` | Tabela com sort, filtro, paginação e exportação |
| `TrendChart` | Gráfico de linha para evolução temporal |
| `DistributionChart` | Pizza/Donut para distribuição por categoria |
| `BackofficeLayout` | Layout wrapper com sidebar e header do backoffice |

---

## 6. Segurança e Compliance

- Todas as rotas `/backoffice/*` protegidas via `BackofficeGuard`
- RLS (Row Level Security) habilitado em todas as tabelas do backoffice
- Separação total de dados: staff não acessa dados de projeto dos clientes diretamente
- Log de auditoria de todas as ações críticas (suspensão de cliente, alteração de fatura)
- Sessões com timeout reduzido para o backoffice (recomendado: 4h)
- 2FA recomendado como obrigatório para todos os membros staff (implementação futura)

---

## 7. Plano de Implementação

### Fase 1 — Fundação (Semanas 1-2)
- [ ] Migration SQL: `owner_staff_members`, `billing_records`
- [ ] `BackofficeGuard` e `useBackofficeAuth`
- [ ] Registro de rotas `/backoffice/*` em `App.tsx`
- [ ] `BackofficeLayout` com sidebar e header
- [ ] Cadastro do primeiro admin (Roberto Sales)

### Fase 2 — Core Admin (Semanas 3-4)
- [ ] `BODashboard` com KPIs reais
- [ ] `BOEquipe` — cadastro e gestão de funcionários
- [ ] `BOClientes` — listagem e detalhes de tenants

### Fase 3 — Financeiro (Semanas 5-6)
- [ ] `BOFinanceiro` — faturas, status, filtros
- [ ] Migration: `billing_records` completo
- [ ] Exportação de relatórios CSV

### Fase 4 — Suporte e Analytics (Semanas 7-8)
- [ ] `BOSuporte` — tickets e helpdesk
- [ ] `BOAnalitico` — métricas e gráficos
- [ ] Migration: `support_tickets`, `saas_metrics_snapshots`

### Fase 5 — Refinamento e Launch (Semana 9+)
- [ ] Testes de integração
- [ ] Documentação de uso para equipe interna
- [ ] Onboarding dos primeiros funcionários
- [ ] Monitoramento e ajustes pós-lançamento

---

## 8. Estimativa de Pontos de Função (APF)

| Módulo | Tipo | PF Estimado |
|--------|------|------------|
| owner_staff_members (CRUD) | ALI + EE + SE | ~15 PF |
| billing_records (CRUD) | ALI + EE + SE | ~20 PF |
| support_tickets (CRUD + workflow) | ALI + EE + SE + CE | ~25 PF |
| saas_metrics_snapshots | ALI + SE | ~10 PF |
| BODashboard (KPIs + gráficos) | SE + CE | ~18 PF |
| BOAnalitico (relatórios) | SE + CE | ~15 PF |
| BackofficeGuard + Auth | EE + CE | ~8 PF |
| **TOTAL ESTIMADO** | | **~111 PF** |

> Legenda: ALI = Arquivo Lógico Interno, EE = Entrada Externa, SE = Saída Externa, CE = Consulta Externa

---

## 9. Dependências e Integrações Futuras

**v1.0 (este spec):**
- Supabase Auth (já existente)
- Supabase PostgreSQL (já existente)
- Recharts ou Chart.js para visualizações

**v2.0 (planejado):**
- Stripe / PagSeguro para cobrança automatizada
- Resend / SendGrid para e-mails transacionais (lembretes de fatura, convites)
- Integração com nota fiscal eletrônica (NFe/NFS-e)
- Webhook de eventos de clientes (novo cadastro, upgrade, downgrade, churn)

---

## 10. Glossário

| Termo | Definição |
|-------|-----------|
| Tenant | Organização cliente cadastrada no Axionn |
| Staff | Funcionário da Roberto Sales LTDA com acesso ao backoffice |
| MRR | Monthly Recurring Revenue — Receita Recorrente Mensal |
| ARR | Annual Recurring Revenue — Receita Recorrente Anual |
| Churn | Taxa de cancelamento de clientes no período |
| LTV | Lifetime Value — valor total gerado por um cliente |
| SLA | Service Level Agreement — prazo de atendimento acordado |
| RLS | Row Level Security — segurança por linha no PostgreSQL |
| APF | Análise de Pontos de Função — métrica de tamanho de software |

---

*Documento criado em 08/07/2026 | Roberto Sales LTDA | Axionn Platform*
