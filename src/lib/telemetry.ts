import { supabase } from '@/integrations/supabase/client';
import { getCurrentCorrelationContext, CorrelationContext } from './correlation';

export interface UserUsageEvent {
  event_type: string;
  entity_type?: string;
  entity_id?: string;
  project_id?: string;
  source?: 'web' | 'teams' | 'copilot' | 'api' | 'mobile' | 'cli';
  metadata_json?: Record<string, unknown>;
  session_id?: string;
}

export interface IntegrationUsageEvent {
  integration_type: string;
  external_system: string;
  event_type: string;
  status: 'success' | 'error' | 'partial' | 'timeout' | 'retry' | 'dead_letter';
  correlation_id?: string;
  metadata_json?: Record<string, unknown>;
  duration_ms?: number;
  error_code?: string;
  error_message?: string;
  retry_count?: number;
}

let sessionId: string | null = null;

export function getSessionId(): string {
  if (!sessionId) {
    sessionId = crypto.randomUUID();
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('axionn_session_id', sessionId);
    }
  }
  return sessionId;
}

export function initializeSession(): void {
  if (typeof window !== 'undefined') {
    const stored = sessionStorage.getItem('axionn_session_id');
    if (stored) {
      sessionId = stored;
    } else {
      getSessionId();
    }
  }
}

function hashIp(ip: string): string {
  let hash = 0;
  for (let i = 0; i < ip.length; i++) {
    const char = ip.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(16);
}

async function getClientIpHash(): Promise<string | null> {
  try {
    const response = await fetch('https://api.ipify.org?format=json');
    const data = await response.json();
    return hashIp(data.ip);
  } catch {
    return null;
  }
}

let cachedIpHash: string | null = null;

async function getOrFetchIpHash(): Promise<string | null> {
  if (cachedIpHash) return cachedIpHash;
  cachedIpHash = await getClientIpHash();
  return cachedIpHash;
}

export async function logUserUsageEvent(event: UserUsageEvent): Promise<void> {
  try {
    const correlationContext = getCurrentCorrelationContext();
    const ipHash = await getOrFetchIpHash();
    const userAgent = typeof navigator !== 'undefined' ? navigator.userAgent : undefined;

    const { error } = await supabase.rpc('log_user_usage_event', {
      p_event_type: event.event_type,
      p_entity_type: event.entity_type,
      p_entity_id: event.entity_id,
      p_project_id: event.project_id,
      p_source: event.source || 'web',
      p_metadata_json: event.metadata_json || {},
      p_ip_hash: ipHash,
      p_user_agent: userAgent,
      p_session_id: getSessionId(),
      p_correlation_id: correlationContext?.correlationId,
    });

    if (error) {
      console.warn('[Telemetry] Failed to log user usage event:', error);
    }
  } catch (err) {
    console.warn('[Telemetry] Error logging user usage event:', err);
  }
}

export async function logIntegrationUsageEvent(event: IntegrationUsageEvent): Promise<void> {
  try {
    const correlationContext = getCurrentCorrelationContext();

    const { error } = await supabase.rpc('log_integration_usage_event', {
      p_integration_type: event.integration_type,
      p_external_system: event.external_system,
      p_event_type: event.event_type,
      p_status: event.status,
      p_correlation_id: event.correlation_id || correlationContext?.correlationId,
      p_metadata_json: event.metadata_json || {},
      p_duration_ms: event.duration_ms,
      p_error_code: event.error_code,
      p_error_message: event.error_message,
      p_retry_count: event.retry_count || 0,
    });

    if (error) {
      console.warn('[Telemetry] Failed to log integration usage event:', error);
    }
  } catch (err) {
    console.warn('[Telemetry] Error logging integration usage event:', err);
  }
}

export function createTelemetryLogger(defaultMetadata: Record<string, unknown> = {}) {
  return {
    logUserEvent: (event: Omit<UserUsageEvent, 'metadata_json'> & { metadata_json?: Record<string, unknown> }) =>
      logUserUsageEvent({
        ...event,
        metadata_json: { ...defaultMetadata, ...event.metadata_json },
      }),

    logIntegrationEvent: (event: Omit<IntegrationUsageEvent, 'metadata_json'> & { metadata_json?: Record<string, unknown> }) =>
      logIntegrationUsageEvent({
        ...event,
        metadata_json: { ...defaultMetadata, ...event.metadata_json },
      }),
  };
}

export const telemetry = createTelemetryLogger();

export const TelemetryEvents = {
  PAGE_VIEW: 'page_view',
  HU_CREATED: 'hu_created',
  HU_UPDATED: 'hu_updated',
  HU_DELETED: 'hu_deleted',
  HU_STATUS_CHANGED: 'hu_status_changed',
  IMPEDIMENT_CREATED: 'impediment_created',
  IMPEDIMENT_RESOLVED: 'impediment_resolved',
  SPRINT_STARTED: 'sprint_started',
  SPRINT_COMPLETED: 'sprint_completed',
  PLANNING_POKER_VOTE: 'planning_poker_vote',
  AI_HU_GENERATION: 'ai_hu_generation',
  AI_ESTIMATION: 'ai_estimation',
  AI_RISK_ANALYSIS: 'ai_risk_analysis',
  AI_SUMMARY: 'ai_summary',
  REPORT_EXPORTED: 'report_exported',
  DASHBOARD_VIEWED: 'dashboard_viewed',
  SETTINGS_CHANGED: 'settings_changed',
  INTEGRATION_CONFIGURED: 'integration_configured',
  TEAMS_COMMAND: 'teams_command',
  COPILOT_QUERY: 'copilot_query',
} as const;

export const IntegrationEvents = {
  WEBHOOK_RECEIVED: 'webhook_received',
  SYNC_COMPLETED: 'sync_completed',
  SYNC_FAILED: 'sync_failed',
  API_CALL: 'api_call',
  COMMAND_EXECUTED: 'command_executed',
  QUERY_EXECUTED: 'query_executed',
  AUTH_SUCCESS: 'auth_success',
  AUTH_FAILURE: 'auth_failure',
} as const;

export const IntegrationTypes = {
  GITLAB: 'gitlab',
  GITHUB: 'github',
  BITBUCKET: 'bitbucket',
  AZURE_DEVOPS: 'azure_devops',
  TEAMS: 'teams',
  COPILOT: 'copilot',
  SLACK: 'slack',
  DISCORD: 'discord',
  REDMINE: 'redmine',
  JIRA: 'jira',
  AZURE_BOARDS: 'azure_boards',
  KEYCLOAK: 'keycloak',
  AZURE_AD: 'azure_ad',
  OKTA: 'okta',
  ORACLE_DB: 'oracle_db',
  ORACLE_APEX: 'oracle_apex',
  API_GATEWAY: 'api_gateway',
  DATADOG: 'datadog',
  NEWRELIC: 'newrelic',
  SENTRY: 'sentry',
  GRAFANA: 'grafana',
  JENKINS: 'jenkins',
  GITLAB_CI: 'gitlab_ci',
  GITHUB_ACTIONS: 'github_actions',
  CIRCLECI: 'circleci',
  CUSTOM: 'custom',
} as const;