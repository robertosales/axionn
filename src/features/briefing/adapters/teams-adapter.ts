// Microsoft Teams adapter implementation
import { MeetingProvider, Meeting, NormalizedMeeting, Participant, Recording, Transcript, HealthStatus, ErrorInfo } from './meeting';
import { createClient } from '@supabase/supabase-js';

export class MicrosoftTeamsAdapter implements MeetingProvider {
  public readonly name = 'teams' as const;
  
  private supabase;
  private integrationId?: string;
  private organizationId?: string;
  private config?: TeamsConfig;

  constructor(
    private options: {
      supabaseUrl: string;
      supabaseKey: string;
      organizationId: string;
      config: TeamsConfig;
    }
  ) {
    this.supabase = createClient(options.supabaseUrl, options.supabaseKey);
    this.organizationId = options.organizationId;
    this.config = options.config;
  }

  async authenticate(): Promise<AuthenticationResult> {
    try {
      const { data, error } = await this.supabase
        .from('teams_integrations')
        .select('id, azure_tenant_id, azure_client_id, azure_client_secret_encrypted, name')
        .eq('organization_id', this.organizationId)
        .eq('is_active', true)
        .single();

      if (error || !data) {
        throw new Error(`Integration not found: ${error?.message || 'Not configured'}`);
      }

      // Validate permissions for transcripts and recordings
      const requiredScopes = await this.validateScopes(data.azure_tenant_id);
      
      this.integrationId = data.id;
      this.config = data;

      return {
        success: true,
        organizationId: this.organizationId!,,
        integrationId: this.integrationId,
        expiresAt: new Date(Date.now() + 3600 * 1000).toISOString(),
        scopes: requiredScopes,
      };
    } catch (error) {
      return {
        success: false,
        organizationId: this.organizationId!,,
        integrationId: undefined,
        expiresAt: '',
        scopes: [],
        error: error instanceof Error ? error.message : 'Authentication failed',
      };
    }
  }

