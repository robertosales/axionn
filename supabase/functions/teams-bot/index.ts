import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface TeamsActivity {
  type: string;
  id: string;
  timestamp: string;
  serviceUrl: string;
  channelId: string;
  from: {
    id: string;
    name: string;
    aadObjectId?: string;
  };
  conversation: {
    id: string;
    conversationType: string;
    tenantId?: string;
  };
  recipient: {
    id: string;
    name: string;
  };
  text?: string;
  attachments?: any[];
  entities?: any[];
  channelData?: {
    tenant?: { id: string };
    channel?: { id: string; name: string };
    team?: { id: string; name: string };
  };
  value?: any;
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const correlationId = crypto.randomUUID();
  const startTime = Date.now();

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const activity: TeamsActivity = await req.json();
    console.log('[Teams Bot] Activity received:', activity.type, correlationId);

    // Guard against malformed payloads: Teams activities must include type/from/conversation
    if (!activity || typeof activity.type !== 'string') {
      return new Response(JSON.stringify({
        error: 'Malformed activity payload',
        error_code: 'INVALID_ACTIVITY',
        correlation_id: correlationId,
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Handle different activity types
    switch (activity.type) {
      case 'message':
        if (!activity.from || !activity.conversation) {
          console.warn('[Teams Bot] Message activity missing from/conversation', correlationId);
          return new Response(JSON.stringify({
            success: false,
            error_code: 'INVALID_MESSAGE_ACTIVITY',
            correlation_id: correlationId,
          }), {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        await handleMessageActivity(supabase, activity, correlationId);
        break;
      case 'invoke':
        await handleInvokeActivity(supabase, activity, correlationId);
        break;
      case 'conversationUpdate':
        await handleConversationUpdate(supabase, activity, correlationId);
        break;
      case 'event':
        await handleEventActivity(supabase, activity, correlationId);
        break;
      default:
        console.log('[Teams Bot] Unhandled activity type:', activity.type);
    }

    return new Response(JSON.stringify({ success: true, correlation_id: correlationId }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('[Teams Bot] Error:', error);
    return new Response(JSON.stringify({
      error: 'Internal server error',
      correlation_id: correlationId,
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

async function handleMessageActivity(
  supabase: any,
  activity: TeamsActivity,
  correlationId: string
): Promise<void> {
  const startTime = Date.now();
  const text = activity.text?.trim() || '';
  const userId = activity.from.id;
  const userName = activity.from.name;
  const userAadId = activity.from.aadObjectId;
  const conversationId = activity.conversation.id;
  const tenantId = activity.conversation.tenantId;
  const channelId = activity.channelData?.channel?.id;
  const channelName = activity.channelData?.channel?.name;
  const teamId = activity.channelData?.team?.id;
  const teamName = activity.channelData?.team?.name;

  // Find integration by tenant/conversation
  const { data: integration, error: integrationError } = await supabase
    .from('teams_integrations')
    .select('*, teams_channel_mappings(*)')
    .eq('azure_tenant_id', tenantId)
    .eq('is_active', true)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (integrationError) {
    console.error('[Teams Bot] Failed to resolve integration:', integrationError);
    throw integrationError;
  }

  if (!integration) {
    console.log('[Teams Bot] No integration found for tenant:', tenantId);
    await recordTeamsHealth(
      {
        supabase,
        organizationId: '',
        projectId: null,
        integrationId: '',
      },
      {
        status: 'degraded',
        latencyMs: Date.now() - startTime,
        correlationId,
        errorCode: 'INTEGRATION_NOT_CONFIGURED',
        errorMessage: 'Teams integration is not configured for this tenant',
        details: {
          activity_type: activity.type,
          tenant_id: tenantId,
          command: extractCommand(text),
        },
      },
    );
    return;
  }

  const organizationId = integration.organization_id;
  const healthContext = {
    supabase,
    organizationId,
    projectId: integration.project_id ?? null,
    integrationId: integration.id,
  };

  try {
    // Log interaction
    await logInteraction(supabase, {
      integration_id: integration.id,
      organization_id: organizationId,
      teams_user_id: userId,
      teams_user_name: userName,
      teams_user_aad_object_id: userAadId,
      team_id: teamId,
      team_name: teamName,
      channel_id: channelId,
      channel_name: channelName,
      conversation_id: conversationId,
      interaction_type: 'message',
      command_name: extractCommand(text),
      command_args: extractArgs(text),
      correlation_id: correlationId,
    });

    // Handle commands
    if (text.startsWith('/axionn') || text.startsWith('@Axionn')) {
      await handleCommand(supabase, integration, activity, text, correlationId);
    } else if (text.startsWith('/')) {
      // Custom commands
      await handleCustomCommand(supabase, integration, activity, text, correlationId);
    }

    await supabase
      .from('teams_integrations')
      .update({ last_activity_at: new Date().toISOString() })
      .eq('id', integration.id);

    await recordTeamsHealth(healthContext, {
      status: 'healthy',
      latencyMs: Date.now() - startTime,
      correlationId,
      details: {
        activity_type: activity.type,
        command: extractCommand(text),
      },
    });
  } catch (error) {
    await recordTeamsHealth(healthContext, {
      status: 'unhealthy',
      latencyMs: Date.now() - startTime,
      correlationId,
      errorCode: 'MESSAGE_PROCESSING_FAILED',
      errorMessage: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

async function recordTeamsHealth(
  context: {
    supabase: any;
    organizationId: string;
    projectId: string | null;
    integrationId: string;
  },
  event: {
    status: 'healthy' | 'degraded' | 'unhealthy' | 'unknown';
    latencyMs: number;
    correlationId: string;
    errorCode?: string;
    errorMessage?: string;
    details?: Record<string, unknown>;
  },
): Promise<void> {
  const { error } = await context.supabase
    .from('integration_health_events')
    .insert({
      organization_id: context.organizationId,
      project_id: context.projectId,
      provider: 'teams',
      integration_id: context.integrationId,
      check_type: 'webhook',
      status: event.status,
      latency_ms: event.latencyMs,
      error_code: event.errorCode ?? null,
      error_message: event.errorMessage ?? null,
      details: event.details ?? {},
      correlation_id: event.correlationId,
    });

  if (error) {
    // Health telemetry must never interrupt Teams activity processing.
    console.error('[Teams Bot] Failed to record integration health:', error);
  }
}

async function handleCommand(
  supabase: any,
  integration: any,
  activity: TeamsActivity,
  text: string,
  correlationId: string
): Promise<void> {
  const parts = text.split(' ');
  const command = parts[0].replace('/axionn', '').replace('@Axionn', '').trim().toLowerCase();
  const args = parts.slice(1).join(' ');

  let response: any = { type: 'message', text: 'Comando não reconhecido. Use `/axionn ajuda` para ver comandos disponíveis.' };
  let responseType = 'text';

  switch (command) {
    case 'ajuda':
    case 'help':
      response = getHelpCard();
      responseType = 'card';
      break;
    case 'status':
      response = await handleStatusCommand(supabase, integration, args);
      responseType = 'card';
      break;
    case 'hu':
    case 'userstory':
      response = await handleHUCommand(supabase, integration, args);
      responseType = 'card';
      break;
    case 'impedimento':
    case 'impediment':
      response = await handleImpedimentCommand(supabase, integration, args);
      responseType = 'card';
      break;
    case 'risco':
    case 'risk':
      response = await handleRiskCommand(supabase, integration, args);
      responseType = 'card';
      break;
    case 'sprint':
      response = await handleSprintCommand(supabase, integration, args);
      responseType = 'card';
      break;
    case 'dashboard':
      response = await handleDashboardCommand(supabase, integration, args);
      responseType = 'card';
      break;
    case 'minhastarefas':
    case 'mytasks':
      response = await handleMyTasksCommand(supabase, integration, activity.from.aadObjectId);
      responseType = 'card';
      break;
    default:
      response = { type: 'message', text: `Comando desconhecido: ${command}. Use \`/axionn ajuda\` para ver comandos disponíveis.` };
  }

  // Send response
  await sendTeamsResponse(supabase, integration, activity, response, responseType, correlationId);
}

async function handleCustomCommand(
  supabase: any,
  integration: any,
  activity: TeamsActivity,
  text: string,
  correlationId: string
): Promise<void> {
  const commandName = text.split(' ')[0].substring(1).toLowerCase();

  const { data: customCommand } = await supabase
    .from('teams_custom_commands')
    .select('*')
    .eq('integration_id', integration.id)
    .eq('command_name', commandName)
    .eq('is_active', true)
    .single();

  if (!customCommand) {
    await sendTeamsResponse(supabase, integration, activity, {
      type: 'message',
      text: `Comando personalizado não encontrado: ${commandName}`,
    }, 'text', correlationId);
    return;
  }

  // Execute custom command handler
  let response: any;
  if (customCommand.handler_type === 'rpc') {
    const { data, error } = await supabase.rpc(customCommand.handler_config.function, {
      ...customCommand.handler_config.params,
      ...parseCommandArgs(text),
    });
    response = data || { type: 'message', text: error?.message || 'Erro ao executar comando' };
  } else if (customCommand.handler_type === 'webhook') {
    // Call external webhook
    const webhookResponse = await fetch(customCommand.handler_config.url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ activity, args: parseCommandArgs(text) }),
    });
    response = await webhookResponse.json();
  } else {
    response = { type: 'message', text: 'Tipo de handler não suportado' };
  }

  await sendTeamsResponse(supabase, integration, activity, response, 'card', correlationId);
}

async function handleStatusCommand(supabase: any, integration: any, args: string): Promise<any> {
  const huCode = args.trim().toUpperCase();
  if (!huCode) {
    return { type: 'message', text: 'Uso: `/axionn status HU-CODE`' };
  }

  const { data: hu } = await supabase
    .from('user_stories')
    .select('*, v_hu_git_summary(*)')
    .eq('organization_id', integration.organization_id)
    .or(`code.eq.${huCode},external_id.eq.${huCode}`)
    .single();

  if (!hu) {
    return createErrorCard(`HU não encontrada: ${huCode}`);
  }

  return createHUStatusCard(hu);
}

async function handleHUCommand(supabase: any, integration: any, args: string): Promise<any> {
  const parts = args.trim().split(' ');
  const subCommand = parts[0]?.toLowerCase() || 'list';
  const huCode = parts[1]?.toUpperCase();

  switch (subCommand) {
    case 'criar':
    case 'create':
      return createHUCreateCard(integration.organization_id);
    case 'detalhes':
    case 'detail':
      if (!huCode) return { type: 'message', text: 'Uso: `/axionn hu detalhes HU-CODE`' };
      return handleStatusCommand(supabase, integration, huCode);
    case 'list':
    default: {
      const { data: hus } = await supabase
        .from('user_stories')
        .select('code, title, status, story_points, assignee:profiles(display_name)')
        .eq('organization_id', integration.organization_id)
        .in('status', ['todo', 'in_progress', 'in_review'])
        .order('updated_at', { ascending: false })
        .limit(10);
      return createHUListCard(hus || []);
    }
  }
}

async function handleImpedimentCommand(supabase: any, integration: any, args: string): Promise<any> {
  const parts = args.trim().split(' ');
  const subCommand = parts[0]?.toLowerCase() || 'list';

  switch (subCommand) {
    case 'criar':
    case 'create':
      return createImpedimentCreateCard(integration.organization_id);
    case 'list':
    default: {
      const { data: impediments } = await supabase
        .from('impediments')
        .select('id, title, severity, status, hu:user_stories(code, title), assignee:profiles(display_name)')
        .eq('organization_id', integration.organization_id)
        .in('status', ['open', 'in_progress'])
        .order('created_at', { ascending: false })
        .limit(10);
      return createImpedimentListCard(impediments || []);
    }
  }
}

async function handleRiskCommand(supabase: any, integration: any, args: string): Promise<any> {
  const { data: risks } = await supabase
    .from('sprint_risk_events')
    .select('*, hu:user_stories(code, title), sprint:sprints(name)')
    .eq('organization_id', integration.organization_id)
    .in('risk_level', ['high', 'critical'])
    .eq('status', 'active')
    .order('predicted_at', { ascending: false })
    .limit(10);

  return createRiskAlertCard(risks || []);
}

async function handleSprintCommand(supabase: any, integration: any, args: string): Promise<any> {
  const { data: sprints } = await supabase
    .from('sprints')
    .select('id, name, start_date, end_date, status, goal, project:projects(name)')
    .eq('organization_id', integration.organization_id)
    .in('status', ['planning', 'active'])
    .order('start_date', { ascending: true })
    .limit(5);

  return createSprintCard(sprints || []);
}

async function handleDashboardCommand(supabase: any, integration: any, args: string): Promise<any> {
  // Get key metrics
  const [{ count: huCount }, { count: impedimentCount }, { count: riskCount }] = await Promise.all([
    supabase.from('user_stories').select('*', { count: 'exact', head: true }).eq('organization_id', integration.organization_id),
    supabase.from('impediments').select('*', { count: 'exact', head: true }).eq('organization_id', integration.organization_id).in('status', ['open', 'in_progress']),
    supabase.from('sprint_risk_events').select('*', { count: 'exact', head: true }).eq('organization_id', integration.organization_id).in('risk_level', ['high', 'critical']).eq('status', 'active'),
  ]);

  return createDashboardCard({
    huCount: huCount || 0,
    impedimentCount: impedimentCount || 0,
    riskCount: riskCount || 0,
  });
}

async function handleMyTasksCommand(supabase: any, integration: any, aadObjectId: string): Promise<any> {
  if (!aadObjectId) {
    return { type: 'message', text: 'Não foi possível identificar seu usuário. Tente novamente.' };
  }

  // Map AAD ID to Axionn user
  const { data: mapping } = await supabase
    .from('teams_user_mappings')
    .select('axionn_user_id')
    .eq('integration_id', integration.id)
    .eq('teams_user_aad_id', aadObjectId)
    .single();

  if (!mapping) {
    return { type: 'message', text: 'Usuário não vinculado. Peça ao admin para configurar o mapeamento.' };
  }

  const { data: tasks } = await supabase
    .from('user_stories')
    .select('code, title, status, story_points, sprint:sprints(name)')
    .eq('organization_id', integration.organization_id)
    .eq('assignee_id', mapping.axionn_user_id)
    .in('status', ['todo', 'in_progress', 'in_review'])
    .order('updated_at', { ascending: false })
    .limit(10);

  return createMyTasksCard(tasks || []);
}

async function handleConversationUpdate(
  supabase: any,
  activity: TeamsActivity,
  correlationId: string
): Promise<void> {
  // Handle members added/removed
  if (activity.membersAdded && activity.membersAdded.length > 0) {
    for (const member of activity.membersAdded) {
      if (member.id === activity.recipient.id) {
        // Bot was added to conversation
        await sendWelcomeMessage(supabase, activity);
      }
    }
  }
}

async function handleEventActivity(
  supabase: any,
  activity: TeamsActivity,
  correlationId: string
): Promise<void> {
  // Handle typing, etc.
}

async function handleInvokeActivity(
  supabase: any,
  activity: TeamsActivity,
  correlationId: string
): Promise<void> {
  // Handle task module invoke, etc.
}

async function sendWelcomeMessage(supabase: any, activity: TeamsActivity): Promise<void> {
  const welcomeCard = {
    type: 'AdaptiveCard',
    $schema: 'http://adaptivecards.io/schemas/adaptive-card.json',
    version: '1.5',
    body: [
      { type: 'TextBlock', text: '👋 Olá! Sou o **Axionn Bot**', weight: 'Bolder', size: 'Medium' },
      { type: 'TextBlock', text: 'Posso te ajudar com:', wrap: true },
      { type: 'FactSet', facts: [
        { title: '📋 HUs', value: '`/axionn hu list` - listar HUs ativas' },
        { title: '🚫 Impedimentos', value: '`/axionn impedimento list` - ver impedimentos' },
        { title: '⚠️ Riscos', value: '`/axionn risco` - alertas de risco de sprint' },
        { title: '📊 Dashboard', value: '`/axionn dashboard` - visão geral do projeto' },
        { title: '🔍 Status', value: '`/axionn status HU-123` - detalhes da HU' },
      ]},
      { type: 'ActionSet', actions: [
        { type: 'Action.Submit', title: 'Ver Ajuda Completa', data: { action: 'help' } },
      ]}
    ],
  };

  await sendDirectMessage(supabase, activity.serviceUrl, activity.conversation.id, welcomeCard);
}

async function sendTeamsResponse(
  supabase: any,
  integration: any,
  activity: TeamsActivity,
  response: any,
  responseType: string,
  correlationId: string
): Promise<void> {
  const serviceUrl = activity.serviceUrl;
  const conversationId = activity.conversation.id;

  try {
    let sentAt: string | null = null;
    let status = 'sent';

    if (responseType === 'card') {
      await sendAdaptiveCard(supabase, integration, serviceUrl, conversationId, response);
      sentAt = new Date().toISOString();
    } else {
      await sendDirectMessage(supabase, serviceUrl, conversationId, response.text);
      sentAt = new Date().toISOString();
    }

    // Log notification sent
    await supabase.rpc('log_teams_notification', {
      p_integration_id: integration.id,
      p_organization_id: integration.organization_id,
      p_team_id: activity.channelData?.team?.id,
      p_channel_id: activity.channelData?.channel?.id,
      p_event_type: 'command_response',
      p_event_source: 'teams_bot',
      p_event_payload: { command: extractCommand(activity.text || ''), response_type: responseType },
      p_card_type: responseType,
      p_card_content: responseType === 'card' ? response : null,
      p_message_text: responseType === 'text' ? response.text : null,
      p_status: status,
      p_sent_at: sentAt,
      p_correlation_id: correlationId,
    });
  } catch (error) {
    console.error('[Teams Bot] Error sending response:', error);
    await supabase.rpc('log_teams_notification', {
      p_integration_id: integration.id,
      p_organization_id: integration.organization_id,
      p_event_type: 'command_response',
      p_status: 'failed',
      p_failure_reason: error.message,
      p_correlation_id: correlationId,
    });
  }
}

async function sendAdaptiveCard(
  supabase: any,
  integration: any,
  serviceUrl: string,
  conversationId: string,
  card: any
): Promise<void> {
  const token = await getBotToken(supabase, integration);
  if (!token) throw new Error('Failed to get bot token');

  const response = await fetch(`${serviceUrl}v3/conversations/${conversationId}/activities`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      type: 'message',
      attachmentLayout: 'list',
      attachments: [{
        contentType: 'application/vnd.microsoft.card.adaptive',
        content: card,
      }],
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to send card: ${error}`);
  }
}

async function sendDirectMessage(
  supabase: any,
  serviceUrl: string,
  conversationId: string,
  text: string
): Promise<void> {
  // Similar to sendAdaptiveCard but with text message
}

async function getBotToken(supabase: any, integration: any): Promise<string | null> {
  // Get token from integration config or cache
  // This would use the bot's app ID and secret to get a token from Microsoft
  return integration.bot_token || null;
}

async function logInteraction(
  supabase: any,
  params: any
): Promise<void> {
  await supabase.rpc('log_teams_interaction', params);
}

// Helper functions for creating Adaptive Cards
function getHelpCard(): any {
  return {
    type: 'AdaptiveCard',
    $schema: 'http://adaptivecards.io/schemas/adaptive-card.json',
    version: '1.5',
    body: [
      { type: 'TextBlock', text: '🤖 Axionn Bot - Comandos Disponíveis', weight: 'Bolder', size: 'Medium' },
      { type: 'FactSet', facts: [
        { title: '/axionn ajuda', value: 'Mostra esta ajuda' },
        { title: '/axionn status HU-123', value: 'Status detalhado da HU' },
        { title: '/axionn hu list', value: 'Lista HUs ativas' },
        { title: '/axionn hu detalhes HU-123', value: 'Detalhes da HU' },
        { title: '/axionn impedimento list', value: 'Lista impedimentos abertos' },
        { title: '/axionn impedimento criar', value: 'Cria novo impedimento' },
        { title: '/axionn risco', value: 'Alertas de risco de sprint' },
        { title: '/axionn sprint', value: 'Info da sprint atual' },
        { title: '/axionn dashboard', value: 'Dashboard executivo' },
        { title: '/axionn minhastarefas', value: 'Minhas tarefas atribuídas' },
      ]},
    ],
  };
}

function createHUStatusCard(hu: any): any {
  const gitSummary = hu.v_hu_git_summary?.[0] || {};
  return {
    type: 'AdaptiveCard',
    $schema: 'http://adaptivecards.io/schemas/adaptive-card.json',
    version: '1.5',
    body: [
      { type: 'TextBlock', text: `📋 ${hu.code}: ${hu.title}`, weight: 'Bolder', size: 'Medium', wrap: true },
      { type: 'FactSet', facts: [
        { title: 'Status', value: hu.status },
        { title: 'Pontos', value: hu.story_points || 'Não estimado' },
        { title: 'Responsável', value: hu.assignee?.display_name || 'Não atribuído' },
        { title: 'Sprint', value: hu.sprint?.name || 'Backlog' },
        { title: 'MRs', value: gitSummary.mr_count || 0 },
        { title: 'Commits', value: gitSummary.commit_count || 0 },
        { title: 'Deployments', value: gitSummary.deployment_count || 0 },
        { title: 'Último Deploy', value: gitSummary.latest_production_deployment?.deployed_at ? new Date(gitSummary.latest_production_deployment.deployed_at).toLocaleString('pt-BR') : 'Nenhum' },
      ]},
    ],
    actions: [
      { type: 'Action.OpenUrl', title: 'Ver no Axionn', url: `https://axionn.app/hu/${hu.id}` },
    ],
  };
}

function createHUListCard(hus: any[]): any {
  return {
    type: 'AdaptiveCard',
    $schema: 'http://adaptivecards.io/schemas/adaptive-card.json',
    version: '1.5',
    body: [
      { type: 'TextBlock', text: '📋 HUs Ativas', weight: 'Bolder', size: 'Medium' },
      { type: 'ColumnSet', columns: hus.map(hu => ({
        type: 'Column',
        width: 'stretch',
        items: [
          { type: 'TextBlock', text: hu.code, weight: 'Bolder', size: 'Small' },
          { type: 'TextBlock', text: hu.title, size: 'Small', wrap: true, maxLines: 2 },
          { type: 'FactSet', facts: [
            { title: 'Status', value: hu.status },
            { title: 'Pts', value: hu.story_points || '-' },
            { title: 'Resp.', value: hu.assignee?.display_name || '-' },
          ]},
        ],
      }))},
    ],
  };
}

function createImpedimentListCard(impediments: any[]): any {
  return {
    type: 'AdaptiveCard',
    $schema: 'http://adaptivecards.io/schemas/adaptive-card.json',
    version: '1.5',
    body: [
      { type: 'TextBlock', text: '🚫 Impedimentos Abertos', weight: 'Bolder', size: 'Medium' },
      ...impediments.map(imp => ({
        type: 'Container',
        style: 'emphasis',
        items: [
          { type: 'TextBlock', text: `⚠️ ${imp.title}`, weight: 'Bolder', wrap: true },
          { type: 'FactSet', facts: [
            { title: 'Severidade', value: imp.severity },
            { title: 'Status', value: imp.status },
            { title: 'HU', value: imp.hu?.code || 'N/A' },
            { title: 'Responsável', value: imp.assignee?.display_name || 'Não atribuído' },
          ]},
        ],
      })),
    ],
  };
}

function createRiskAlertCard(risks: any[]): any {
  return {
    type: 'AdaptiveCard',
    $schema: 'http://adaptivecards.io/schemas/adaptive-card.json',
    version: '1.5',
    body: [
      { type: 'TextBlock', text: '⚠️ Alertas de Risco de Sprint', weight: 'Bolder', size: 'Medium', color: 'Attention' },
      ...risks.map(risk => ({
        type: 'Container',
        style: risk.risk_level === 'critical' ? 'emphasis' : 'default',
        items: [
          { type: 'TextBlock', text: `${risk.hu?.code || 'Sprint'}: ${risk.justification}`, weight: 'Bolder', wrap: true, color: risk.risk_level === 'critical' ? 'Attention' : 'Default' },
          { type: 'FactSet', facts: [
            { title: 'Nível', value: risk.risk_level.toUpperCase() },
            { title: 'Score', value: `${risk.risk_score}/100` },
            { title: 'Prob. Atraso', value: `${risk.delay_probability || 0}%` },
            { title: 'Fatores', value: (risk.key_factors || []).map((f: any) => f.factor).join(', ') },
          ]},
        ],
      })),
    ],
  };
}

function createSprintCard(sprints: any[]): any {
  return {
    type: 'AdaptiveCard',
    $schema: 'http://adaptivecards.io/schemas/adaptive-card.json',
    version: '1.5',
    body: [
      { type: 'TextBlock', text: '🏃 Sprints Ativas/Planejadas', weight: 'Bolder', size: 'Medium' },
      ...sprints.map(sprint => ({
        type: 'Container',
        items: [
          { type: 'TextBlock', text: sprint.name, weight: 'Bolder' },
          { type: 'FactSet', facts: [
            { title: 'Projeto', value: sprint.project?.name },
            { title: 'Início', value: new Date(sprint.start_date).toLocaleDateString('pt-BR') },
            { title: 'Fim', value: new Date(sprint.end_date).toLocaleDateString('pt-BR') },
            { title: 'Status', value: sprint.status },
            { title: 'Objetivo', value: sprint.goal || 'Não definido' },
          ]},
        ],
      })),
    ],
  };
}

function createDashboardCard(metrics: any): any {
  return {
    type: 'AdaptiveCard',
    $schema: 'http://adaptivecards.io/schemas/adaptive-card.json',
    version: '1.5',
    body: [
      { type: 'TextBlock', text: '📊 Dashboard Axionn', weight: 'Bolder', size: 'Medium' },
      { type: 'ColumnSet', columns: [
        { type: 'Column', width: 'stretch', items: [{ type: 'TextBlock', text: '📋 HUs Totais', size: 'Small' }, { type: 'TextBlock', text: metrics.huCount.toString(), weight: 'Bolder', size: 'Large' }]},
        { type: 'Column', width: 'stretch', items: [{ type: 'TextBlock', text: '🚫 Impedimentos', size: 'Small' }, { type: 'TextBlock', text: metrics.impedimentCount.toString(), weight: 'Bolder', size: 'Large', color: metrics.impedimentCount > 0 ? 'Attention' : 'Good' }]},
        { type: 'Column', width: 'stretch', items: [{ type: 'TextBlock', text: '⚠️ Riscos Críticos', size: 'Small' }, { type: 'TextBlock', text: metrics.riskCount.toString(), weight: 'Bolder', size: 'Large', color: metrics.riskCount > 0 ? 'Attention' : 'Good' }]},
      ]},
    ],
  };
}

function createMyTasksCard(tasks: any[]): any {
  return {
    type: 'AdaptiveCard',
    $schema: 'http://adaptivecards.io/schemas/adaptive-card.json',
    version: '1.5',
    body: [
      { type: 'TextBlock', text: '📝 Minhas Tarefas', weight: 'Bolder', size: 'Medium' },
      ...tasks.map(task => ({
        type: 'Container',
        items: [
          { type: 'TextBlock', text: `${task.code}: ${task.title}`, weight: 'Bolder', wrap: true },
          { type: 'FactSet', facts: [
            { title: 'Status', value: task.status },
            { title: 'Pts', value: task.story_points || '-' },
            { title: 'Sprint', value: task.sprint?.name || 'Backlog' },
          ]},
        ],
      })),
    ],
  };
}

function createHUCreateCard(organizationId: string): any {
  return {
    type: 'AdaptiveCard',
    $schema: 'http://adaptivecards.io/schemas/adaptive-card.json',
    version: '1.5',
    body: [
      { type: 'TextBlock', text: '➕ Criar Nova HU', weight: 'Bolder', size: 'Medium' },
      { type: 'Input.Text', id: 'title', label: 'Título', placeholder: 'Como um usuário, eu quero...', isRequired: true },
      { type: 'Input.Text', id: 'description', label: 'Descrição', isMultiline: true },
      { type: 'Input.ChoiceSet', id: 'project_id', label: 'Projeto', choices: [], style: 'compact' }, // Would need to fetch projects
    ],
    actions: [
      { type: 'Action.Submit', title: 'Criar', data: { action: 'create_hu' } },
    ],
  };
}

function createImpedimentCreateCard(organizationId: string): any {
  return {
    type: 'AdaptiveCard',
    $schema: 'http://adaptivecards.io/schemas/adaptive-card.json',
    version: '1.5',
    body: [
      { type: 'TextBlock', text: '🚫 Criar Impedimento', weight: 'Bolder', size: 'Medium' },
      { type: 'Input.Text', id: 'title', label: 'Título', isRequired: true },
      { type: 'Input.Text', id: 'description', label: 'Descrição', isMultiline: true },
      { type: 'Input.ChoiceSet', id: 'severity', label: 'Severidade', choices: [
        { title: 'Baixa', value: 'low' },
        { title: 'Média', value: 'medium' },
        { title: 'Alta', value: 'high' },
        { title: 'Crítica', value: 'critical' },
      ], style: 'compact', value: 'medium' },
    ],
    actions: [
      { type: 'Action.Submit', title: 'Criar', data: { action: 'create_impediment' } },
    ],
  };
}

function createErrorCard(message: string): any {
  return {
    type: 'AdaptiveCard',
    $schema: 'http://adaptivecards.io/schemas/adaptive-card.json',
    version: '1.5',
    body: [
      { type: 'TextBlock', text: `❌ ${message}`, color: 'Attention', wrap: true },
    ],
  };
}

function extractCommand(text: string): string {
  const match = text.match(/^\/(\w+)/);
  return match ? match[1] : 'message';
}

function extractArgs(text: string): string {
  const parts = text.trim().split(' ');
  return parts.slice(1).join(' ');
}

function parseCommandArgs(text: string): Record<string, string> {
  const args = text.split(' ').slice(1);
  const result: Record<string, string> = {};
  args.forEach((arg, i) => {
    result[`arg${i}`] = arg;
  });
  return result;
}
