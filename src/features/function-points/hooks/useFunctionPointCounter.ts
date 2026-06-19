import { useState } from 'react'
import { supabase } from '@/integrations/supabase/client'
import type { FPCountRequest, FPCountResponse, FPAnalysis } from '../types/functionPoint.types'

export function useFunctionPointCounter() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const countFunctionPoints = async (request: FPCountRequest): Promise<FPCountResponse | null> => {
    setLoading(true)
    setError(null)
    try {
      const { data, error: fnError } = await supabase.functions.invoke('count-function-points', {
        body: request,
      })
      if (fnError) throw fnError
      return data as FPCountResponse
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao calcular pontos de função'
      setError(msg)
      return null
    } finally {
      setLoading(false)
    }
  }

  const validateAnalysis = async (
    analysisId: string,
    validatedCount: number,
    notes?: string
  ): Promise<boolean> => {
    setLoading(true)
    setError(null)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      const { error: updateError } = await supabase
        .from('function_point_analyses')
        .update({
          validated_count: validatedCount,
          validation_notes: notes ?? null,
          validated_by: user?.id,
          validated_at: new Date().toISOString(),
          is_validated: true,
        })
        .eq('id', analysisId)
      if (updateError) throw updateError
      return true
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao validar contagem'
      setError(msg)
      return false
    } finally {
      setLoading(false)
    }
  }

  const getAnalysesByStory = async (storyId: string): Promise<FPAnalysis[]> => {
    const { data, error: fetchError } = await supabase
      .from('function_point_analyses')
      .select('*')
      .eq('story_id', storyId)
      .order('created_at', { ascending: false })
    if (fetchError) return []
    return (data ?? []) as FPAnalysis[]
  }

  const getAnalysesBySprint = async (sprintId: string): Promise<FPAnalysis[]> => {
    const { data, error: fetchError } = await supabase
      .from('function_point_analyses')
      .select('*')
      .eq('sprint_id', sprintId)
      .order('created_at', { ascending: false })
    if (fetchError) return []
    return (data ?? []) as FPAnalysis[]
  }

  return {
    loading,
    error,
    countFunctionPoints,
    validateAnalysis,
    getAnalysesByStory,
    getAnalysesBySprint,
  }
}
