import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import {
  AlertCircle, CheckCircle, Loader2, Plus, Trash2,
  Settings, BookOpen, Zap
} from 'lucide-react'
import { supabase } from '@/integrations/supabase/client'

interface BaselineData {
  id?: string
  project_id: string
  domain_context: string
  technology_stack: string[]
  complexity_rules: Record<string, string>
  additional_instructions: string
  status: 'draft' | 'active' | 'archived'
  version: number
}

interface FunctionPointBaselineProps {
  projectId: string
  projectName?: string
}

const defaultBaseline = (projectId: string): BaselineData => ({
  project_id: projectId,
  domain_context: '',
  technology_stack: [],
  complexity_rules: {
    baixa: 'Operações CRUD simples, sem regras de negócio complexas, até 3 entidades envolvidas',
    media: 'Lógica de negócio moderada, validações, 3-6 entidades ou integrações simples',
    alta: 'Regras de negócio complexas, múltiplas integrações, mais de 6 entidades, cálculos avançados',
  },
  additional_instructions: '',
  status: 'draft',
  version: 1,
})

export function FunctionPointBaseline({ projectId, projectName }: FunctionPointBaselineProps) {
  const [baseline, setBaseline] = useState<BaselineData>(defaultBaseline(projectId))
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [newTech, setNewTech] = useState('')
  const [analysisSummary, setAnalysisSummary] = useState<{
    total: number
    validated: number
    avgAccuracy: number
  } | null>(null)

  useEffect(() => {
    loadBaseline()
    loadSummary()
  }, [projectId])

  const loadBaseline = async () => {
    setLoading(true)
    const { data } = await supabase
      .from('project_fp_baselines')
      .select('*')
      .eq('project_id', projectId)
      .eq('status', 'active')
      .maybeSingle()
    if (data) {
      setBaseline({
        ...data,
        technology_stack: (data.technology_stack as string[]) ?? [],
        complexity_rules: (data.complexity_rules as Record<string, string>) ?? {},
      })
    }
    setLoading(false)
  }

  const loadSummary = async () => {
    const { data: all } = await supabase
      .from('function_point_analyses')
      .select('is_validated, ai_raw_count, validated_count')
      .eq('project_id', projectId)

    if (!all) return
    const validated = all.filter((a) => a.is_validated)
    const avgAccuracy = validated.length > 0
      ? validated.reduce((sum, a) => {
          const diff = Math.abs((a.validated_count ?? a.ai_raw_count) - a.ai_raw_count)
          return sum + (1 - diff / Math.max(a.ai_raw_count, 1))
        }, 0) / validated.length
      : 0

    setAnalysisSummary({
      total: all.length,
      validated: validated.length,
      avgAccuracy: Math.round(avgAccuracy * 100),
    })
  }

  const handleSave = async (activate = false) => {
    setSaving(true)
    setError(null)
    setSaved(false)
    try {
      const { data: { user } } = await supabase.auth.getUser()

      // Arquiva baseline ativo anterior se for ativar novo
      if (activate) {
        await supabase
          .from('project_fp_baselines')
          .update({ status: 'archived' })
          .eq('project_id', projectId)
          .eq('status', 'active')
      }

      const payload = {
        ...baseline,
        status: activate ? 'active' : baseline.status,
        created_by: user?.id,
        updated_at: new Date().toISOString(),
      }

      if (baseline.id) {
        const { error: updateError } = await supabase
          .from('project_fp_baselines')
          .update(payload)
          .eq('id', baseline.id)
        if (updateError) throw updateError
      } else {
        const { data: created, error: insertError } = await supabase
          .from('project_fp_baselines')
          .insert(payload)
          .select('id')
          .single()
        if (insertError) throw insertError
        setBaseline((prev) => ({ ...prev, id: created.id, status: activate ? 'active' : 'draft' }))
      }
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar baseline')
    } finally {
      setSaving(false)
    }
  }

  const addTech = () => {
    if (!newTech.trim()) return
    setBaseline((prev) => ({
      ...prev,
      technology_stack: [...prev.technology_stack, newTech.trim()],
    }))
    setNewTech('')
  }

  const removeTech = (i: number) => {
    setBaseline((prev) => ({
      ...prev,
      technology_stack: prev.technology_stack.filter((_, idx) => idx !== i),
    }))
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header com status de aprendizado */}
      {analysisSummary && analysisSummary.total > 0 && (
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="flex items-center justify-between py-4">
            <div className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-primary" />
              <div>
                <p className="text-sm font-medium">Aprendizado do Agente</p>
                <p className="text-xs text-muted-foreground">
                  {analysisSummary.validated} de {analysisSummary.total} contagens validadas
                </p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold text-primary">{analysisSummary.avgAccuracy}%</p>
              <p className="text-xs text-muted-foreground">precisão média</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Status do baseline */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <Settings className="h-5 w-5" />
            Baseline de Ponto de Função
          </h2>
          {projectName && (
            <p className="text-sm text-muted-foreground">{projectName}</p>
          )}
        </div>
        <Badge variant={baseline.status === 'active' ? 'default' : 'secondary'}>
          {baseline.status === 'active' ? 'Ativo' : baseline.status === 'draft' ? 'Rascunho' : 'Arquivado'}
        </Badge>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          <AlertCircle className="h-4 w-4" />
          {error}
        </div>
      )}

      {/* Contexto do domínio */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <BookOpen className="h-4 w-4" />
            Contexto do Domínio
          </CardTitle>
          <CardDescription>
            Descreva o sistema, negócio e regras que o agente deve considerar ao contar PF.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Textarea
            placeholder="Ex: Sistema de gestão de sprints para times ágeis. As funcionalidades envolvem criação de sprints, histórias de usuário, atribuição de desenvolvedores e acompanhamento de progresso..."
            rows={4}
            value={baseline.domain_context}
            onChange={(e) => setBaseline((prev) => ({ ...prev, domain_context: e.target.value }))}
          />
        </CardContent>
      </Card>

      {/* Stack tecnológico */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Stack Tecnológico</CardTitle>
          <CardDescription>
            Tecnologias usadas no projeto para contextualizar as integrações (EIF).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {baseline.technology_stack.map((tech, i) => (
              <Badge key={i} variant="secondary" className="gap-1">
                {tech}
                <button onClick={() => removeTech(i)} className="ml-1 hover:text-destructive">
                  <Trash2 className="h-3 w-3" />
                </button>
              </Badge>
            ))}
          </div>
          <div className="flex gap-2">
            <Input
              placeholder="Ex: React, Supabase, Node.js..."
              value={newTech}
              onChange={(e) => setNewTech(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addTech()}
            />
            <Button variant="outline" size="sm" onClick={addTech}>
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Critérios de complexidade */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Critérios de Complexidade</CardTitle>
          <CardDescription>
            Defina o que é baixa, média e alta complexidade no contexto deste projeto.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {(['baixa', 'media', 'alta'] as const).map((level) => (
            <div key={level}>
              <Label className="capitalize text-xs font-medium">
                Complexidade {level}
              </Label>
              <Textarea
                rows={2}
                className="mt-1"
                value={baseline.complexity_rules[level] ?? ''}
                onChange={(e) =>
                  setBaseline((prev) => ({
                    ...prev,
                    complexity_rules: { ...prev.complexity_rules, [level]: e.target.value },
                  }))
                }
              />
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Instruções adicionais */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Instruções Adicionais</CardTitle>
          <CardDescription>
            Regras específicas do seu projeto que o agente deve seguir.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Textarea
            placeholder="Ex: Sempre considere auditoria como ILF separado. Integrações com serviços de pagamento contam como EIF de alta complexidade..."
            rows={3}
            value={baseline.additional_instructions}
            onChange={(e) =>
              setBaseline((prev) => ({ ...prev, additional_instructions: e.target.value }))
            }
          />
        </CardContent>
      </Card>

      <Separator />

      {/* Ações */}
      <div className="flex items-center justify-between">
        <div>
          {saved && (
            <p className="flex items-center gap-1 text-sm text-green-600">
              <CheckCircle className="h-4 w-4" /> Salvo com sucesso!
            </p>
          )}
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => handleSave(false)}
            disabled={saving}
          >
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Salvar Rascunho
          </Button>
          <Button
            onClick={() => handleSave(true)}
            disabled={saving}
          >
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Ativar Baseline
          </Button>
        </div>
      </div>
    </div>
  )
}
