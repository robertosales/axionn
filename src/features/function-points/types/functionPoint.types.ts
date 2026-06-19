export interface FPBreakdown {
  EI: number
  EO: number
  EQ: number
  ILF: number
  EIF: number
  total: number
  complexity: 'baixa' | 'media' | 'alta'
}

export interface FPAnalysis {
  id: string
  project_id: string
  sprint_id?: string
  story_id?: string
  story_text: string
  story_context?: Record<string, unknown>
  ai_raw_count: number
  ai_breakdown: FPBreakdown
  ai_confidence: number
  ai_reasoning: string
  model_used: string
  few_shot_examples_used: number
  validated_count?: number
  validation_notes?: string
  validated_by?: string
  validated_at?: string
  is_validated: boolean
  created_at: string
}

export interface FPCountRequest {
  project_id: string
  sprint_id?: string
  story_id?: string
  story_text: string
  story_context?: {
    acceptance_criteria?: string[]
    story_type?: string
    epic?: string
    priority?: string
  }
}

export interface FPCountResponse {
  analysis_id: string
  ai_raw_count: number
  ai_breakdown: FPBreakdown
  ai_confidence: number
  ai_reasoning: string
  few_shot_examples_used: number
  model_used: string
}
