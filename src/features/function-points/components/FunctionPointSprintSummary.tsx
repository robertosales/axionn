import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { TrendingUp, CheckCircle, Clock } from 'lucide-react'
import { useFunctionPointCounter } from '../hooks/useFunctionPointCounter'
import type { FPAnalysis } from '../types/functionPoint.types'

interface FunctionPointSprintSummaryProps {
  sprintId: string
}

export function FunctionPointSprintSummary({ sprintId }: FunctionPointSprintSummaryProps) {
  const { getAnalysesBySprint } = useFunctionPointCounter()
  const [analyses, setAnalyses] = useState<FPAnalysis[]>([])

  useEffect(() => {
    getAnalysesBySprint(sprintId).then(setAnalyses)
  }, [sprintId])

  const validated = analyses.filter((a) => a.is_validated)
  const pending = analyses.filter((a) => !a.is_validated)
  const totalValidated = validated.reduce((sum, a) => sum + (a.validated_count ?? a.ai_raw_count), 0)
  const totalPending = pending.reduce((sum, a) => sum + a.ai_raw_count, 0)

  if (analyses.length === 0) return null

  return (
    <Card className="border-dashed">
      <CardHeader className="pb-2 pt-4">
        <CardTitle className="flex items-center gap-2 text-sm">
          <TrendingUp className="h-4 w-4 text-primary" />
          Pontos de Função da Sprint
        </CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-3 gap-3 pb-4">
        <div className="text-center">
          <p className="text-2xl font-bold text-primary">{totalValidated}</p>
          <p className="flex items-center justify-center gap-1 text-xs text-muted-foreground">
            <CheckCircle className="h-3 w-3 text-green-500" /> Validados
          </p>
        </div>
        <div className="text-center">
          <p className="text-2xl font-bold text-muted-foreground">{totalPending.toFixed(1)}</p>
          <p className="flex items-center justify-center gap-1 text-xs text-muted-foreground">
            <Clock className="h-3 w-3 text-yellow-500" /> Pendentes
          </p>
        </div>
        <div className="text-center">
          <p className="text-2xl font-bold">{(totalValidated + totalPending).toFixed(1)}</p>
          <p className="text-xs text-muted-foreground">Total estimado</p>
        </div>
      </CardContent>
    </Card>
  )
}