  async listMeetings(): Promise<Meeting[]> {
    if (!this.integrationId) {
      throw new Error('Not authenticated');
    }

    try {
      // Query Microsoft Graph via Supabase Edge Function
      const { data, error } = await this.supabase.functions.invoke('teams-get-meetings', {
        body: {
          integrationId: this.integrationId,
          provider: 'teams',
          daysBack: this.config?.initial_days_back || 30,
          maxResults: this.config?.max_meetings_per_sync || 100,
        },
      });

      if (error) {
        throw new Error(`Failed to list meetings: ${error.message}`);
      }

      const rawMeetings = data?.meetings || [];
      return rawMeetings.map((raw: any) => this.normalize(raw));
    } catch (error) {
      console.error('[TeamsAdapter] listMeetings error:', error);
      throw new Error(
        `Teams listing failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  async getMeetingDetails(meetingId: string): Promise<MeetingDetails> {
    if (!this.integrationId) {
      throw new Error('Not authenticated');
    }

    try {
      const { data, error } = await this.supabase.functions.invoke('teams-get-meeting-details', {
        body: {
          integrationId: this.integrationId,
          meetingId,
        },
      });

      if (error) {
        throw new Error(`Failed to get meeting details: ${error.message}`);
      }

      return data;
    } catch (error) {
      console.error('[TeamsAdapter] getMeetingDetails error:', error);
      throw new Error(
        `Teams meeting details failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  async getParticipants(meetingId: string): Promise<Participant[]> {
    if (!this.integrationId) {
      throw new Error('Not authenticated');
    }

    try {
      const { data, error } = await this.supabase.functions.invoke('teams-get-participants', {
        body: {
          integrationId: this.integrationId,
          meetingId,
        },
      });

      if (error) {
        throw new Error(`Failed to get participants: ${error.message}`);
      }

      return (data?.participants || []).map((p: any) => ({
        id: p.id,
        name: p.displayName,
        email: p.email,
        aadObjectId: p.aadObjectId,
        role: this.mapRole(p.role),
        speakingTime: p.talkingTime || 0,
        speaker: p.isPresenter || false,
      }));
    } catch (error) {
      console.error('[TeamsAdapter] getParticipants error:', error);
      throw new Error(
        `Teams participants failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  async getRecordings(meetingId: string): Promise<Recording[]> {
    if (!this.integrationId) {
      throw new Error('Not authenticated');
    }

    try {
      const { data, error } = await this.supabase.functions.invoke('teams-get-recordings', {
        body: {
          integrationId: this.integrationId,
          meetingId,
        },
      });

      if (error) {
        throw new Error(`Failed to get recordings: ${error.message}`);
      }

      return (data?.recordings || []).map((r: any) => ({
        id: r.id,
        provider: 'teams',
        url: r.url || r.meetingUrl,
        fileName: r.fileName,
        duration: r.duration,
        size: r.size,
        quality: r.quality || 'medium',
        startedAt: r.startedAt,
        endedAt: r.endedAt,
      }));
    } catch (error) {
      console.error('[TeamsAdapter] getRecordings error:', error);
      throw new Error(
        `Teams recordings failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  async getTranscripts(meetingId: string): Promise<Transcript[]> {
    if (!this.integrationId) {
      throw new Error('Not authenticated');
    }

    try {
      const { data, error } = await this.supabase.functions.invoke('teams-get-transcripts', {
        body: {
          integrationId: this.integrationId,
          meetingId,
        },
      });

      if (error) {
        throw new Error(`Failed to get transcripts: ${error.message}`);
      }

      const transcript = data?.transcript;
      if (!transcript) {
        return [];
      }

      return [{
        id: transcript.id,
        provider: 'teams',
        content: transcript.content || '',
        format: transcript.format || 'plain',
        language: transcript.language || 'en',
        speakers: transcript.speakers || [],
        segments: transcript.segments || [],
        startedAt: transcript.startedAt,
        endedAt: transcript.endedAt,
        wordCount: transcript.wordCount,
      }];
    } catch (error) {
      console.error('[TeamsAdapter] getTranscripts error:', error);
      throw new Error(
        `Teams transcripts failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  async healthCheck(): Promise<HealthStatus> {
    const startTime = Date.now();
    
    try {
      if (!this.integrationId) {
        return {
          status: 'unhealthy',
          errorCode: 'INTEGRATION_NOT_AUTHENTICATED',
          errorMessage: 'Teams integration not authenticated',
        };
      }

      // Test connection by fetching recent meetings
      const meetings = await this.listMeetings();
      const latencyMs = Date.now() - startTime;

      return {
        status: 'healthy',
        latencyMs,
        details: {
          meetingsFound: meetings.length,
          integrationId: this.integrationId,
        },
      };
    } catch (error) {
      const latencyMs = Date.now() - startTime;
      console.error('[TeamsAdapter] healthCheck error:', error);
      
      return {
        status: 'unhealthy',
        latencyMs,
        errorCode: 'TEAMS_CONNECTION_FAILED',
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  normalize(rawMeeting: any): Meeting {
    const meetingId = rawMeeting.id || `teams-${Date.now()}`;
    
    const organizer: Participant = {
      id: rawMeeting.organizer?.id || 'unknown',
      name: rawMeeting.organizer?.displayName || rawMeeting.organizer?.name || 'Unknown Organizer',
      email: rawMeeting.organizer?.email,
      aadObjectId: rawMeeting.organizer?.aadObjectId,
      role: 'organizer',
      speakingTime: 0,
      speaker: rawMeeting.organizer?.isPresenter || false,
    };

    const participants: Participant[] = (rawMeeting.participants || []).map((p: any) => ({
      id: p.id,
      name: p.displayName,
      email: p.email,
      aadObjectId: p.aadObjectId,
      role: this.mapRole(p.role),
      speakingTime: p.talkingTime || 0,
      speaker: p.isPresenter || false,
    }));

    const recording: Recording | undefined = rawMeeting.recording ? {
      id: rawMeeting.recording.id,
      provider: 'teams',
      url: rawMeeting.recording.url || rawMeeting.recording.meetingUrl,
      fileName: rawMeeting.recording.fileName,
      duration: rawMeeting.recording.duration,
      size: rawMeeting.recording.size,
      quality: rawMeeting.recording.quality || 'medium',
      startedAt: rawMeeting.recording.startedAt,
      endedAt: rawMeeting.recording.endedAt,
    } : undefined;

    const transcript: Transcript | undefined = rawMeeting.transcript ? {
      id: rawMeeting.transcript.id,
      provider: 'teams',
      content: rawMeeting.transcript.content || '',
      format: rawMeeting.transcript.format || 'plain',
      language: rawMeeting.transcript.language || 'en',
      speakers: rawMeeting.transcript.speakers || [],
      segments: rawMeeting.transcript.segments || [],
      startedAt: rawMeeting.transcript.startedAt,
      endedAt: rawMeeting.transcript.endedAt,
      wordCount: rawMeeting.transcript.wordCount,
    } : undefined;

    return {
      id: meetingId,
      provider: 'teams',
      externalId: rawMeeting.externalId || meetingId,
      title: rawMeeting.title || 'Untitled Meeting',
      description: rawMeeting.description,
      organizer,
      participants,
      startTime: rawMeeting.startTime,
      endTime: rawMeeting.endTime,
      duration: rawMeeting.duration,
      recording,
      transcript,
      hasRecording: !!recording,
      hasTranscript: !!transcript,
      status: this.mapStatus(rawMeeting.status),
      artifacts: rawMeeting.recording || rawMeeting.transcript ? {
        recording,
        transcript,
      } : undefined,
    };
  }

  private async validateScopes(tenantId: string): Promise<string[]> {
    try {
      const { data, error } = await this.supabase
        .from('teams_integrations')
        .select('config_json')
        .eq('azure_tenant_id', tenantId)
        .single();

      if (error || !data) {
        return ['OnlineMeetings.Read'];
      }

      const config = data.config_json || {};
      return config.required_scopes || ['OnlineMeetings.Read', 'OnlineMeetingTranscript.Read.All'];
    } catch (error) {
      console.error('[TeamsAdapter] validateScopes error:', error);
      return ['OnlineMeetings.Read', 'OnlineMeetingTranscript.Read.All'];
    }
  }

  private mapRole(role: string): Participant['role'] {
    const roleMap: Record<string, Participant['role']> = {
      'Presenter': 'presenter',
      'Attendee': 'attendee',
      'Organizer': 'organizer',
      'Consumer': 'attendee',
    };
    return roleMap[role] || 'unknown';
  }

  private mapStatus(status: string): Meeting['status'] {
    const statusMap: Record<string, Meeting['status']> = {
      'discovered': 'discovered',
      'artifacts_pending': 'artifacts_pending',
      'ready': 'ready',
      'importing': 'importing',
      'normalizing': 'normalizing',
      'processing': 'processing',
      'needs_review': 'needs_review',
      'verified': 'verified',
      'applied': 'applied',
      'archived': 'archived',
      'failed': 'failed',
    };
    return statusMap[status] || 'discovered';
  }
}

export interface TeamsConfig {
  azure_tenant_id: string;
  azure_client_id: string;
  azure_client_secret_encrypted: string;
  bot_id?: string;
  bot_password_encrypted?: string;
  bot_endpoint?: string;
  notification_channels?: any;
  default_notification_events?: string[];
  enabled_commands?: string[];
  card_theme?: string;
  include_actions?: boolean;
  is_active?: boolean;
  installed_at?: string;
  last_activity_at?: string;
  config_json?: any;
}
