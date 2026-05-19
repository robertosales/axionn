-- ============================================================
-- Migration: 20260519152000_normalize_checklist_template_fase
-- Objetivo : Normaliza itens de template cujo campo 'categoria'
--            está NULL, vazio ou com valor livre (texto solto)
--            para os valores canônicos das 3 fases.
--
-- Regra    : Qualquer valor que não seja exatamente
--            'pre_implantacao', 'execucao' ou 'pos_implantacao'
--            é migrado para 'execucao' (fase central, mais seguro).
-- ============================================================

UPDATE public.rdm_checklist_templates
SET    categoria = 'execucao'
WHERE  categoria IS NULL
   OR  categoria = ''
   OR  categoria NOT IN ('pre_implantacao', 'execucao', 'pos_implantacao');

-- Mesma normalização para itens já copiados em RDMs existentes
UPDATE public.rdm_checklist_items
SET    categoria = 'execucao'
WHERE  categoria IS NULL
   OR  categoria = ''
   OR  categoria NOT IN ('pre_implantacao', 'execucao', 'pos_implantacao');
