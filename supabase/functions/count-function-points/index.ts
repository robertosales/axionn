import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface FPRequest {
  story_id?: string
  sprint_id?: string
  project_id: string
  story_text: string
  story_context?: {
    acceptance_criteria?: string[]
    story_type?: string
    epic?: string
    priority?: string
  }
}

interface FPBreakdown {
  EI: number  // External Input
  EO: number  // External Output
  EQ: number  // External Inquiry
  ILF: number // Internal Logical File
  EIF: number // External Interface File
  total: number
  complexity: 'baixa' | 'media' | 'alta'
}

interface FPResponse {
  analysis_id: string
  ai_raw_count: number
  ai_breakdown: FPBreakdown
  ai_confidence: number
  ai_reasoning: string
  few_shot_examples_used: number
  model_used: string
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const openaiKey = Deno.env.get('OPENAI_API_KEY')!

    const supabase = createClient(supabaseUrl, supabaseKey)
    const body: FPRequest = await req.json()

    if (!body.project_id || !body.story_text) {
      return new Response(
        JSON.stringify({ error: 'project_id e story_text são obrigatórios' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 1. Busca baseline ativo do projeto
    const { data: baseline } = await supabase
      .from('project_fp_baselines')
      .select('*')
      .eq('project_id', body.project_id)
      .eq('status', 'active')
      .maybeSingle()

    // 2. Busca exemplos validados para few-shot learning
    const { data: examples } = await supabase
      .from('function_point_analyses')
      .select('story_text, story_context, validated_count, ai_breakdown, validation_notes')
      .eq('project_id', body.project_id)
      .eq('is_validated', true)
      .order('validated_at', { ascending: false })
      .limit(10)

    const fewShotCount = examples?.length ?? 0

    // 3. Monta o system prompt com contexto do projeto
    const baselineContext = baseline ? `
## Contexto do Projeto
${baseline.domain_context}

## Stack Tecnológico
${(baseline.technology_stack as string[]).join(', ')}

## Critérios de Complexidade do Projeto
${JSON.stringify(baseline.complexity_rules, null, 2)}

## Critérios por Tipo de Função
${JSON.stringify(baseline.function_type_criteria, null, 2)}

## Instruções Adicionais
${baseline.additional_instructions}
` : '## Contexto\nProjeto de software sem baseline configurado. Use critérios IFPUG padrão.'

    const fewShotExamples = fewShotCount > 0 ? `
## Exemplos Validados deste Projeto (use como referência de calibração)
${(examples ?? []).map((e, i) => `
### Exemplo ${i + 1}
HU: ${e.story_text}
PF Validado: ${e.validated_count}
Breakdown: ${JSON.stringify(e.ai_breakdown)}
${e.validation_notes ? `Notas: ${e.validation_notes}` : ''}
`).join('\n---\n')}
` : ''

    const systemPrompt = `Você é um especialista certificado em Análise de Ponto de Função (APF) pelo método IFPUG.
Sua tarefa é contar os Pontos de Função de uma História de Usuário (HU) com base nos elementos funcionais identificados.

## Método IFPUG — Tipos de Função
- **EI (External Input)**: Processos que entram dados no sistema (formulários, uploads, APIs que recebem dados)
- **EO (External Output)**: Processos que saem dados calculados/processados (relatórios, cálculos, exports)
- **EQ (External Inquiry)**: Consultas simples sem cálculo (listagens, buscas, leituras)
- **ILF (Internal Logical File)**: Grupos de dados mantidos internamente (tabelas, entidades persistidas)
- **EIF (External Interface File)**: Dados de sistemas externos consultados (APIs externas, integrações)

## Complexidade e Peso IFPUG
| Tipo | Baixa | Média | Alta |
|------|-------|-------|------|
| EI   |  3    |  4    |  6   |
| EO   |  4    |  5    |  7   |
| EQ   |  3    |  4    |  6   |
| ILF  |  7    | 10    | 15   |
| EIF  |  5    |  7    | 10   |

${baselineContext}
${fewShotExamples}

## Formato de Resposta
Responda SOMENTE com JSON válido, sem markdown, sem texto fora do JSON:
{
  "EI": <número>,
  "EO": <número>,
  "EQ": <número>,
  "ILF": <número>,
  "EIF": <número>,
  "total": <soma ponderada pelo método IFPUG>,
  "complexity": "baixa" | "media" | "alta",
  "confidence": <0.0 a 1.0>,
  "reasoning": "<explicação detalhada de cada elemento identificado e como calculou>"
}`

    const userPrompt = `## História de Usuário para Análise
${body.story_text}

${body.story_context?.acceptance_criteria ? `## Critérios de Aceite\n${body.story_context.acceptance_criteria.map((c, i) => `${i + 1}. ${c}`).join('\n')}` : ''}
${body.story_context?.story_type ? `## Tipo: ${body.story_context.story_type}` : ''}
${body.story_context?.epic ? `## Épico: ${body.story_context.epic}` : ''}

Faça a contagem de Ponto de Função seguindo o método IFPUG.`

    // 4. Chama OpenAI GPT-4o
    const openaiRes = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.2,
        max_tokens: 1000,
      }),
    })

    if (!openaiRes.ok) {
      const err = await openaiRes.text()
      throw new Error(`OpenAI error: ${err}`)
    }

    const openaiData = await openaiRes.json()
    const parsed = JSON.parse(openaiData.choices[0].message.content)

    const breakdown: FPBreakdown = {
      EI: parsed.EI ?? 0,
      EO: parsed.EO ?? 0,
      EQ: parsed.EQ ?? 0,
      ILF: parsed.ILF ?? 0,
      EIF: parsed.EIF ?? 0,
      total: parsed.total ?? 0,
      complexity: parsed.complexity ?? 'media',
    }

    // 5. Persiste a análise no banco
    const { data: analysis, error: insertError } = await supabase
      .from('function_point_analyses')
      .insert({
        project_id: body.project_id,
        sprint_id: body.sprint_id ?? null,
        story_id: body.story_id ?? null,
        baseline_id: baseline?.id ?? null,
        baseline_version: baseline?.version ?? null,
        story_text: body.story_text,
        story_context: body.story_context ?? {},
        ai_raw_count: breakdown.total,
        ai_breakdown: breakdown,
        ai_confidence: parsed.confidence ?? 0.7,
        ai_reasoning: parsed.reasoning ?? '',
        model_used: 'gpt-4o',
        few_shot_examples_used: fewShotCount,
        is_validated: false,
      })
      .select('id')
      .single()

    if (insertError) throw insertError

    // 6. Se story_id fornecido, atualiza a HU com os PF calculados
    if (body.story_id) {
      await supabase
        .from('user_stories')
        .update({ custom_fields: { fp_count: breakdown.total, fp_analysis_id: analysis.id } })
        .eq('id', body.story_id)
    }

    const response: FPResponse = {
      analysis_id: analysis.id,
      ai_raw_count: breakdown.total,
      ai_breakdown: breakdown,
      ai_confidence: parsed.confidence ?? 0.7,
      ai_reasoning: parsed.reasoning ?? '',
      few_shot_examples_used: fewShotCount,
      model_used: 'gpt-4o',
    }

    return new Response(
      JSON.stringify(response),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Erro na Edge Function:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
