import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Loader2, Brain, CheckCircle, AlertCircle, ChevronDown, ChevronUp } from 'lucide-react'
import { useFunctionPointCounter } from '../hooks/useFunctionPointCounter'
import type { FPCountResponse } from '../types/functionPoint.types'

interface FunctionPointModalProps {
  open: boolean
  onClose: () => void
  onValidated?: (count: number, analysisId: string) => void
  projectId: string
  sprintId?: string
  storyId?: string
  storyTitle?: string
  storyDescription?: string
  acceptanceCriteria?: string[]
  epic?: string
  priority?: string
}

const complexityColor = {
  baixa: 'bg-green-100 text-green-800',
  media: 'bg-yellow-100 text-yellow-800',
  alta: 'bg-red-100 text-red-800',
}

export function FunctionPointModal({
  open,
  onClose,
  onValidated,
  projectId,
  sprintId,
  storyId,
  storyTitle = '',
  storyDescription = '',
  acceptanceCriteria = [],
  epic = '',
  priority = '',
}: FunctionPointModalProps) {
  const { loading, error, countFunctionPoints, validateAnalysis } = useFunctionPointCounter()

  const [result, setResult] = useState<FPCountResponse | null>(null)
  const [validatedCount, setValidatedCount] = useState('')
  const [validationNotes, setValidationNotes] = useState('')
  const [showReasoning, setShowReasoning] = useState(false)
  const [validating, setValidating] = useState(false)
  const [validated, setValidated] = useState(false)

  useEffect(() => {
    if (!open) {
      setResult(null)
      setValidatedCount('')
      setValidationNotes('')
      setShowReasoning(false)
      setValidated(false)
    }
  }, [open])

  const handleCount = async () => {
    const storyText = [storyTitle, storyDescription].filter(Boolean).join('\n\n')
    if (!storyText.trim()) return

    const res = await countFunctionPoints({
      project_id: projectId,
      sprint_id: sprintId,
      story_id: storyId,
      story_text: storyText,
      story_context: {
        acceptance_criteria: acceptanceCriteria,
        epic,
        priority,
      },
    })

    if (res) {
      setResult(res)
      setValidatedCount(String(res.ai_raw_count))
    }
  }

  const handleValidate = async () => {
    if (!result) return
    const count = parseFloat(validatedCount)
    if (isNaN(count) || count < 0) return

    setValidating(true)
    const ok = await validateAnalysis(result.analysis_id, count, validationNotes || undefined)
    setValidating(false)

    if (ok) {
      setValidated(true)
      onValidated?.(count, result.analysis_id)
    }
  }

  const confidencePercent = result ? Math.round(result.ai_confidence * 100) : 0
  const confidenceColor =
    confidencePercent >= 80 ? 'text-green-600' :
    confidencePercent >= 60 ? 'text-yellow-600' : 'text-red-600'

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5 text-primary" />
            Contagem de Ponto de Função
          </DialogTitle>
        </DialogHeader>

        {/* Story preview */}
        {storyTitle && (
          <div className="rounded-md bg-muted/50 p-3 text-sm">
            <p className="font-medium">{storyTitle}</p>
            {storyDescription && (
              <p className="mt-1 text-muted-foreground line-clamp-2">{storyDescription}</p>
            )}
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
            <AlertCircle className="h-4 w-4 flex-shrink-0" />
            {error}
          </div>
        )}

        {/* Result */}
        {result && !validated && (
          <div className="space-y-4">
            {/* Total + confidence */}
            <div className="flex items-center justify-between">
              <div>
                <span className="text-3xl font-bold">{result.ai_raw_count}</span>
                <span className="ml-1 text-muted-foreground">PF</span>
              </div>
              <div className="text-right">
                <p className={`text-sm font-medium ${confidenceColor}`}>
                  {confidencePercent}% confiança
                </p>
                <Badge
                  className={`text-xs ${complexityColor[result.ai_breakdown.complexity]}`}
                  variant="outline"
                >
                  Complexidade {result.ai_breakdown.complexity}
                </Badge>
              </div>
            </div>

            {/* Breakdown */}
            <div className="grid grid-cols-5 gap-2 text-center">
              {(['EI','EO','EQ','ILF','EIF'] as const).map((type) => (
                <div key={type} className="rounded-md border bg-muted/30 p-2">
                  <p className="text-xs text-muted-foreground">{type}</p>
                  <p className="text-lg font-semibold">{result.ai_breakdown[type]}</p>
                </div>
              ))}
            </div>

            {/* Few-shot badge */}
            {result.few_shot_examples_used > 0 && (
              <p className="text-xs text-muted-foreground">
                ✔ Calibrado com {result.few_shot_examples_used} exemplo{result.few_shot_examples_used > 1 ? 's' : ''} validados deste projeto
              </p>
            )}

            {/* Reasoning toggle */}
            <button
              className="flex w-full items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
              onClick={() => setShowReasoning((v) => !v)}
            >
              {showReasoning ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
              Ver justificativa da IA
            </button>
            {showReasoning && (
              <div className="max-h-40 overflow-y-auto rounded-md border bg-muted/20 p-3 text-xs text-muted-foreground">
                {result.ai_reasoning}
              </div>
            )}

            <Separator />

            {/* Validation */}
            <div className="space-y-3">
              <p className="text-sm font-medium">Validar e Salvar</p>
              <div className="flex items-center gap-2">
                <div className="w-28">
                  <Label className="text-xs">PF validado</Label>
                  <Input
                    type="number"
                    min="0"
                    step="0.5"
                    value={validatedCount}
                    onChange={(e) => setValidatedCount(e.target.value)}
                    className="mt-1"
                  />
                </div>
                <div className="flex-1">
                  <Label className="text-xs">Observações (opcional)</Label>
                  <Input
                    placeholder="Ex: ajustado por complexidade de integração"
                    value={validationNotes}
                    onChange={(e) => setValidationNotes(e.target.value)}
                    className="mt-1"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Success state */}
        {validated && (
          <div className="flex flex-col items-center gap-3 py-4 text-center">
            <CheckCircle className="h-12 w-12 text-green-500" />
            <p className="font-medium">Contagem validada e salva!</p>
            <p className="text-sm text-muted-foreground">
              {validatedCount} PF registrado. Este exemplo será usado para calibrar futuras contagens.
            </p>
          </div>
        )}

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose}>
            {validated ? 'Fechar' : 'Cancelar'}
          </Button>

          {!result && !validated && (
            <Button onClick={handleCount} disabled={loading || !storyTitle}>
              {loading ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Calculando...</>
              ) : (
                <><Brain className="mr-2 h-4 w-4" /> Calcular PF</>
              )}
            </Button>
          )}

          {result && !validated && (
            <Button onClick={handleValidate} disabled={validating || !validatedCount}>
              {validating ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Salvando...</>
              ) : (
                <><CheckCircle className="mr-2 h-4 w-4" /> Validar e Salvar</>
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
