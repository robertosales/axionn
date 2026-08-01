// Meeting adapter type definitions
export interface MeetingProvider {
  name: 'teams' | 'meet' | 'manual';
  authenticate(): Promise<AuthenticationResult>;
  listMeetings(): Promise<Meeting[]>;
  getMeetingDetails(meetingId: string): Promise<MeetingDetails>;
  getParticipants(meetingId: string): Promise<Participant[]>;
  getRecordings(meetingId: string): Promise<Recording[]>;
  getTranscripts(meetingId: string): Promise<Transcript[]>;
  healthCheck(): Promise<HealthStatus>;
  normalize(meetingData: any): NormalizedMeeting;
}

export interface AuthenticationResult {
  success: boolean;
  organizationId: string;
  integrationId: string;
  expiresAt: string;
  scopes: string[];
  error?: string;
}

export interface Meeting {
  id: string;
  provider: 'teams' | 'meet';
  externalId: string;
  title: string;
  description?: string;
  organizer: Participant;
  participants: Participant[];
  startTime: string;
  endTime?: string;
  duration?: number;
  recording?: Recording;
  transcript?: Transcript;
  hasRecording: boolean;
  hasTranscript: boolean;
  status: MeetingStatus;
  artifacts?: MeetingArtifacts;
}

export interface Participant {
  id: string;
  name: string;
  email?: string;
  aadObjectId?: string;
  role: 'presenter' | 'attendee' | 'organizer' | 'unknown';
  speakingTime?: number;
  speaker?: boolean;
}

export interface Recording {
  id: string;
  provider: 'teams' | 'meet';
  url: string;
  fileName?: string;
  duration?: number;
  size?: number;
  quality?: 'high' | 'medium' | 'low';
  startedAt?: string;
  endedAt?: string;
}

export interface Transcript {
  id: string;
  provider: 'teams' | 'meet';
  content: string;
  format: 'plain' | 'structured';
  language: string;
  speakers: SpeakerInfo[];
  segments: TranscriptSegment[];
  startedAt?: string;
  endedAt?: string;
  wordCount?: number;
}

export interface SpeakerInfo {
  id: string;
  name: string;
  email?: string;
  aadObjectId?: string;
  speakingTime: number;
}

export interface TranscriptSegment {
  id: string;
  speakerId: string;
  speakerName: string;
  text: string;
  startTime: number;
  endTime: number;
  speakerConfidence?: number;
}

export interface MeetingArtifacts {
  recording: Recording;
  transcript: Transcript;
  chat?: ChatData;
  attachments?: Attachment[];
}

export interface ChatData {
  messages: ChatMessage[];
}

export interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  text: string;
  timestamp: string;
  messageType: 'text' | 'reaction' | 'file';
}

export interface Attachment {
  id: string;
  name: string;
  url: string;
  size: number;
  type: string;
  uploadedAt?: string;
}

export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy' | 'unknown';
  latencyMs?: number;
  errorCode?: string;
  errorMessage?: string;
  details?: Record<string, unknown>;
}

export interface NormalizedMeeting {
  externalMeetingId: string;
  provider: 'teams' | 'meet';
  title: string;
  description?: string;
  organizer: NormalizedParticipant;
  participants: NormalizedParticipant[];
  startTime: string;
  endTime?: string;
  duration?: number;
  hasRecording: boolean;
  hasTranscript: boolean;
  artifacts?: NormalizedArtifacts;
}

export interface NormalizedParticipant {
  externalId: string;
  name: string;
  email?: string;
  aadObjectId?: string;
  role: 'presenter' | 'attendee' | 'organizer' | 'unknown';
  speakingTime?: number;
  speaker?: boolean;
}

export interface NormalizedArtifacts {
  transcript?: {
    url?: string;
    content?: string;
    format: 'plain' | 'structured';
    language: string;
    speakers: NormalizedSpeaker[];
    segments: NormalizedTranscriptSegment[];
  };
  recording?: {
    url: string;
    fileName?: string;
    duration?: number;
    size?: number;
    quality?: 'high' | 'medium' | 'low';
  };
}

export interface NormalizedSpeaker {
  externalId: string;
  name: string;
  email?: string;
  aadObjectId?: string;
  speakingTime: number;
}

export interface NormalizedTranscriptSegment {
  speakerExternalId: string;
  speakerName: string;
  text: string;
  startTime: number;
  endTime: number;
  speakerConfidence?: number;
}

export type MeetingStatus = 
  | 'discovered'
  | 'artifacts_pending'
  | 'ready'
  | 'importing'
  | 'normalizing'
  | 'processing'
  | 'needs_review'
  | 'verified'
  | 'applied'
  | 'archived'
  | 'failed'
  | 'error';

export interface ErrorInfo {
  code: string;
  message: string;
  recoverable: boolean;
  details?: Record<string, unknown>;
}
