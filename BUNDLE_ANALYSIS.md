# Bundle Analysis — PERF-001

## Como rodar o analisador de bundle

```bash
# Instalar dependência de desenvolvimento
npm install --save-dev rollup-plugin-visualizer terser

# Gerar build com relatório visual (abre stats.html automaticamente)
ANALYZE=true npm run build

# O relatório estará em:
dist/stats.html
```

---

## Estrutura de chunks esperada após PERF-001

| Chunk | Conteúdo | Tamanho estimado (gz) |
|---|---|---|
| `react-core` | react, react-dom | ~45 KB |
| `router` | react-router-dom | ~25 KB |
| `supabase` | @supabase/supabase-js | ~80 KB |
| `ui` | radix-ui + lucide-react + shadcn utils | ~120 KB |
| `vendor` | tanstack-query, sonner, date-fns, zod | ~60 KB |
| `dnd` | @dnd-kit (Kanban only) | ~30 KB |
| `charts` | recharts / d3 | ~90 KB |
| `feature-sustentacao` | Módulo Sustentação | ~80 KB |
| `feature-rdm` | Módulo RDM | ~60 KB |
| `feature-apf` | Módulo APF | ~40 KB |
| `feature-sala-agil-heavy` | Métricas, Histórico, Planning Poker, Retro, Calendário | ~100 KB |
| `index` (entry) | App shell + rotas + contexts | < 200 KB |

**Total estimado bundle inicial (só o que o usuário baixa na 1ª rota): < 500 KB gz**

---

## Métricas de referência (antes da PERF-001)

| Métrica | Valor |
|---|---|
| Bundle inicial | ~3.3 MB (sem gz) |
| TTFB | ~1040 ms |
| Lighthouse Performance | Não medido |

---

## Critérios de aceite

- [ ] Bundle principal < 1 MB (sem gz) / < 400 KB (gz)
- [ ] Redução ≥ 50% do bundle inicial
- [ ] Rotas secundárias carregadas sob demanda
- [ ] Sem regressões funcionais
- [ ] Lighthouse Performance ≥ 85

---

## Próximos passos (PERF-002 e PERF-003)

- Implementar Brotli na CDN/servidor
- Adicionar headers de cache imutável para chunks hashed
- Preload de chunks críticos via `<link rel="modulepreload">`
- Otimizar imagens e SVGs
