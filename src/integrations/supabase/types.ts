export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      _backup_demanda_hours_p5: {
        Row: {
          backup_at: string | null
          created_at: string | null
          demanda_id: string | null
          descricao: string | null
          fase: string | null
          horas_original: number | null
          id: string | null
          user_id: string | null
        }
        Insert: {
          backup_at?: string | null
          created_at?: string | null
          demanda_id?: string | null
          descricao?: string | null
          fase?: string | null
          horas_original?: number | null
          id?: string | null
          user_id?: string | null
        }
        Update: {
          backup_at?: string | null
          created_at?: string | null
          demanda_id?: string | null
          descricao?: string | null
          fase?: string | null
          horas_original?: number | null
          id?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      activities: {
        Row: {
          activity_type: string
          assignee_id: string | null
          closed_at: string | null
          created_at: string
          description: string | null
          end_date: string
          hours: number
          hu_id: string
          id: string
          is_closed: boolean
          start_date: string
          team_id: string
          title: string
        }
        Insert: {
          activity_type?: string
          assignee_id?: string | null
          closed_at?: string | null
          created_at?: string
          description?: string | null
          end_date: string
          hours?: number
          hu_id: string
          id?: string
          is_closed?: boolean
          start_date: string
          team_id: string
          title: string
        }
        Update: {
          activity_type?: string
          assignee_id?: string | null
          closed_at?: string | null
          created_at?: string
          description?: string | null
          end_date?: string
          hours?: number
          hu_id?: string
          id?: string
          is_closed?: boolean
          start_date?: string
          team_id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "activities_assignee_id_fkey"
            columns: ["assignee_id"]
            isOneToOne: false
            referencedRelation: "developers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activities_hu_id_fkey"
            columns: ["hu_id"]
            isOneToOne: false
            referencedRelation: "user_stories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activities_hu_id_fkey"
            columns: ["hu_id"]
            isOneToOne: false
            referencedRelation: "v_hu_git_summary"
            referencedColumns: ["hu_id"]
          },
          {
            foreignKeyName: "activities_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      activity_comments: {
        Row: {
          activity_id: string
          content: string
          created_at: string
          id: string
          team_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          activity_id: string
          content: string
          created_at?: string
          id?: string
          team_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          activity_id?: string
          content?: string
          created_at?: string
          id?: string
          team_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "activity_comments_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "activities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_comments_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_briefing_retention_config: {
        Row: {
          allow_permanent_delete: boolean
          auto_anonymize: boolean
          auto_archive: boolean
          created_by: string | null
          default_retention_days: number
          id: string
          org_id: string
          updated_at: string
        }
        Insert: {
          allow_permanent_delete?: boolean
          auto_anonymize?: boolean
          auto_archive?: boolean
          created_by?: string | null
          default_retention_days?: number
          id?: string
          org_id: string
          updated_at?: string
        }
        Update: {
          allow_permanent_delete?: boolean
          auto_anonymize?: boolean
          auto_archive?: boolean
          created_by?: string | null
          default_retention_days?: number
          id?: string
          org_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_briefing_retention_config_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_briefing_runs: {
        Row: {
          briefing_id: string
          completed_at: string | null
          created_at: string
          duration_ms: number | null
          error_code: string | null
          error_detail: string | null
          estimated_cost: number | null
          id: string
          input_tokens: number | null
          model_name: string | null
          output_payload: Json | null
          output_tokens: number | null
          prompt_version: string
          provider_id: string | null
          request_id: string
          schema_version: string
          status: string
        }
        Insert: {
          briefing_id: string
          completed_at?: string | null
          created_at?: string
          duration_ms?: number | null
          error_code?: string | null
          error_detail?: string | null
          estimated_cost?: number | null
          id?: string
          input_tokens?: number | null
          model_name?: string | null
          output_payload?: Json | null
          output_tokens?: number | null
          prompt_version: string
          provider_id?: string | null
          request_id: string
          schema_version: string
          status?: string
        }
        Update: {
          briefing_id?: string
          completed_at?: string | null
          created_at?: string
          duration_ms?: number | null
          error_code?: string | null
          error_detail?: string | null
          estimated_cost?: number | null
          id?: string
          input_tokens?: number | null
          model_name?: string | null
          output_payload?: Json | null
          output_tokens?: number | null
          prompt_version?: string
          provider_id?: string | null
          request_id?: string
          schema_version?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_briefing_runs_briefing_id_fkey"
            columns: ["briefing_id"]
            isOneToOne: false
            referencedRelation: "ai_briefings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_briefing_runs_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "ai_providers"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_briefing_suggestions: {
        Row: {
          briefing_id: string
          confirmed_assignee_id: string | null
          created_at: string
          date_source: string
          description: string
          id: string
          ordinal: number
          original_payload: Json
          priority_hint: string | null
          review_status: string
          reviewed_at: string | null
          reviewed_by: string | null
          reviewed_payload: Json | null
          run_id: string
          suggested_assignee_id: string | null
          suggested_assignee_name: string | null
          suggested_due_date: string | null
          suggestion_type: string
          title: string
          updated_at: string
        }
        Insert: {
          briefing_id: string
          confirmed_assignee_id?: string | null
          created_at?: string
          date_source?: string
          description?: string
          id?: string
          ordinal: number
          original_payload?: Json
          priority_hint?: string | null
          review_status?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          reviewed_payload?: Json | null
          run_id: string
          suggested_assignee_id?: string | null
          suggested_assignee_name?: string | null
          suggested_due_date?: string | null
          suggestion_type: string
          title: string
          updated_at?: string
        }
        Update: {
          briefing_id?: string
          confirmed_assignee_id?: string | null
          created_at?: string
          date_source?: string
          description?: string
          id?: string
          ordinal?: number
          original_payload?: Json
          priority_hint?: string | null
          review_status?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          reviewed_payload?: Json | null
          run_id?: string
          suggested_assignee_id?: string | null
          suggested_assignee_name?: string | null
          suggested_due_date?: string | null
          suggestion_type?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_briefing_suggestions_briefing_id_fkey"
            columns: ["briefing_id"]
            isOneToOne: false
            referencedRelation: "ai_briefings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_briefing_suggestions_confirmed_assignee_id_fkey"
            columns: ["confirmed_assignee_id"]
            isOneToOne: false
            referencedRelation: "developers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_briefing_suggestions_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "ai_briefing_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_briefings: {
        Row: {
          anonymized_at: string | null
          archived_at: string | null
          briefing_type: string
          created_at: string
          created_by: string
          deleted_at: string | null
          id: string
          language: string | null
          meeting_date: string | null
          org_id: string
          participants: Json
          project_id: string | null
          retention_days: number | null
          retention_until: string | null
          source_content: string
          source_hash: string
          source_type: string
          sprint_id: string | null
          status: string
          team_id: string | null
          title: string
          updated_at: string
        }
        Insert: {
          anonymized_at?: string | null
          archived_at?: string | null
          briefing_type: string
          created_at?: string
          created_by: string
          deleted_at?: string | null
          id?: string
          language?: string | null
          meeting_date?: string | null
          org_id: string
          participants?: Json
          project_id?: string | null
          retention_days?: number | null
          retention_until?: string | null
          source_content: string
          source_hash: string
          source_type?: string
          sprint_id?: string | null
          status?: string
          team_id?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          anonymized_at?: string | null
          archived_at?: string | null
          briefing_type?: string
          created_at?: string
          created_by?: string
          deleted_at?: string | null
          id?: string
          language?: string | null
          meeting_date?: string | null
          org_id?: string
          participants?: Json
          project_id?: string | null
          retention_days?: number | null
          retention_until?: string | null
          source_content?: string
          source_hash?: string
          source_type?: string
          sprint_id?: string | null
          status?: string
          team_id?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_briefings_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_briefings_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_briefings_sprint_id_fkey"
            columns: ["sprint_id"]
            isOneToOne: false
            referencedRelation: "sprints"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_briefings_sprint_id_fkey"
            columns: ["sprint_id"]
            isOneToOne: false
            referencedRelation: "vw_sprint_pf_summary"
            referencedColumns: ["sprint_id"]
          },
          {
            foreignKeyName: "ai_briefings_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_providers: {
        Row: {
          api_base_url: string | null
          created_at: string
          created_by: string | null
          has_key: boolean
          id: string
          is_active: boolean
          is_recommended: boolean
          model: string | null
          name: string
          provider_type: string
          request_format: string | null
          updated_at: string
          vault_secret_id: string | null
        }
        Insert: {
          api_base_url?: string | null
          created_at?: string
          created_by?: string | null
          has_key?: boolean
          id?: string
          is_active?: boolean
          is_recommended?: boolean
          model?: string | null
          name: string
          provider_type: string
          request_format?: string | null
          updated_at?: string
          vault_secret_id?: string | null
        }
        Update: {
          api_base_url?: string | null
          created_at?: string
          created_by?: string | null
          has_key?: boolean
          id?: string
          is_active?: boolean
          is_recommended?: boolean
          model?: string | null
          name?: string
          provider_type?: string
          request_format?: string | null
          updated_at?: string
          vault_secret_id?: string | null
        }
        Relationships: []
      }
      ai_suggestion_applications: {
        Row: {
          application_snapshot: Json
          applied_at: string
          applied_by: string
          id: string
          suggestion_id: string
          target_id: string
          target_type: string
        }
        Insert: {
          application_snapshot?: Json
          applied_at?: string
          applied_by: string
          id?: string
          suggestion_id: string
          target_id: string
          target_type: string
        }
        Update: {
          application_snapshot?: Json
          applied_at?: string
          applied_by?: string
          id?: string
          suggestion_id?: string
          target_id?: string
          target_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_suggestion_applications_suggestion_id_fkey"
            columns: ["suggestion_id"]
            isOneToOne: true
            referencedRelation: "ai_briefing_suggestions"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_suggestion_evidence: {
        Row: {
          created_at: string
          id: string
          quote_text: string
          source_end: number | null
          source_start: number | null
          speaker_name: string | null
          suggestion_id: string
          timestamp_end: string | null
          timestamp_start: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          quote_text: string
          source_end?: number | null
          source_start?: number | null
          speaker_name?: string | null
          suggestion_id: string
          timestamp_end?: string | null
          timestamp_start?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          quote_text?: string
          source_end?: number | null
          source_start?: number | null
          speaker_name?: string | null
          suggestion_id?: string
          timestamp_end?: string | null
          timestamp_start?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_suggestion_evidence_suggestion_id_fkey"
            columns: ["suggestion_id"]
            isOneToOne: false
            referencedRelation: "ai_briefing_suggestions"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_usage_events: {
        Row: {
          company_id: string | null
          completed_at: string | null
          created_at: string
          error_code: string | null
          feature: string
          id: string
          metadata: Json
          org_id: string | null
          provider_id: string | null
          request_id: string
          status: string
          team_id: string
          units: number
          user_id: string | null
        }
        Insert: {
          company_id?: string | null
          completed_at?: string | null
          created_at?: string
          error_code?: string | null
          feature: string
          id?: string
          metadata?: Json
          org_id?: string | null
          provider_id?: string | null
          request_id: string
          status?: string
          team_id: string
          units?: number
          user_id?: string | null
        }
        Update: {
          company_id?: string | null
          completed_at?: string | null
          created_at?: string
          error_code?: string | null
          feature?: string
          id?: string
          metadata?: Json
          org_id?: string | null
          provider_id?: string | null
          request_id?: string
          status?: string
          team_id?: string
          units?: number
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_usage_events_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_usage_events_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_usage_events_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "ai_providers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_usage_events_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      apex_applications: {
        Row: {
          apex_app_id: number
          apex_app_name: string | null
          config_json: Json | null
          created_at: string
          features: Json | null
          id: string
          integration_id: string
          is_active: boolean | null
          last_sync_at: string | null
          organization_id: string
          page_mappings: Json | null
          rest_data_sources: Json | null
          updated_at: string
        }
        Insert: {
          apex_app_id: number
          apex_app_name?: string | null
          config_json?: Json | null
          created_at?: string
          features?: Json | null
          id?: string
          integration_id: string
          is_active?: boolean | null
          last_sync_at?: string | null
          organization_id: string
          page_mappings?: Json | null
          rest_data_sources?: Json | null
          updated_at?: string
        }
        Update: {
          apex_app_id?: number
          apex_app_name?: string | null
          config_json?: Json | null
          created_at?: string
          features?: Json | null
          id?: string
          integration_id?: string
          is_active?: boolean | null
          last_sync_at?: string | null
          organization_id?: string
          page_mappings?: Json | null
          rest_data_sources?: Json | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "apex_applications_integration_id_fkey"
            columns: ["integration_id"]
            isOneToOne: false
            referencedRelation: "apex_integrations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "apex_applications_integration_id_fkey"
            columns: ["integration_id"]
            isOneToOne: false
            referencedRelation: "v_apex_usage_report"
            referencedColumns: ["integration_id"]
          },
          {
            foreignKeyName: "apex_applications_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      apex_integrations: {
        Row: {
          applications: Json | null
          auth_type: string
          base_url: string
          client_id: string | null
          client_secret_encrypted: string | null
          config_json: Json | null
          connection_test_status: string | null
          created_at: string
          created_by: string | null
          id: string
          is_active: boolean | null
          last_connection_test: string | null
          name: string
          oauth2_scope: string | null
          oauth2_token_url: string | null
          organization_id: string
          project_id: string | null
          rest_data_sources: Json | null
          updated_at: string
          user_mapping: Json | null
          webhook_events: string[] | null
          webhook_secret_encrypted: string | null
          webhook_url: string | null
          workspace_id: number | null
          workspace_name: string
        }
        Insert: {
          applications?: Json | null
          auth_type?: string
          base_url: string
          client_id?: string | null
          client_secret_encrypted?: string | null
          config_json?: Json | null
          connection_test_status?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean | null
          last_connection_test?: string | null
          name: string
          oauth2_scope?: string | null
          oauth2_token_url?: string | null
          organization_id: string
          project_id?: string | null
          rest_data_sources?: Json | null
          updated_at?: string
          user_mapping?: Json | null
          webhook_events?: string[] | null
          webhook_secret_encrypted?: string | null
          webhook_url?: string | null
          workspace_id?: number | null
          workspace_name: string
        }
        Update: {
          applications?: Json | null
          auth_type?: string
          base_url?: string
          client_id?: string | null
          client_secret_encrypted?: string | null
          config_json?: Json | null
          connection_test_status?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean | null
          last_connection_test?: string | null
          name?: string
          oauth2_scope?: string | null
          oauth2_token_url?: string | null
          organization_id?: string
          project_id?: string | null
          rest_data_sources?: Json | null
          updated_at?: string
          user_mapping?: Json | null
          webhook_events?: string[] | null
          webhook_secret_encrypted?: string | null
          webhook_url?: string | null
          workspace_id?: number | null
          workspace_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "apex_integrations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "apex_integrations_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      apex_usage_events: {
        Row: {
          apex_app_id: number | null
          apex_page_id: number | null
          apex_session_id: string | null
          apex_user: string | null
          application_id: string | null
          axionn_user_id: string | null
          correlation_id: string | null
          created_at: string
          endpoint_path: string | null
          id: string
          integration_id: string
          organization_id: string
          parameters: Json | null
          request_type: string | null
          response_status: number | null
          response_time_ms: number | null
          rows_returned: number | null
        }
        Insert: {
          apex_app_id?: number | null
          apex_page_id?: number | null
          apex_session_id?: string | null
          apex_user?: string | null
          application_id?: string | null
          axionn_user_id?: string | null
          correlation_id?: string | null
          created_at?: string
          endpoint_path?: string | null
          id?: string
          integration_id: string
          organization_id: string
          parameters?: Json | null
          request_type?: string | null
          response_status?: number | null
          response_time_ms?: number | null
          rows_returned?: number | null
        }
        Update: {
          apex_app_id?: number | null
          apex_page_id?: number | null
          apex_session_id?: string | null
          apex_user?: string | null
          application_id?: string | null
          axionn_user_id?: string | null
          correlation_id?: string | null
          created_at?: string
          endpoint_path?: string | null
          id?: string
          integration_id?: string
          organization_id?: string
          parameters?: Json | null
          request_type?: string | null
          response_status?: number | null
          response_time_ms?: number | null
          rows_returned?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "apex_usage_events_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "apex_applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "apex_usage_events_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "v_apex_usage_report"
            referencedColumns: ["application_id"]
          },
          {
            foreignKeyName: "apex_usage_events_integration_id_fkey"
            columns: ["integration_id"]
            isOneToOne: false
            referencedRelation: "apex_integrations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "apex_usage_events_integration_id_fkey"
            columns: ["integration_id"]
            isOneToOne: false
            referencedRelation: "v_apex_usage_report"
            referencedColumns: ["integration_id"]
          },
          {
            foreignKeyName: "apex_usage_events_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      apf_baseline_items: {
        Row: {
          baseline_id: string
          category_sigla: string | null
          complexity: string
          contribution_pct: number
          created_at: string
          description: string
          factor_sigla: string | null
          function_sigla: string
          id: string
          is_measurable: boolean
          item_ref: string
          measurement_reference: string | null
          module: string | null
          normalized_key: string | null
          notes: string | null
          pf_bruto: number | null
          pf_fs: number
          process_name: string | null
          process_ref: string | null
          product_reference: string | null
          project_reference: string | null
          sort_order: number
          source_payload: Json
          source_row: number | null
        }
        Insert: {
          baseline_id: string
          category_sigla?: string | null
          complexity?: string
          contribution_pct?: number
          created_at?: string
          description: string
          factor_sigla?: string | null
          function_sigla: string
          id?: string
          is_measurable?: boolean
          item_ref: string
          measurement_reference?: string | null
          module?: string | null
          normalized_key?: string | null
          notes?: string | null
          pf_bruto?: number | null
          pf_fs?: number
          process_name?: string | null
          process_ref?: string | null
          product_reference?: string | null
          project_reference?: string | null
          sort_order?: number
          source_payload?: Json
          source_row?: number | null
        }
        Update: {
          baseline_id?: string
          category_sigla?: string | null
          complexity?: string
          contribution_pct?: number
          created_at?: string
          description?: string
          factor_sigla?: string | null
          function_sigla?: string
          id?: string
          is_measurable?: boolean
          item_ref?: string
          measurement_reference?: string | null
          module?: string | null
          normalized_key?: string | null
          notes?: string | null
          pf_bruto?: number | null
          pf_fs?: number
          process_name?: string | null
          process_ref?: string | null
          product_reference?: string | null
          project_reference?: string | null
          sort_order?: number
          source_payload?: Json
          source_row?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "apf_baseline_items_baseline_id_fkey"
            columns: ["baseline_id"]
            isOneToOne: false
            referencedRelation: "apf_project_baselines"
            referencedColumns: ["id"]
          },
        ]
      }
      apf_categories: {
        Row: {
          description: string | null
          id: string
          is_active: boolean
          model_id: string
          name: string
          sigla: string
        }
        Insert: {
          description?: string | null
          id?: string
          is_active?: boolean
          model_id: string
          name: string
          sigla: string
        }
        Update: {
          description?: string | null
          id?: string
          is_active?: boolean
          model_id?: string
          name?: string
          sigla?: string
        }
        Relationships: [
          {
            foreignKeyName: "apf_categories_model_id_fkey"
            columns: ["model_id"]
            isOneToOne: false
            referencedRelation: "apf_counting_models"
            referencedColumns: ["id"]
          },
        ]
      }
      apf_counting_items: {
        Row: {
          absorbed_by_item_id: string | null
          ai_confidence_score: number | null
          analyst_note: string | null
          baseline_item_id: string | null
          category_sigla: string | null
          complexity: string | null
          contribution_pct: number
          corrected_factor_sigla: string | null
          corrected_function_sigla: string | null
          corrected_pf_bruto: number | null
          corrected_pf_fs: number | null
          counting_decision: string
          created_at: string
          ef_description: string
          elementary_process_id: string | null
          elementary_process_key: string | null
          elementary_process_name: string | null
          evidence_literal: string | null
          factor_sigla: string
          function_sigla: string
          hu_ref: string | null
          hu_refs: string[]
          id: string
          is_validated: boolean
          justification: string | null
          match_confidence: number | null
          match_type: string | null
          normalized_key: string | null
          pf_bruto: number
          pf_fs: number
          precedent_ref: string | null
          process_is_complete: boolean
          process_is_independent: boolean
          process_reasoning: string | null
          process_role: string
          separation_precedent_ref: string | null
          session_id: string
          sort_order: number | null
          source_payload: Json
          story_id: string | null
          story_ids: string[]
          updated_at: string
          validated_at: string | null
          validated_by: string | null
        }
        Insert: {
          absorbed_by_item_id?: string | null
          ai_confidence_score?: number | null
          analyst_note?: string | null
          baseline_item_id?: string | null
          category_sigla?: string | null
          complexity?: string | null
          contribution_pct?: number
          corrected_factor_sigla?: string | null
          corrected_function_sigla?: string | null
          corrected_pf_bruto?: number | null
          corrected_pf_fs?: number | null
          counting_decision?: string
          created_at?: string
          ef_description: string
          elementary_process_id?: string | null
          elementary_process_key?: string | null
          elementary_process_name?: string | null
          evidence_literal?: string | null
          factor_sigla: string
          function_sigla: string
          hu_ref?: string | null
          hu_refs?: string[]
          id?: string
          is_validated?: boolean
          justification?: string | null
          match_confidence?: number | null
          match_type?: string | null
          normalized_key?: string | null
          pf_bruto?: number
          pf_fs?: number
          precedent_ref?: string | null
          process_is_complete?: boolean
          process_is_independent?: boolean
          process_reasoning?: string | null
          process_role?: string
          separation_precedent_ref?: string | null
          session_id: string
          sort_order?: number | null
          source_payload?: Json
          story_id?: string | null
          story_ids?: string[]
          updated_at?: string
          validated_at?: string | null
          validated_by?: string | null
        }
        Update: {
          absorbed_by_item_id?: string | null
          ai_confidence_score?: number | null
          analyst_note?: string | null
          baseline_item_id?: string | null
          category_sigla?: string | null
          complexity?: string | null
          contribution_pct?: number
          corrected_factor_sigla?: string | null
          corrected_function_sigla?: string | null
          corrected_pf_bruto?: number | null
          corrected_pf_fs?: number | null
          counting_decision?: string
          created_at?: string
          ef_description?: string
          elementary_process_id?: string | null
          elementary_process_key?: string | null
          elementary_process_name?: string | null
          evidence_literal?: string | null
          factor_sigla?: string
          function_sigla?: string
          hu_ref?: string | null
          hu_refs?: string[]
          id?: string
          is_validated?: boolean
          justification?: string | null
          match_confidence?: number | null
          match_type?: string | null
          normalized_key?: string | null
          pf_bruto?: number
          pf_fs?: number
          precedent_ref?: string | null
          process_is_complete?: boolean
          process_is_independent?: boolean
          process_reasoning?: string | null
          process_role?: string
          separation_precedent_ref?: string | null
          session_id?: string
          sort_order?: number | null
          source_payload?: Json
          story_id?: string | null
          story_ids?: string[]
          updated_at?: string
          validated_at?: string | null
          validated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "apf_counting_items_absorbed_by_item_id_fkey"
            columns: ["absorbed_by_item_id"]
            isOneToOne: false
            referencedRelation: "apf_counting_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "apf_counting_items_baseline_item_id_fkey"
            columns: ["baseline_item_id"]
            isOneToOne: false
            referencedRelation: "apf_baseline_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "apf_counting_items_elementary_process_id_fkey"
            columns: ["elementary_process_id"]
            isOneToOne: false
            referencedRelation: "apf_elementary_processes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "apf_counting_items_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "apf_counting_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "apf_counting_items_story_id_fkey"
            columns: ["story_id"]
            isOneToOne: false
            referencedRelation: "user_stories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "apf_counting_items_story_id_fkey"
            columns: ["story_id"]
            isOneToOne: false
            referencedRelation: "v_hu_git_summary"
            referencedColumns: ["hu_id"]
          },
        ]
      }
      apf_counting_models: {
        Row: {
          contract_id: string
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          standard: Database["public"]["Enums"]["apf_standard"]
          updated_at: string
        }
        Insert: {
          contract_id: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          standard?: Database["public"]["Enums"]["apf_standard"]
          updated_at?: string
        }
        Update: {
          contract_id?: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          standard?: Database["public"]["Enums"]["apf_standard"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "apf_counting_models_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: true
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
        ]
      }
      apf_counting_rules: {
        Row: {
          id: string
          model_id: string
          rule_closure: string | null
          rule_contractual_consistency: string | null
          rule_critical_guidelines: string | null
          rule_decision_hierarchy: string | null
          rule_elementary_process: string | null
          rule_fundamental_principle: string | null
          rule_granularity: string | null
          rule_mission: string | null
          rule_precedence_override: string | null
          updated_at: string
        }
        Insert: {
          id?: string
          model_id: string
          rule_closure?: string | null
          rule_contractual_consistency?: string | null
          rule_critical_guidelines?: string | null
          rule_decision_hierarchy?: string | null
          rule_elementary_process?: string | null
          rule_fundamental_principle?: string | null
          rule_granularity?: string | null
          rule_mission?: string | null
          rule_precedence_override?: string | null
          updated_at?: string
        }
        Update: {
          id?: string
          model_id?: string
          rule_closure?: string | null
          rule_contractual_consistency?: string | null
          rule_critical_guidelines?: string | null
          rule_decision_hierarchy?: string | null
          rule_elementary_process?: string | null
          rule_fundamental_principle?: string | null
          rule_granularity?: string | null
          rule_mission?: string | null
          rule_precedence_override?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "apf_counting_rules_model_id_fkey"
            columns: ["model_id"]
            isOneToOne: true
            referencedRelation: "apf_counting_models"
            referencedColumns: ["id"]
          },
        ]
      }
      apf_counting_sessions: {
        Row: {
          ai_model_used: string | null
          analyst_id: string | null
          baseline_id: string | null
          created_at: string
          evidence_doc: string | null
          id: string
          model_id: string
          project_id: string | null
          redmine_ref: string | null
          release_ref: string | null
          reviewer_id: string | null
          sprint_ref: string | null
          status: Database["public"]["Enums"]["apf_session_status"]
          total_functions: number | null
          total_hus: number | null
          total_pf_bruto: number | null
          total_pf_fs: number | null
          updated_at: string
          validated_at: string | null
        }
        Insert: {
          ai_model_used?: string | null
          analyst_id?: string | null
          baseline_id?: string | null
          created_at?: string
          evidence_doc?: string | null
          id?: string
          model_id: string
          project_id?: string | null
          redmine_ref?: string | null
          release_ref?: string | null
          reviewer_id?: string | null
          sprint_ref?: string | null
          status?: Database["public"]["Enums"]["apf_session_status"]
          total_functions?: number | null
          total_hus?: number | null
          total_pf_bruto?: number | null
          total_pf_fs?: number | null
          updated_at?: string
          validated_at?: string | null
        }
        Update: {
          ai_model_used?: string | null
          analyst_id?: string | null
          baseline_id?: string | null
          created_at?: string
          evidence_doc?: string | null
          id?: string
          model_id?: string
          project_id?: string | null
          redmine_ref?: string | null
          release_ref?: string | null
          reviewer_id?: string | null
          sprint_ref?: string | null
          status?: Database["public"]["Enums"]["apf_session_status"]
          total_functions?: number | null
          total_hus?: number | null
          total_pf_bruto?: number | null
          total_pf_fs?: number | null
          updated_at?: string
          validated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "apf_counting_sessions_baseline_id_fkey"
            columns: ["baseline_id"]
            isOneToOne: false
            referencedRelation: "apf_project_baselines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "apf_counting_sessions_model_id_fkey"
            columns: ["model_id"]
            isOneToOne: false
            referencedRelation: "apf_counting_models"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "apf_counting_sessions_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      apf_elementary_processes: {
        Row: {
          confidence: number | null
          created_at: string
          created_by: string | null
          decision: string
          decision_reason: string | null
          id: string
          is_complete: boolean
          is_independent: boolean
          objective: string | null
          precedent_ref: string | null
          process_key: string
          process_name: string
          process_role: string
          session_id: string
          updated_at: string
          validated_at: string | null
          validated_by: string | null
        }
        Insert: {
          confidence?: number | null
          created_at?: string
          created_by?: string | null
          decision?: string
          decision_reason?: string | null
          id?: string
          is_complete?: boolean
          is_independent?: boolean
          objective?: string | null
          precedent_ref?: string | null
          process_key: string
          process_name: string
          process_role?: string
          session_id: string
          updated_at?: string
          validated_at?: string | null
          validated_by?: string | null
        }
        Update: {
          confidence?: number | null
          created_at?: string
          created_by?: string | null
          decision?: string
          decision_reason?: string | null
          id?: string
          is_complete?: boolean
          is_independent?: boolean
          objective?: string | null
          precedent_ref?: string | null
          process_key?: string
          process_name?: string
          process_role?: string
          session_id?: string
          updated_at?: string
          validated_at?: string | null
          validated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "apf_elementary_processes_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "apf_counting_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      apf_embedding_queue: {
        Row: {
          attempts: number
          created_at: string
          error_message: string | null
          event_id: string
          id: string
          processed_at: string | null
          status: string
        }
        Insert: {
          attempts?: number
          created_at?: string
          error_message?: string | null
          event_id: string
          id?: string
          processed_at?: string | null
          status?: string
        }
        Update: {
          attempts?: number
          created_at?: string
          error_message?: string | null
          event_id?: string
          id?: string
          processed_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "apf_embedding_queue_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "apf_validation_events"
            referencedColumns: ["id"]
          },
        ]
      }
      apf_function_type_weights: {
        Row: {
          complexity: string
          created_at: string
          function_sigla: string
          id: string
          model_id: string
          updated_at: string
          weight: number
        }
        Insert: {
          complexity: string
          created_at?: string
          function_sigla: string
          id?: string
          model_id: string
          updated_at?: string
          weight: number
        }
        Update: {
          complexity?: string
          created_at?: string
          function_sigla?: string
          id?: string
          model_id?: string
          updated_at?: string
          weight?: number
        }
        Relationships: [
          {
            foreignKeyName: "apf_function_type_weights_model_id_fkey"
            columns: ["model_id"]
            isOneToOne: false
            referencedRelation: "apf_counting_models"
            referencedColumns: ["id"]
          },
        ]
      }
      apf_function_types: {
        Row: {
          created_at: string
          func_class: Database["public"]["Enums"]["apf_function_class"]
          id: string
          is_active: boolean
          model_id: string
          name: string
          sigla: string
          sort_order: number
          weight: number
        }
        Insert: {
          created_at?: string
          func_class?: Database["public"]["Enums"]["apf_function_class"]
          id?: string
          is_active?: boolean
          model_id: string
          name: string
          sigla: string
          sort_order?: number
          weight: number
        }
        Update: {
          created_at?: string
          func_class?: Database["public"]["Enums"]["apf_function_class"]
          id?: string
          is_active?: boolean
          model_id?: string
          name?: string
          sigla?: string
          sort_order?: number
          weight?: number
        }
        Relationships: [
          {
            foreignKeyName: "apf_function_types_model_id_fkey"
            columns: ["model_id"]
            isOneToOne: false
            referencedRelation: "apf_counting_models"
            referencedColumns: ["id"]
          },
        ]
      }
      apf_generations: {
        Row: {
          baseline_file: string | null
          created_at: string
          error_message: string | null
          generated_by: string | null
          hu_file: string | null
          id: string
          model_file: string | null
          output_filename: string | null
          pf_breakdown: Json | null
          pf_total: number | null
          sprint_id: string | null
          status: string
          team_id: string
          template_id: string | null
        }
        Insert: {
          baseline_file?: string | null
          created_at?: string
          error_message?: string | null
          generated_by?: string | null
          hu_file?: string | null
          id?: string
          model_file?: string | null
          output_filename?: string | null
          pf_breakdown?: Json | null
          pf_total?: number | null
          sprint_id?: string | null
          status?: string
          team_id: string
          template_id?: string | null
        }
        Update: {
          baseline_file?: string | null
          created_at?: string
          error_message?: string | null
          generated_by?: string | null
          hu_file?: string | null
          id?: string
          model_file?: string | null
          output_filename?: string | null
          pf_breakdown?: Json | null
          pf_total?: number | null
          sprint_id?: string | null
          status?: string
          team_id?: string
          template_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "apf_generations_generated_by_fkey"
            columns: ["generated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "apf_generations_sprint_id_fkey"
            columns: ["sprint_id"]
            isOneToOne: false
            referencedRelation: "sprints"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "apf_generations_sprint_id_fkey"
            columns: ["sprint_id"]
            isOneToOne: false
            referencedRelation: "vw_sprint_pf_summary"
            referencedColumns: ["sprint_id"]
          },
          {
            foreignKeyName: "apf_generations_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "apf_generations_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "apf_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      apf_gray_zones: {
        Row: {
          applicable_precedent: string | null
          confidence_level: string | null
          counting_item_id: string | null
          created_at: string
          decision: string | null
          hu_ref: string | null
          id: string
          interpretation_a: string
          interpretation_b: string
          pf_difference: number | null
          resolved: boolean
          resolved_at: string | null
          resolved_by: string | null
          scenario: string
          session_id: string
        }
        Insert: {
          applicable_precedent?: string | null
          confidence_level?: string | null
          counting_item_id?: string | null
          created_at?: string
          decision?: string | null
          hu_ref?: string | null
          id?: string
          interpretation_a: string
          interpretation_b: string
          pf_difference?: number | null
          resolved?: boolean
          resolved_at?: string | null
          resolved_by?: string | null
          scenario: string
          session_id: string
        }
        Update: {
          applicable_precedent?: string | null
          confidence_level?: string | null
          counting_item_id?: string | null
          created_at?: string
          decision?: string | null
          hu_ref?: string | null
          id?: string
          interpretation_a?: string
          interpretation_b?: string
          pf_difference?: number | null
          resolved?: boolean
          resolved_at?: string | null
          resolved_by?: string | null
          scenario?: string
          session_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "apf_gray_zones_counting_item_id_fkey"
            columns: ["counting_item_id"]
            isOneToOne: false
            referencedRelation: "apf_counting_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "apf_gray_zones_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "apf_counting_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      apf_impact_factors: {
        Row: {
          action_on_baseline: string
          contribution_pct: number
          created_at: string
          id: string
          is_active: boolean
          is_inm: boolean
          model_id: string
          name: string
          notes: string | null
          origin: string | null
          sigla: string
          sort_order: number
        }
        Insert: {
          action_on_baseline?: string
          contribution_pct: number
          created_at?: string
          id?: string
          is_active?: boolean
          is_inm?: boolean
          model_id: string
          name: string
          notes?: string | null
          origin?: string | null
          sigla: string
          sort_order?: number
        }
        Update: {
          action_on_baseline?: string
          contribution_pct?: number
          created_at?: string
          id?: string
          is_active?: boolean
          is_inm?: boolean
          model_id?: string
          name?: string
          notes?: string | null
          origin?: string | null
          sigla?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "apf_impact_factors_model_id_fkey"
            columns: ["model_id"]
            isOneToOne: false
            referencedRelation: "apf_counting_models"
            referencedColumns: ["id"]
          },
        ]
      }
      apf_jobs: {
        Row: {
          attempts: number
          created_at: string
          created_by: string | null
          error_message: string | null
          finished_at: string | null
          generation_id: string | null
          id: string
          max_attempts: number
          next_attempt_at: string
          payload: Json
          result: Json | null
          started_at: string | null
          status: string
          team_id: string
          type: string
        }
        Insert: {
          attempts?: number
          created_at?: string
          created_by?: string | null
          error_message?: string | null
          finished_at?: string | null
          generation_id?: string | null
          id?: string
          max_attempts?: number
          next_attempt_at?: string
          payload?: Json
          result?: Json | null
          started_at?: string | null
          status?: string
          team_id: string
          type?: string
        }
        Update: {
          attempts?: number
          created_at?: string
          created_by?: string | null
          error_message?: string | null
          finished_at?: string | null
          generation_id?: string | null
          id?: string
          max_attempts?: number
          next_attempt_at?: string
          payload?: Json
          result?: Json | null
          started_at?: string | null
          status?: string
          team_id?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "apf_jobs_generation_id_fkey"
            columns: ["generation_id"]
            isOneToOne: false
            referencedRelation: "apf_generations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "apf_jobs_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      apf_knowledge_patterns: {
        Row: {
          canonical_complexity: string
          canonical_functional_type: string
          confidence: number
          correction_rate: number | null
          created_at: string
          domain: string | null
          evidence_count: number
          hu_pattern_keywords: string[] | null
          id: string
          occurrence_count: number | null
          pattern_description: string | null
          pattern_embedding: string | null
          pattern_name: string
          status: string
          team_id: string | null
          updated_at: string
          validated_at: string | null
          validated_by: string | null
        }
        Insert: {
          canonical_complexity: string
          canonical_functional_type: string
          confidence?: number
          correction_rate?: number | null
          created_at?: string
          domain?: string | null
          evidence_count?: number
          hu_pattern_keywords?: string[] | null
          id?: string
          occurrence_count?: number | null
          pattern_description?: string | null
          pattern_embedding?: string | null
          pattern_name: string
          status?: string
          team_id?: string | null
          updated_at?: string
          validated_at?: string | null
          validated_by?: string | null
        }
        Update: {
          canonical_complexity?: string
          canonical_functional_type?: string
          confidence?: number
          correction_rate?: number | null
          created_at?: string
          domain?: string | null
          evidence_count?: number
          hu_pattern_keywords?: string[] | null
          id?: string
          occurrence_count?: number | null
          pattern_description?: string | null
          pattern_embedding?: string | null
          pattern_name?: string
          status?: string
          team_id?: string | null
          updated_at?: string
          validated_at?: string | null
          validated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "apf_knowledge_patterns_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      apf_learning_metrics: {
        Row: {
          accuracy_rate: number | null
          avg_confidence_score: number | null
          complexity_accuracy: number | null
          corrected_count: number | null
          corrected_items: number
          correction_by_reason: Json | null
          correction_rate: number | null
          created_at: string
          domain: string | null
          id: string
          provider_id: string | null
          rag_accuracy_delta: number | null
          rag_accuracy_with: number | null
          rag_accuracy_without: number | null
          rag_hits: number
          rag_total: number
          team_id: string | null
          top_correction_reason: string | null
          total_items: number
          total_validations: number | null
          type_accuracy: number | null
          week_start: string
        }
        Insert: {
          accuracy_rate?: number | null
          avg_confidence_score?: number | null
          complexity_accuracy?: number | null
          corrected_count?: number | null
          corrected_items?: number
          correction_by_reason?: Json | null
          correction_rate?: number | null
          created_at?: string
          domain?: string | null
          id?: string
          provider_id?: string | null
          rag_accuracy_delta?: number | null
          rag_accuracy_with?: number | null
          rag_accuracy_without?: number | null
          rag_hits?: number
          rag_total?: number
          team_id?: string | null
          top_correction_reason?: string | null
          total_items?: number
          total_validations?: number | null
          type_accuracy?: number | null
          week_start: string
        }
        Update: {
          accuracy_rate?: number | null
          avg_confidence_score?: number | null
          complexity_accuracy?: number | null
          corrected_count?: number | null
          corrected_items?: number
          correction_by_reason?: Json | null
          correction_rate?: number | null
          created_at?: string
          domain?: string | null
          id?: string
          provider_id?: string | null
          rag_accuracy_delta?: number | null
          rag_accuracy_with?: number | null
          rag_accuracy_without?: number | null
          rag_hits?: number
          rag_total?: number
          team_id?: string | null
          top_correction_reason?: string | null
          total_items?: number
          total_validations?: number | null
          type_accuracy?: number | null
          week_start?: string
        }
        Relationships: [
          {
            foreignKeyName: "apf_learning_metrics_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "ai_providers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "apf_learning_metrics_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      apf_metric_factor_history: {
        Row: {
          created_at: string
          description: string
          factor_sigla: string
          function_sigla: string
          id: string
          is_measurable: boolean
          notes: string | null
          pf_bruto: number
          pf_fs: number
          reference_code: string
          source_measurement: string | null
          system_key: string
        }
        Insert: {
          created_at?: string
          description: string
          factor_sigla: string
          function_sigla: string
          id?: string
          is_measurable?: boolean
          notes?: string | null
          pf_bruto?: number
          pf_fs?: number
          reference_code: string
          source_measurement?: string | null
          system_key: string
        }
        Update: {
          created_at?: string
          description?: string
          factor_sigla?: string
          function_sigla?: string
          id?: string
          is_measurable?: boolean
          notes?: string | null
          pf_bruto?: number
          pf_fs?: number
          reference_code?: string
          source_measurement?: string | null
          system_key?: string
        }
        Relationships: []
      }
      apf_modules: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          is_active: boolean
          name: string
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
        }
        Relationships: []
      }
      apf_output_templates: {
        Row: {
          id: string
          model_id: string
          name: string
          sections: Json
          updated_at: string
        }
        Insert: {
          id?: string
          model_id: string
          name?: string
          sections?: Json
          updated_at?: string
        }
        Update: {
          id?: string
          model_id?: string
          name?: string
          sections?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "apf_output_templates_model_id_fkey"
            columns: ["model_id"]
            isOneToOne: true
            referencedRelation: "apf_counting_models"
            referencedColumns: ["id"]
          },
        ]
      }
      apf_process_analysis_absorbed_items: {
        Row: {
          absorption_reason: string
          analysis_run_id: string
          created_at: string
          description: string
          id: string
        }
        Insert: {
          absorption_reason: string
          analysis_run_id: string
          created_at?: string
          description: string
          id?: string
        }
        Update: {
          absorption_reason?: string
          analysis_run_id?: string
          created_at?: string
          description?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "apf_process_analysis_absorbed_items_analysis_run_id_fkey"
            columns: ["analysis_run_id"]
            isOneToOne: false
            referencedRelation: "apf_process_analysis_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      apf_process_analysis_analogs: {
        Row: {
          adherence: string
          adherence_reason: string | null
          analysis_process_id: string
          baseline_item_id: string | null
          baseline_item_name: string
          created_at: string
          function_type: string
          id: string
          is_primary: boolean
        }
        Insert: {
          adherence?: string
          adherence_reason?: string | null
          analysis_process_id: string
          baseline_item_id?: string | null
          baseline_item_name: string
          created_at?: string
          function_type?: string
          id?: string
          is_primary?: boolean
        }
        Update: {
          adherence?: string
          adherence_reason?: string | null
          analysis_process_id?: string
          baseline_item_id?: string | null
          baseline_item_name?: string
          created_at?: string
          function_type?: string
          id?: string
          is_primary?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "apf_process_analysis_analogs_analysis_process_id_fkey"
            columns: ["analysis_process_id"]
            isOneToOne: false
            referencedRelation: "apf_process_analysis_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "apf_process_analysis_analogs_baseline_item_id_fkey"
            columns: ["baseline_item_id"]
            isOneToOne: false
            referencedRelation: "apf_baseline_items"
            referencedColumns: ["id"]
          },
        ]
      }
      apf_process_analysis_items: {
        Row: {
          analysis_run_id: string
          baseline_precedent_found: boolean
          business_action: string | null
          business_object: string | null
          candidate_function_type: string
          confidence: number | null
          counter_signals: Json
          counting_item_id: string | null
          created_at: string
          decision_source: string
          functional_result: string | null
          id: string
          is_central: boolean
          is_complete: boolean
          is_independent: boolean
          process_name: string
          recommendation: string
          review_required: boolean
          risks: Json
          selected_baseline_item_id: string | null
          selected_by_default: boolean
          separation_reason: string | null
          should_count: boolean
          sort_order: number
          temporary_id: string
          updated_at: string
        }
        Insert: {
          analysis_run_id: string
          baseline_precedent_found?: boolean
          business_action?: string | null
          business_object?: string | null
          candidate_function_type?: string
          confidence?: number | null
          counter_signals?: Json
          counting_item_id?: string | null
          created_at?: string
          decision_source?: string
          functional_result?: string | null
          id?: string
          is_central?: boolean
          is_complete?: boolean
          is_independent?: boolean
          process_name: string
          recommendation?: string
          review_required?: boolean
          risks?: Json
          selected_baseline_item_id?: string | null
          selected_by_default?: boolean
          separation_reason?: string | null
          should_count?: boolean
          sort_order?: number
          temporary_id: string
          updated_at?: string
        }
        Update: {
          analysis_run_id?: string
          baseline_precedent_found?: boolean
          business_action?: string | null
          business_object?: string | null
          candidate_function_type?: string
          confidence?: number | null
          counter_signals?: Json
          counting_item_id?: string | null
          created_at?: string
          decision_source?: string
          functional_result?: string | null
          id?: string
          is_central?: boolean
          is_complete?: boolean
          is_independent?: boolean
          process_name?: string
          recommendation?: string
          review_required?: boolean
          risks?: Json
          selected_baseline_item_id?: string | null
          selected_by_default?: boolean
          separation_reason?: string | null
          should_count?: boolean
          sort_order?: number
          temporary_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "apf_process_analysis_items_analysis_run_id_fkey"
            columns: ["analysis_run_id"]
            isOneToOne: false
            referencedRelation: "apf_process_analysis_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "apf_process_analysis_items_counting_item_id_fkey"
            columns: ["counting_item_id"]
            isOneToOne: false
            referencedRelation: "apf_counting_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "apf_process_analysis_items_selected_baseline_item_id_fkey"
            columns: ["selected_baseline_item_id"]
            isOneToOne: false
            referencedRelation: "apf_baseline_items"
            referencedColumns: ["id"]
          },
        ]
      }
      apf_process_analysis_logical_files: {
        Row: {
          analysis_process_id: string
          baseline_item_id: string | null
          created_at: string
          file_name: string
          file_type: string
          id: string
          process_role: string
        }
        Insert: {
          analysis_process_id: string
          baseline_item_id?: string | null
          created_at?: string
          file_name: string
          file_type?: string
          id?: string
          process_role?: string
        }
        Update: {
          analysis_process_id?: string
          baseline_item_id?: string | null
          created_at?: string
          file_name?: string
          file_type?: string
          id?: string
          process_role?: string
        }
        Relationships: [
          {
            foreignKeyName: "apf_process_analysis_logical_files_analysis_process_id_fkey"
            columns: ["analysis_process_id"]
            isOneToOne: false
            referencedRelation: "apf_process_analysis_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "apf_process_analysis_logical_files_baseline_item_id_fkey"
            columns: ["baseline_item_id"]
            isOneToOne: false
            referencedRelation: "apf_baseline_items"
            referencedColumns: ["id"]
          },
        ]
      }
      apf_process_analysis_non_countable_items: {
        Row: {
          analysis_run_id: string
          created_at: string
          description: string
          id: string
          reason: string
        }
        Insert: {
          analysis_run_id: string
          created_at?: string
          description: string
          id?: string
          reason: string
        }
        Update: {
          analysis_run_id?: string
          created_at?: string
          description?: string
          id?: string
          reason?: string
        }
        Relationships: [
          {
            foreignKeyName: "apf_process_analysis_non_countable_items_analysis_run_id_fkey"
            columns: ["analysis_run_id"]
            isOneToOne: false
            referencedRelation: "apf_process_analysis_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      apf_process_analysis_pending_details: {
        Row: {
          analysis_run_id: string
          created_at: string
          description: string
          id: string
        }
        Insert: {
          analysis_run_id: string
          created_at?: string
          description: string
          id?: string
        }
        Update: {
          analysis_run_id?: string
          created_at?: string
          description?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "apf_process_analysis_pending_details_analysis_run_id_fkey"
            columns: ["analysis_run_id"]
            isOneToOne: false
            referencedRelation: "apf_process_analysis_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      apf_process_analysis_runs: {
        Row: {
          baseline_id: string
          central_process_name: string | null
          central_process_reasoning: string | null
          confirmed_at: string | null
          confirmed_by: string | null
          confirmed_factor_sigla: string | null
          confirmed_factor_source: string | null
          countable_process_count: number
          created_at: string
          error_code: string | null
          error_message: string | null
          factor_confidence: number | null
          factor_override_notes: string | null
          factor_override_reason: string | null
          factor_reasoning: string | null
          factor_review_required: boolean
          factor_source: string
          finished_at: string | null
          hu_summary: string | null
          id: string
          inferred_factor_sigla: string
          input_hash: string
          materialized_at: string | null
          model_name: string | null
          normalized_response: Json | null
          process_count: number
          project_id: string
          prompt_version: string
          provider_id: string | null
          provider_name: string | null
          raw_response: string | null
          requested_by: string | null
          review_process_count: number
          schema_version: string
          started_at: string
          status: string
          status_reason: string | null
          story_id: string
          suggested_factor_sigla: string | null
          updated_at: string
          validation_mode: string
        }
        Insert: {
          baseline_id: string
          central_process_name?: string | null
          central_process_reasoning?: string | null
          confirmed_at?: string | null
          confirmed_by?: string | null
          confirmed_factor_sigla?: string | null
          confirmed_factor_source?: string | null
          countable_process_count?: number
          created_at?: string
          error_code?: string | null
          error_message?: string | null
          factor_confidence?: number | null
          factor_override_notes?: string | null
          factor_override_reason?: string | null
          factor_reasoning?: string | null
          factor_review_required?: boolean
          factor_source?: string
          finished_at?: string | null
          hu_summary?: string | null
          id?: string
          inferred_factor_sigla: string
          input_hash: string
          materialized_at?: string | null
          model_name?: string | null
          normalized_response?: Json | null
          process_count?: number
          project_id: string
          prompt_version: string
          provider_id?: string | null
          provider_name?: string | null
          raw_response?: string | null
          requested_by?: string | null
          review_process_count?: number
          schema_version: string
          started_at?: string
          status?: string
          status_reason?: string | null
          story_id: string
          suggested_factor_sigla?: string | null
          updated_at?: string
          validation_mode?: string
        }
        Update: {
          baseline_id?: string
          central_process_name?: string | null
          central_process_reasoning?: string | null
          confirmed_at?: string | null
          confirmed_by?: string | null
          confirmed_factor_sigla?: string | null
          confirmed_factor_source?: string | null
          countable_process_count?: number
          created_at?: string
          error_code?: string | null
          error_message?: string | null
          factor_confidence?: number | null
          factor_override_notes?: string | null
          factor_override_reason?: string | null
          factor_reasoning?: string | null
          factor_review_required?: boolean
          factor_source?: string
          finished_at?: string | null
          hu_summary?: string | null
          id?: string
          inferred_factor_sigla?: string
          input_hash?: string
          materialized_at?: string | null
          model_name?: string | null
          normalized_response?: Json | null
          process_count?: number
          project_id?: string
          prompt_version?: string
          provider_id?: string | null
          provider_name?: string | null
          raw_response?: string | null
          requested_by?: string | null
          review_process_count?: number
          schema_version?: string
          started_at?: string
          status?: string
          status_reason?: string | null
          story_id?: string
          suggested_factor_sigla?: string | null
          updated_at?: string
          validation_mode?: string
        }
        Relationships: [
          {
            foreignKeyName: "apf_process_analysis_runs_baseline_id_fkey"
            columns: ["baseline_id"]
            isOneToOne: false
            referencedRelation: "apf_project_baselines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "apf_process_analysis_runs_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "apf_process_analysis_runs_story_id_fkey"
            columns: ["story_id"]
            isOneToOne: false
            referencedRelation: "user_stories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "apf_process_analysis_runs_story_id_fkey"
            columns: ["story_id"]
            isOneToOne: false
            referencedRelation: "v_hu_git_summary"
            referencedColumns: ["hu_id"]
          },
        ]
      }
      apf_process_learning_events: {
        Row: {
          analysis_run_id: string
          confirmed_factor_sigla: string | null
          confirmed_pf_fs: number | null
          confirmed_process_count: number
          corrected: boolean | null
          created_at: string
          decided_by: string | null
          default_selected_process_count: number
          event_type: string
          factor_confidence: number | null
          factor_override_notes: string | null
          factor_override_reason: string | null
          factor_source: string | null
          id: string
          identified_process_count: number
          process_decisions: Json
          project_id: string
          proposed_factor_sigla: string | null
          story_id: string
          suggested_factor_sigla: string | null
          suggested_pf_fs: number | null
          suggested_process_count: number
          team_id: string
        }
        Insert: {
          analysis_run_id: string
          confirmed_factor_sigla?: string | null
          confirmed_pf_fs?: number | null
          confirmed_process_count?: number
          corrected?: boolean | null
          created_at?: string
          decided_by?: string | null
          default_selected_process_count?: number
          event_type?: string
          factor_confidence?: number | null
          factor_override_notes?: string | null
          factor_override_reason?: string | null
          factor_source?: string | null
          id?: string
          identified_process_count?: number
          process_decisions?: Json
          project_id: string
          proposed_factor_sigla?: string | null
          story_id: string
          suggested_factor_sigla?: string | null
          suggested_pf_fs?: number | null
          suggested_process_count?: number
          team_id: string
        }
        Update: {
          analysis_run_id?: string
          confirmed_factor_sigla?: string | null
          confirmed_pf_fs?: number | null
          confirmed_process_count?: number
          corrected?: boolean | null
          created_at?: string
          decided_by?: string | null
          default_selected_process_count?: number
          event_type?: string
          factor_confidence?: number | null
          factor_override_notes?: string | null
          factor_override_reason?: string | null
          factor_source?: string | null
          id?: string
          identified_process_count?: number
          process_decisions?: Json
          project_id?: string
          proposed_factor_sigla?: string | null
          story_id?: string
          suggested_factor_sigla?: string | null
          suggested_pf_fs?: number | null
          suggested_process_count?: number
          team_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "apf_process_learning_events_analysis_run_id_fkey"
            columns: ["analysis_run_id"]
            isOneToOne: false
            referencedRelation: "apf_process_analysis_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "apf_process_learning_events_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "apf_process_learning_events_story_id_fkey"
            columns: ["story_id"]
            isOneToOne: false
            referencedRelation: "user_stories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "apf_process_learning_events_story_id_fkey"
            columns: ["story_id"]
            isOneToOne: false
            referencedRelation: "v_hu_git_summary"
            referencedColumns: ["hu_id"]
          },
          {
            foreignKeyName: "apf_process_learning_events_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      apf_project_baselines: {
        Row: {
          created_at: string
          deleted_at: string | null
          deleted_by: string | null
          id: string
          imported_at: string | null
          imported_by: string | null
          label: string | null
          model_id: string
          project_id: string
          scope_type: string
          source_checksum: string | null
          source_file_name: string | null
          source_summary: Json
          status: Database["public"]["Enums"]["apf_baseline_status"]
          updated_at: string
          validation_report: Json
          validation_status: string
          version: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
          id?: string
          imported_at?: string | null
          imported_by?: string | null
          label?: string | null
          model_id: string
          project_id: string
          scope_type?: string
          source_checksum?: string | null
          source_file_name?: string | null
          source_summary?: Json
          status?: Database["public"]["Enums"]["apf_baseline_status"]
          updated_at?: string
          validation_report?: Json
          validation_status?: string
          version: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
          id?: string
          imported_at?: string | null
          imported_by?: string | null
          label?: string | null
          model_id?: string
          project_id?: string
          scope_type?: string
          source_checksum?: string | null
          source_file_name?: string | null
          source_summary?: Json
          status?: Database["public"]["Enums"]["apf_baseline_status"]
          updated_at?: string
          validation_report?: Json
          validation_status?: string
          version?: string
        }
        Relationships: [
          {
            foreignKeyName: "apf_project_baselines_model_id_fkey"
            columns: ["model_id"]
            isOneToOne: false
            referencedRelation: "apf_counting_models"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "apf_project_baselines_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      apf_recalculation_events: {
        Row: {
          baseline_id: string | null
          created_at: string
          id: string
          previous_snapshot: Json
          project_id: string
          reason: string | null
          requested_by: string | null
          session_id: string | null
          story_id: string
        }
        Insert: {
          baseline_id?: string | null
          created_at?: string
          id?: string
          previous_snapshot?: Json
          project_id: string
          reason?: string | null
          requested_by?: string | null
          session_id?: string | null
          story_id: string
        }
        Update: {
          baseline_id?: string | null
          created_at?: string
          id?: string
          previous_snapshot?: Json
          project_id?: string
          reason?: string | null
          requested_by?: string | null
          session_id?: string | null
          story_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "apf_recalculation_events_baseline_id_fkey"
            columns: ["baseline_id"]
            isOneToOne: false
            referencedRelation: "apf_project_baselines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "apf_recalculation_events_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "apf_recalculation_events_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "apf_counting_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "apf_recalculation_events_story_id_fkey"
            columns: ["story_id"]
            isOneToOne: false
            referencedRelation: "user_stories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "apf_recalculation_events_story_id_fkey"
            columns: ["story_id"]
            isOneToOne: false
            referencedRelation: "v_hu_git_summary"
            referencedColumns: ["hu_id"]
          },
        ]
      }
      apf_similar_cases: {
        Row: {
          complexity: string
          created_at: string
          domain: string | null
          event_id: string
          functional_type: string
          hu_embedding: string | null
          id: string
          pf_value: number | null
          team_id: string | null
        }
        Insert: {
          complexity: string
          created_at?: string
          domain?: string | null
          event_id: string
          functional_type: string
          hu_embedding?: string | null
          id?: string
          pf_value?: number | null
          team_id?: string | null
        }
        Update: {
          complexity?: string
          created_at?: string
          domain?: string | null
          event_id?: string
          functional_type?: string
          hu_embedding?: string | null
          id?: string
          pf_value?: number | null
          team_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "apf_similar_cases_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "apf_validation_events"
            referencedColumns: ["id"]
          },
        ]
      }
      apf_templates: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          is_active: boolean
          module_id: string | null
          name: string
          output_type: string
          prompt_content: string
          team_id: string
          updated_at: string
          version: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          module_id?: string | null
          name: string
          output_type: string
          prompt_content: string
          team_id: string
          updated_at?: string
          version?: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          module_id?: string | null
          name?: string
          output_type?: string
          prompt_content?: string
          team_id?: string
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "apf_templates_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "apf_templates_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "apf_modules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "apf_templates_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      apf_validation_events: {
        Row: {
          ai_complexity: string
          ai_confidence_score: number | null
          ai_factor_sigla: string | null
          ai_functional_type: string
          ai_pf_bruto: number | null
          ai_pf_bruto_exact: number | null
          ai_pf_fs: number | null
          ai_reasoning: string | null
          baseline_item_id: string | null
          corrected_by: string | null
          correction_notes: string | null
          correction_reason_code:
            | Database["public"]["Enums"]["apf_correction_reason"]
            | null
          counting_item_id: string | null
          created_at: string
          embedding_generated_at: string | null
          hu_embedding: string | null
          hu_text: string
          hu_title: string | null
          id: string
          project_domain: string | null
          project_id: string | null
          prompt_version_hash: string | null
          provider_id: string | null
          rag_case_count: number
          rag_was_used: boolean
          session_id: string
          team_id: string | null
          validated_complexity: string
          validated_factor_sigla: string | null
          validated_functional_type: string
          validated_pf_bruto: number | null
          validated_pf_bruto_exact: number | null
          validated_pf_fs: number | null
          was_corrected: boolean | null
          was_corrected_contractual: boolean
        }
        Insert: {
          ai_complexity: string
          ai_confidence_score?: number | null
          ai_factor_sigla?: string | null
          ai_functional_type: string
          ai_pf_bruto?: number | null
          ai_pf_bruto_exact?: number | null
          ai_pf_fs?: number | null
          ai_reasoning?: string | null
          baseline_item_id?: string | null
          corrected_by?: string | null
          correction_notes?: string | null
          correction_reason_code?:
            | Database["public"]["Enums"]["apf_correction_reason"]
            | null
          counting_item_id?: string | null
          created_at?: string
          embedding_generated_at?: string | null
          hu_embedding?: string | null
          hu_text: string
          hu_title?: string | null
          id?: string
          project_domain?: string | null
          project_id?: string | null
          prompt_version_hash?: string | null
          provider_id?: string | null
          rag_case_count?: number
          rag_was_used?: boolean
          session_id: string
          team_id?: string | null
          validated_complexity: string
          validated_factor_sigla?: string | null
          validated_functional_type: string
          validated_pf_bruto?: number | null
          validated_pf_bruto_exact?: number | null
          validated_pf_fs?: number | null
          was_corrected?: boolean | null
          was_corrected_contractual?: boolean
        }
        Update: {
          ai_complexity?: string
          ai_confidence_score?: number | null
          ai_factor_sigla?: string | null
          ai_functional_type?: string
          ai_pf_bruto?: number | null
          ai_pf_bruto_exact?: number | null
          ai_pf_fs?: number | null
          ai_reasoning?: string | null
          baseline_item_id?: string | null
          corrected_by?: string | null
          correction_notes?: string | null
          correction_reason_code?:
            | Database["public"]["Enums"]["apf_correction_reason"]
            | null
          counting_item_id?: string | null
          created_at?: string
          embedding_generated_at?: string | null
          hu_embedding?: string | null
          hu_text?: string
          hu_title?: string | null
          id?: string
          project_domain?: string | null
          project_id?: string | null
          prompt_version_hash?: string | null
          provider_id?: string | null
          rag_case_count?: number
          rag_was_used?: boolean
          session_id?: string
          team_id?: string | null
          validated_complexity?: string
          validated_factor_sigla?: string | null
          validated_functional_type?: string
          validated_pf_bruto?: number | null
          validated_pf_bruto_exact?: number | null
          validated_pf_fs?: number | null
          was_corrected?: boolean | null
          was_corrected_contractual?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "apf_validation_events_baseline_item_id_fkey"
            columns: ["baseline_item_id"]
            isOneToOne: false
            referencedRelation: "apf_baseline_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "apf_validation_events_counting_item_id_fkey"
            columns: ["counting_item_id"]
            isOneToOne: false
            referencedRelation: "apf_counting_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "apf_validation_events_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "apf_validation_events_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "ai_providers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "apf_validation_events_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      api_contract_versions: {
        Row: {
          api_name: string
          changelog: string | null
          created_at: string
          created_by: string | null
          deprecated_at: string | null
          id: string
          metadata: Json | null
          organization_id: string
          published_at: string | null
          retired_at: string | null
          spec_content: Json
          spec_type: string | null
          spec_url: string | null
          status: string | null
          updated_at: string
          version: string
        }
        Insert: {
          api_name: string
          changelog?: string | null
          created_at?: string
          created_by?: string | null
          deprecated_at?: string | null
          id?: string
          metadata?: Json | null
          organization_id: string
          published_at?: string | null
          retired_at?: string | null
          spec_content: Json
          spec_type?: string | null
          spec_url?: string | null
          status?: string | null
          updated_at?: string
          version: string
        }
        Update: {
          api_name?: string
          changelog?: string | null
          created_at?: string
          created_by?: string | null
          deprecated_at?: string | null
          id?: string
          metadata?: Json | null
          organization_id?: string
          published_at?: string | null
          retired_at?: string | null
          spec_content?: Json
          spec_type?: string | null
          spec_url?: string | null
          status?: string | null
          updated_at?: string
          version?: string
        }
        Relationships: [
          {
            foreignKeyName: "api_contract_versions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      api_gateway_applications: {
        Row: {
          allowed_endpoints: string[] | null
          allowed_scopes: string[] | null
          application_type: string
          client_id: string
          client_secret_hash: string
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          metadata: Json | null
          name: string
          organization_id: string
          quota_limit: number | null
          quota_period: string | null
          rate_limit_rph: number | null
          rate_limit_rpm: number | null
          status: string | null
          threescale_application_id: string | null
          threescale_plan_id: string | null
          threescale_service_id: string | null
          updated_at: string
        }
        Insert: {
          allowed_endpoints?: string[] | null
          allowed_scopes?: string[] | null
          application_type: string
          client_id: string
          client_secret_hash: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          metadata?: Json | null
          name: string
          organization_id: string
          quota_limit?: number | null
          quota_period?: string | null
          rate_limit_rph?: number | null
          rate_limit_rpm?: number | null
          status?: string | null
          threescale_application_id?: string | null
          threescale_plan_id?: string | null
          threescale_service_id?: string | null
          updated_at?: string
        }
        Update: {
          allowed_endpoints?: string[] | null
          allowed_scopes?: string[] | null
          application_type?: string
          client_id?: string
          client_secret_hash?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          metadata?: Json | null
          name?: string
          organization_id?: string
          quota_limit?: number | null
          quota_period?: string | null
          rate_limit_rph?: number | null
          rate_limit_rpm?: number | null
          status?: string | null
          threescale_application_id?: string | null
          threescale_plan_id?: string | null
          threescale_service_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "api_gateway_applications_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      api_gateway_usage_events: {
        Row: {
          aggregation_period: string
          api_version: string | null
          application_id: string | null
          authenticated_user_id: string | null
          consumer_ip: unknown
          contract_version_id: string | null
          correlation_id: string | null
          endpoint_path: string
          event_timestamp: string
          http_method: string
          id: string
          metadata: Json | null
          organization_id: string
          request_size_bytes: number | null
          response_size_bytes: number | null
          response_status: number
          response_time_ms: number | null
          user_agent: string | null
        }
        Insert: {
          aggregation_period: string
          api_version?: string | null
          application_id?: string | null
          authenticated_user_id?: string | null
          consumer_ip?: unknown
          contract_version_id?: string | null
          correlation_id?: string | null
          endpoint_path: string
          event_timestamp?: string
          http_method: string
          id?: string
          metadata?: Json | null
          organization_id: string
          request_size_bytes?: number | null
          response_size_bytes?: number | null
          response_status: number
          response_time_ms?: number | null
          user_agent?: string | null
        }
        Update: {
          aggregation_period?: string
          api_version?: string | null
          application_id?: string | null
          authenticated_user_id?: string | null
          consumer_ip?: unknown
          contract_version_id?: string | null
          correlation_id?: string | null
          endpoint_path?: string
          event_timestamp?: string
          http_method?: string
          id?: string
          metadata?: Json | null
          organization_id?: string
          request_size_bytes?: number | null
          response_size_bytes?: number | null
          response_status?: number
          response_time_ms?: number | null
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "api_gateway_usage_events_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "api_gateway_applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "api_gateway_usage_events_contract_version_id_fkey"
            columns: ["contract_version_id"]
            isOneToOne: false
            referencedRelation: "api_contract_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "api_gateway_usage_events_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      app_permissions: {
        Row: {
          group_key: string
          key: string
          label: string
        }
        Insert: {
          group_key: string
          key: string
          label: string
        }
        Update: {
          group_key?: string
          key?: string
          label?: string
        }
        Relationships: []
      }
      app_roles: {
        Row: {
          label: string
          name: string
          sort_order: number
        }
        Insert: {
          label: string
          name: string
          sort_order?: number
        }
        Update: {
          label?: string
          name?: string
          sort_order?: number
        }
        Relationships: []
      }
      attachments: {
        Row: {
          created_at: string
          entity_id: string
          entity_type: string
          file_name: string
          file_path: string
          file_size: number
          id: string
          mime_type: string
          team_id: string
          uploaded_by: string
        }
        Insert: {
          created_at?: string
          entity_id: string
          entity_type?: string
          file_name: string
          file_path: string
          file_size?: number
          id?: string
          mime_type?: string
          team_id: string
          uploaded_by: string
        }
        Update: {
          created_at?: string
          entity_id?: string
          entity_type?: string
          file_name?: string
          file_path?: string
          file_size?: number
          id?: string
          mime_type?: string
          team_id?: string
          uploaded_by?: string
        }
        Relationships: []
      }
      audit_log: {
        Row: {
          actor_email: string | null
          actor_id: string | null
          created_at: string
          id: string
          ip_address: string | null
          new_data: Json | null
          old_data: Json | null
          operation: string
          record_id: string | null
          table_name: string
          user_agent: string | null
        }
        Insert: {
          actor_email?: string | null
          actor_id?: string | null
          created_at?: string
          id?: string
          ip_address?: string | null
          new_data?: Json | null
          old_data?: Json | null
          operation: string
          record_id?: string | null
          table_name: string
          user_agent?: string | null
        }
        Update: {
          actor_email?: string | null
          actor_id?: string | null
          created_at?: string
          id?: string
          ip_address?: string | null
          new_data?: Json | null
          old_data?: Json | null
          operation?: string
          record_id?: string | null
          table_name?: string
          user_agent?: string | null
        }
        Relationships: []
      }
      audit_log_events: {
        Row: {
          action: string
          actor_user_id: string | null
          after_json: Json | null
          before_json: Json | null
          correlation_id: string | null
          created_at: string
          id: string
          ip_hash: string | null
          metadata_json: Json | null
          organization_id: string | null
          source: string
          target_id: string | null
          target_type: string
          user_agent: string | null
        }
        Insert: {
          action: string
          actor_user_id?: string | null
          after_json?: Json | null
          before_json?: Json | null
          correlation_id?: string | null
          created_at?: string
          id?: string
          ip_hash?: string | null
          metadata_json?: Json | null
          organization_id?: string | null
          source?: string
          target_id?: string | null
          target_type: string
          user_agent?: string | null
        }
        Update: {
          action?: string
          actor_user_id?: string | null
          after_json?: Json | null
          before_json?: Json | null
          correlation_id?: string | null
          created_at?: string
          id?: string
          ip_hash?: string | null
          metadata_json?: Json | null
          organization_id?: string | null
          source?: string
          target_id?: string | null
          target_type?: string
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_log_events_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      auth_audit_events: {
        Row: {
          client_id: string | null
          correlation_id: string | null
          created_at: string
          event_type: string
          failure_reason: string | null
          id: string
          identity_provider_id: string | null
          ip_address: unknown
          metadata: Json | null
          organization_id: string | null
          result: string
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          client_id?: string | null
          correlation_id?: string | null
          created_at?: string
          event_type: string
          failure_reason?: string | null
          id?: string
          identity_provider_id?: string | null
          ip_address?: unknown
          metadata?: Json | null
          organization_id?: string | null
          result: string
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          client_id?: string | null
          correlation_id?: string | null
          created_at?: string
          event_type?: string
          failure_reason?: string | null
          id?: string
          identity_provider_id?: string | null
          ip_address?: unknown
          metadata?: Json | null
          organization_id?: string | null
          result?: string
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "auth_audit_events_identity_provider_id_fkey"
            columns: ["identity_provider_id"]
            isOneToOne: false
            referencedRelation: "identity_providers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "auth_audit_events_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      automation_rules: {
        Row: {
          action_message: string | null
          action_target_status: string | null
          action_type: string
          created_at: string
          enabled: boolean
          id: string
          name: string
          team_id: string
          trigger_from_status: string | null
          trigger_to_status: string
          trigger_type: string
        }
        Insert: {
          action_message?: string | null
          action_target_status?: string | null
          action_type?: string
          created_at?: string
          enabled?: boolean
          id?: string
          name: string
          team_id: string
          trigger_from_status?: string | null
          trigger_to_status: string
          trigger_type?: string
        }
        Update: {
          action_message?: string | null
          action_target_status?: string | null
          action_type?: string
          created_at?: string
          enabled?: boolean
          id?: string
          name?: string
          team_id?: string
          trigger_from_status?: string | null
          trigger_to_status?: string
          trigger_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "automation_rules_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      backoffice_audit_log: {
        Row: {
          action: string
          actor_staff_id: string | null
          actor_user_id: string | null
          after_values: Json
          before_values: Json
          created_at: string
          id: string
          metadata: Json
          resource_id: string | null
          resource_type: string
        }
        Insert: {
          action: string
          actor_staff_id?: string | null
          actor_user_id?: string | null
          after_values?: Json
          before_values?: Json
          created_at?: string
          id?: string
          metadata?: Json
          resource_id?: string | null
          resource_type: string
        }
        Update: {
          action?: string
          actor_staff_id?: string | null
          actor_user_id?: string | null
          after_values?: Json
          before_values?: Json
          created_at?: string
          id?: string
          metadata?: Json
          resource_id?: string | null
          resource_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "backoffice_audit_log_actor_staff_id_fkey"
            columns: ["actor_staff_id"]
            isOneToOne: false
            referencedRelation: "owner_staff_members"
            referencedColumns: ["id"]
          },
        ]
      }
      billing_records: {
        Row: {
          amount: number
          billing_period: string
          created_at: string
          created_by: string | null
          currency: string
          due_date: string
          id: string
          invoice_url: string | null
          notes: string | null
          paid_at: string | null
          period_end: string | null
          period_start: string | null
          plan_type: string
          status: string
          tenant_id: string | null
          tenant_name: string
          updated_at: string
        }
        Insert: {
          amount: number
          billing_period?: string
          created_at?: string
          created_by?: string | null
          currency?: string
          due_date: string
          id?: string
          invoice_url?: string | null
          notes?: string | null
          paid_at?: string | null
          period_end?: string | null
          period_start?: string | null
          plan_type?: string
          status?: string
          tenant_id?: string | null
          tenant_name: string
          updated_at?: string
        }
        Update: {
          amount?: number
          billing_period?: string
          created_at?: string
          created_by?: string | null
          currency?: string
          due_date?: string
          id?: string
          invoice_url?: string | null
          notes?: string | null
          paid_at?: string | null
          period_end?: string | null
          period_start?: string | null
          plan_type?: string
          status?: string
          tenant_id?: string | null
          tenant_name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "billing_records_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "owner_staff_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "billing_records_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      calendar_events: {
        Row: {
          created_at: string
          description: string | null
          event_date: string
          event_time: string | null
          event_type: string
          id: string
          team_id: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          event_date: string
          event_time?: string | null
          event_type?: string
          id?: string
          team_id: string
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          event_date?: string
          event_time?: string | null
          event_type?: string
          id?: string
          team_id?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "calendar_events_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      companies: {
        Row: {
          cnpj: string | null
          created_at: string
          email: string | null
          id: string
          logo_url: string | null
          name: string
          org_id: string | null
          phone: string | null
          status: string
          updated_at: string
        }
        Insert: {
          cnpj?: string | null
          created_at?: string
          email?: string | null
          id?: string
          logo_url?: string | null
          name: string
          org_id?: string | null
          phone?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          cnpj?: string | null
          created_at?: string
          email?: string | null
          id?: string
          logo_url?: string | null
          name?: string
          org_id?: string | null
          phone?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "companies_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      contract_audit_log: {
        Row: {
          action: string
          admin_id: string
          contract_id: string
          created_at: string
          id: string
          payload: Json | null
        }
        Insert: {
          action: string
          admin_id: string
          contract_id: string
          created_at?: string
          id?: string
          payload?: Json | null
        }
        Update: {
          action?: string
          admin_id?: string
          contract_id?: string
          created_at?: string
          id?: string
          payload?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "contract_audit_log_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
        ]
      }
      contract_members: {
        Row: {
          contract_id: string
          created_at: string
          id: string
          role: string
          updated_at: string
          user_id: string
        }
        Insert: {
          contract_id: string
          created_at?: string
          id?: string
          role?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          contract_id?: string
          created_at?: string
          id?: string
          role?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "contract_members_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
        ]
      }
      contract_room_teams: {
        Row: {
          contract_id: string
          created_at: string
          id: string
          is_active: boolean
          project_id: string | null
          room_type: string
          team_id: string
          updated_at: string
        }
        Insert: {
          contract_id: string
          created_at?: string
          id?: string
          is_active?: boolean
          project_id?: string | null
          room_type: string
          team_id: string
          updated_at?: string
        }
        Update: {
          contract_id?: string
          created_at?: string
          id?: string
          is_active?: boolean
          project_id?: string | null
          room_type?: string
          team_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "contract_room_teams_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contract_room_teams_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contract_room_teams_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      contract_slas: {
        Row: {
          business_hours_only: boolean
          contract_id: string
          created_at: string | null
          id: string
          priority: string
          resolution_time_minutes: number
          response_time_minutes: number
          sla_type: string
          updated_at: string | null
        }
        Insert: {
          business_hours_only?: boolean
          contract_id: string
          created_at?: string | null
          id?: string
          priority: string
          resolution_time_minutes?: number
          response_time_minutes?: number
          sla_type?: string
          updated_at?: string | null
        }
        Update: {
          business_hours_only?: boolean
          contract_id?: string
          created_at?: string | null
          id?: string
          priority?: string
          resolution_time_minutes?: number
          response_time_minutes?: number
          sla_type?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contract_slas_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
        ]
      }
      contract_teams: {
        Row: {
          contract_id: string
          created_at: string
          id: string
          team_id: string
        }
        Insert: {
          contract_id: string
          created_at?: string
          id?: string
          team_id: string
        }
        Update: {
          contract_id?: string
          created_at?: string
          id?: string
          team_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "contract_teams_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contract_teams_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      contracts: {
        Row: {
          company_id: string | null
          created_at: string | null
          created_by: string | null
          currency: string
          description: string | null
          ends_at: string | null
          id: string
          name: string
          number: string | null
          object: string | null
          org_id: string | null
          room_mode: string
          starts_at: string | null
          status: string | null
          updated_at: string | null
          value_per_pfus: number | null
        }
        Insert: {
          company_id?: string | null
          created_at?: string | null
          created_by?: string | null
          currency?: string
          description?: string | null
          ends_at?: string | null
          id?: string
          name: string
          number?: string | null
          object?: string | null
          org_id?: string | null
          room_mode?: string
          starts_at?: string | null
          status?: string | null
          updated_at?: string | null
          value_per_pfus?: number | null
        }
        Update: {
          company_id?: string | null
          created_at?: string | null
          created_by?: string | null
          currency?: string
          description?: string | null
          ends_at?: string | null
          id?: string
          name?: string
          number?: string | null
          object?: string | null
          org_id?: string | null
          room_mode?: string
          starts_at?: string | null
          status?: string | null
          updated_at?: string | null
          value_per_pfus?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "contracts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contracts_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      copilot_plugin_interactions: {
        Row: {
          conversation_id: string | null
          correlation_id: string | null
          created_at: string
          estimated_cost_usd: number | null
          estimated_tokens: number | null
          feedback_at: string | null
          id: string
          intent: string | null
          message_id: string | null
          ms_user_email: string | null
          ms_user_id: string
          ms_user_name: string | null
          organization_id: string
          parameters: Json | null
          plugin_id: string
          processing_time_ms: number | null
          query_text: string
          response_data: Json | null
          response_summary: string | null
          response_type: string | null
          user_feedback: string | null
        }
        Insert: {
          conversation_id?: string | null
          correlation_id?: string | null
          created_at?: string
          estimated_cost_usd?: number | null
          estimated_tokens?: number | null
          feedback_at?: string | null
          id?: string
          intent?: string | null
          message_id?: string | null
          ms_user_email?: string | null
          ms_user_id: string
          ms_user_name?: string | null
          organization_id: string
          parameters?: Json | null
          plugin_id: string
          processing_time_ms?: number | null
          query_text: string
          response_data?: Json | null
          response_summary?: string | null
          response_type?: string | null
          user_feedback?: string | null
        }
        Update: {
          conversation_id?: string | null
          correlation_id?: string | null
          created_at?: string
          estimated_cost_usd?: number | null
          estimated_tokens?: number | null
          feedback_at?: string | null
          id?: string
          intent?: string | null
          message_id?: string | null
          ms_user_email?: string | null
          ms_user_id?: string
          ms_user_name?: string | null
          organization_id?: string
          parameters?: Json | null
          plugin_id?: string
          processing_time_ms?: number | null
          query_text?: string
          response_data?: Json | null
          response_summary?: string | null
          response_type?: string | null
          user_feedback?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "copilot_plugin_interactions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "copilot_plugin_interactions_plugin_id_fkey"
            columns: ["plugin_id"]
            isOneToOne: false
            referencedRelation: "copilot_plugins"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "copilot_plugin_interactions_plugin_id_fkey"
            columns: ["plugin_id"]
            isOneToOne: false
            referencedRelation: "v_copilot_usage_report"
            referencedColumns: ["plugin_id"]
          },
        ]
      }
      copilot_plugins: {
        Row: {
          api_endpoints: Json | null
          approved_at: string | null
          auth_config: Json | null
          auth_type: string | null
          azure_app_id: string
          azure_app_secret_encrypted: string | null
          config_json: Json | null
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          is_active: boolean | null
          last_validated_at: string | null
          manifest: Json
          name: string
          organization_id: string
          project_id: string | null
          rate_limit_rph: number | null
          rate_limit_rpm: number | null
          submitted_at: string | null
          updated_at: string
          validation_errors: Json | null
          validation_status: string | null
        }
        Insert: {
          api_endpoints?: Json | null
          approved_at?: string | null
          auth_config?: Json | null
          auth_type?: string | null
          azure_app_id: string
          azure_app_secret_encrypted?: string | null
          config_json?: Json | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          last_validated_at?: string | null
          manifest: Json
          name?: string
          organization_id: string
          project_id?: string | null
          rate_limit_rph?: number | null
          rate_limit_rpm?: number | null
          submitted_at?: string | null
          updated_at?: string
          validation_errors?: Json | null
          validation_status?: string | null
        }
        Update: {
          api_endpoints?: Json | null
          approved_at?: string | null
          auth_config?: Json | null
          auth_type?: string | null
          azure_app_id?: string
          azure_app_secret_encrypted?: string | null
          config_json?: Json | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          last_validated_at?: string | null
          manifest?: Json
          name?: string
          organization_id?: string
          project_id?: string | null
          rate_limit_rph?: number | null
          rate_limit_rpm?: number | null
          submitted_at?: string | null
          updated_at?: string
          validation_errors?: Json | null
          validation_status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "copilot_plugins_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "copilot_plugins_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      correlation_contexts: {
        Row: {
          completed_at: string | null
          correlation_id: string
          error_message: string | null
          id: string
          initiated_by_application_id: string | null
          initiated_by_user_id: string | null
          organization_id: string | null
          parent_correlation_id: string | null
          root_correlation_id: string | null
          source_component: string | null
          source_system: string
          started_at: string
          status: string | null
          trace_metadata: Json | null
        }
        Insert: {
          completed_at?: string | null
          correlation_id?: string
          error_message?: string | null
          id?: string
          initiated_by_application_id?: string | null
          initiated_by_user_id?: string | null
          organization_id?: string | null
          parent_correlation_id?: string | null
          root_correlation_id?: string | null
          source_component?: string | null
          source_system: string
          started_at?: string
          status?: string | null
          trace_metadata?: Json | null
        }
        Update: {
          completed_at?: string | null
          correlation_id?: string
          error_message?: string | null
          id?: string
          initiated_by_application_id?: string | null
          initiated_by_user_id?: string | null
          organization_id?: string | null
          parent_correlation_id?: string | null
          root_correlation_id?: string | null
          source_component?: string | null
          source_system?: string
          started_at?: string
          status?: string | null
          trace_metadata?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "correlation_contexts_initiated_by_application_id_fkey"
            columns: ["initiated_by_application_id"]
            isOneToOne: false
            referencedRelation: "api_gateway_applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "correlation_contexts_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      custom_field_definitions: {
        Row: {
          created_at: string
          field_type: string
          id: string
          name: string
          options: string[] | null
          required: boolean
          team_id: string
        }
        Insert: {
          created_at?: string
          field_type?: string
          id?: string
          name: string
          options?: string[] | null
          required?: boolean
          team_id: string
        }
        Update: {
          created_at?: string
          field_type?: string
          id?: string
          name?: string
          options?: string[] | null
          required?: boolean
          team_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "custom_field_definitions_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      demanda_eventos: {
        Row: {
          created_at: string
          demanda_id: string
          descricao: string
          id: string
          incidencia: string
          redutor: number
          tipo_evento: string
          user_id: string
        }
        Insert: {
          created_at?: string
          demanda_id: string
          descricao?: string
          id?: string
          incidencia?: string
          redutor?: number
          tipo_evento: string
          user_id: string
        }
        Update: {
          created_at?: string
          demanda_id?: string
          descricao?: string
          id?: string
          incidencia?: string
          redutor?: number
          tipo_evento?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "demanda_eventos_demanda_id_fkey"
            columns: ["demanda_id"]
            isOneToOne: false
            referencedRelation: "demandas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "demanda_eventos_demanda_id_fkey"
            columns: ["demanda_id"]
            isOneToOne: false
            referencedRelation: "nome_da_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "demanda_eventos_demanda_id_fkey"
            columns: ["demanda_id"]
            isOneToOne: false
            referencedRelation: "v_sustentacao_orfas"
            referencedColumns: ["id"]
          },
        ]
      }
      demanda_evidencias: {
        Row: {
          created_at: string
          demanda_id: string
          descricao: string | null
          fase: string
          file_name: string | null
          file_path: string | null
          id: string
          mime_type: string | null
          obrigatoria: boolean
          tipo: string
          titulo: string
          url_externa: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          demanda_id: string
          descricao?: string | null
          fase?: string
          file_name?: string | null
          file_path?: string | null
          id?: string
          mime_type?: string | null
          obrigatoria?: boolean
          tipo?: string
          titulo?: string
          url_externa?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          demanda_id?: string
          descricao?: string | null
          fase?: string
          file_name?: string | null
          file_path?: string | null
          id?: string
          mime_type?: string | null
          obrigatoria?: boolean
          tipo?: string
          titulo?: string
          url_externa?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "demanda_evidencias_demanda_id_fkey"
            columns: ["demanda_id"]
            isOneToOne: false
            referencedRelation: "demandas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "demanda_evidencias_demanda_id_fkey"
            columns: ["demanda_id"]
            isOneToOne: false
            referencedRelation: "nome_da_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "demanda_evidencias_demanda_id_fkey"
            columns: ["demanda_id"]
            isOneToOne: false
            referencedRelation: "v_sustentacao_orfas"
            referencedColumns: ["id"]
          },
        ]
      }
      demanda_fases: {
        Row: {
          ativo: boolean
          created_at: string
          id: string
          key: string
          label: string
          ordem: number
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          id?: string
          key: string
          label: string
          ordem?: number
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          id?: string
          key?: string
          label?: string
          ordem?: number
          updated_at?: string
        }
        Relationships: []
      }
      demanda_hours: {
        Row: {
          created_at: string
          demanda_id: string
          descricao: string | null
          fase: string
          horas: number
          id: string
          minutos: number
          user_id: string
        }
        Insert: {
          created_at?: string
          demanda_id: string
          descricao?: string | null
          fase?: string
          horas?: number
          id?: string
          minutos?: number
          user_id: string
        }
        Update: {
          created_at?: string
          demanda_id?: string
          descricao?: string | null
          fase?: string
          horas?: number
          id?: string
          minutos?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "demanda_hours_demanda_id_fkey"
            columns: ["demanda_id"]
            isOneToOne: false
            referencedRelation: "demandas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "demanda_hours_demanda_id_fkey"
            columns: ["demanda_id"]
            isOneToOne: false
            referencedRelation: "nome_da_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "demanda_hours_demanda_id_fkey"
            columns: ["demanda_id"]
            isOneToOne: false
            referencedRelation: "v_sustentacao_orfas"
            referencedColumns: ["id"]
          },
        ]
      }
      demanda_hours_backup_20260511: {
        Row: {
          created_at: string | null
          demanda_id: string | null
          descricao: string | null
          fase: string | null
          horas: number | null
          id: string | null
          minutos: number | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          demanda_id?: string | null
          descricao?: string | null
          fase?: string | null
          horas?: number | null
          id?: string | null
          minutos?: number | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          demanda_id?: string | null
          descricao?: string | null
          fase?: string | null
          horas?: number | null
          id?: string | null
          minutos?: number | null
          user_id?: string | null
        }
        Relationships: []
      }
      demanda_hours_backup_minutos: {
        Row: {
          backup_at: string | null
          created_at: string | null
          demanda_id: string | null
          descricao: string | null
          fase: string | null
          horas_corrigida: number | null
          horas_original: number | null
          id: string | null
          user_id: string | null
        }
        Insert: {
          backup_at?: string | null
          created_at?: string | null
          demanda_id?: string | null
          descricao?: string | null
          fase?: string | null
          horas_corrigida?: number | null
          horas_original?: number | null
          id?: string | null
          user_id?: string | null
        }
        Update: {
          backup_at?: string | null
          created_at?: string | null
          demanda_id?: string | null
          descricao?: string | null
          fase?: string | null
          horas_corrigida?: number | null
          horas_original?: number | null
          id?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      demanda_responsaveis: {
        Row: {
          created_at: string
          demanda_id: string
          id: string
          papel: string
          user_id: string
        }
        Insert: {
          created_at?: string
          demanda_id: string
          id?: string
          papel?: string
          user_id: string
        }
        Update: {
          created_at?: string
          demanda_id?: string
          id?: string
          papel?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "demanda_responsaveis_demanda_id_fkey"
            columns: ["demanda_id"]
            isOneToOne: false
            referencedRelation: "demandas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "demanda_responsaveis_demanda_id_fkey"
            columns: ["demanda_id"]
            isOneToOne: false
            referencedRelation: "nome_da_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "demanda_responsaveis_demanda_id_fkey"
            columns: ["demanda_id"]
            isOneToOne: false
            referencedRelation: "v_sustentacao_orfas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_demanda_responsaveis_user"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      demanda_transitions: {
        Row: {
          created_at: string
          demanda_id: string
          from_status: string | null
          id: string
          justificativa: string | null
          to_status: string
          user_id: string
        }
        Insert: {
          created_at?: string
          demanda_id: string
          from_status?: string | null
          id?: string
          justificativa?: string | null
          to_status: string
          user_id: string
        }
        Update: {
          created_at?: string
          demanda_id?: string
          from_status?: string | null
          id?: string
          justificativa?: string | null
          to_status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "demanda_transitions_demanda_id_fkey"
            columns: ["demanda_id"]
            isOneToOne: false
            referencedRelation: "demandas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "demanda_transitions_demanda_id_fkey"
            columns: ["demanda_id"]
            isOneToOne: false
            referencedRelation: "nome_da_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "demanda_transitions_demanda_id_fkey"
            columns: ["demanda_id"]
            isOneToOne: false
            referencedRelation: "v_sustentacao_orfas"
            referencedColumns: ["id"]
          },
        ]
      }
      demandas: {
        Row: {
          aceite_data: string | null
          aceite_responsavel: string | null
          artefatos_atualizados: string | null
          cobertura_testes: number | null
          contador_rejeicoes: number
          contract_id: string | null
          created_at: string
          data_previsao_encerramento: string | null
          demandante: string | null
          descricao: string | null
          hard_code_identificado: boolean | null
          id: string
          nota_satisfacao: number | null
          originada_diagnostico: boolean
          prazo_inicio_atendimento: string | null
          prazo_solucao: string | null
          project_id: string | null
          projeto: string
          reincidencia_defeito: boolean | null
          responsavel_arquiteto: string | null
          responsavel_dev: string | null
          responsavel_requisitos: string | null
          responsavel_teste: string | null
          rhm: string
          situacao: string
          situacao_changed_at: string
          sla: string
          team_id: string
          tipo: string
          tipo_defeito: string | null
          titulo: string
          total_horas: number | null
          updated_at: string
        }
        Insert: {
          aceite_data?: string | null
          aceite_responsavel?: string | null
          artefatos_atualizados?: string | null
          cobertura_testes?: number | null
          contador_rejeicoes?: number
          contract_id?: string | null
          created_at?: string
          data_previsao_encerramento?: string | null
          demandante?: string | null
          descricao?: string | null
          hard_code_identificado?: boolean | null
          id?: string
          nota_satisfacao?: number | null
          originada_diagnostico?: boolean
          prazo_inicio_atendimento?: string | null
          prazo_solucao?: string | null
          project_id?: string | null
          projeto?: string
          reincidencia_defeito?: boolean | null
          responsavel_arquiteto?: string | null
          responsavel_dev?: string | null
          responsavel_requisitos?: string | null
          responsavel_teste?: string | null
          rhm: string
          situacao?: string
          situacao_changed_at?: string
          sla?: string
          team_id: string
          tipo?: string
          tipo_defeito?: string | null
          titulo?: string
          total_horas?: number | null
          updated_at?: string
        }
        Update: {
          aceite_data?: string | null
          aceite_responsavel?: string | null
          artefatos_atualizados?: string | null
          cobertura_testes?: number | null
          contador_rejeicoes?: number
          contract_id?: string | null
          created_at?: string
          data_previsao_encerramento?: string | null
          demandante?: string | null
          descricao?: string | null
          hard_code_identificado?: boolean | null
          id?: string
          nota_satisfacao?: number | null
          originada_diagnostico?: boolean
          prazo_inicio_atendimento?: string | null
          prazo_solucao?: string | null
          project_id?: string | null
          projeto?: string
          reincidencia_defeito?: boolean | null
          responsavel_arquiteto?: string | null
          responsavel_dev?: string | null
          responsavel_requisitos?: string | null
          responsavel_teste?: string | null
          rhm?: string
          situacao?: string
          situacao_changed_at?: string
          sla?: string
          team_id?: string
          tipo?: string
          tipo_defeito?: string | null
          titulo?: string
          total_horas?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "demandas_aceite_responsavel_fkey"
            columns: ["aceite_responsavel"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "demandas_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "demandas_demandante_fkey"
            columns: ["demandante"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "demandas_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "demandas_responsavel_arquiteto_fkey"
            columns: ["responsavel_arquiteto"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "demandas_responsavel_dev_fkey"
            columns: ["responsavel_dev"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "demandas_responsavel_requisitos_fkey"
            columns: ["responsavel_requisitos"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "demandas_responsavel_teste_fkey"
            columns: ["responsavel_teste"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "demandas_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      deployment_events: {
        Row: {
          branch_name: string | null
          changelog: string | null
          commit_author_email: string | null
          commit_author_name: string | null
          commit_message: string | null
          commit_sha: string
          committed_at: string | null
          correlation_id: string | null
          created_at: string
          deployed_at: string
          deployment_id: string
          duration_seconds: number | null
          environment: string
          failed_at: string | null
          failure_reason: string | null
          finished_at: string | null
          first_commit_at: string | null
          first_commit_sha: string | null
          id: string
          metadata: Json | null
          organization_id: string
          pipeline_id: string | null
          pipeline_url: string | null
          project_id: string | null
          rollback_deployment_id: string | null
          source: string
          status: string
          tag_name: string | null
          team_id: string | null
        }
        Insert: {
          branch_name?: string | null
          changelog?: string | null
          commit_author_email?: string | null
          commit_author_name?: string | null
          commit_message?: string | null
          commit_sha: string
          committed_at?: string | null
          correlation_id?: string | null
          created_at?: string
          deployed_at: string
          deployment_id: string
          duration_seconds?: number | null
          environment?: string
          failed_at?: string | null
          failure_reason?: string | null
          finished_at?: string | null
          first_commit_at?: string | null
          first_commit_sha?: string | null
          id?: string
          metadata?: Json | null
          organization_id: string
          pipeline_id?: string | null
          pipeline_url?: string | null
          project_id?: string | null
          rollback_deployment_id?: string | null
          source: string
          status: string
          tag_name?: string | null
          team_id?: string | null
        }
        Update: {
          branch_name?: string | null
          changelog?: string | null
          commit_author_email?: string | null
          commit_author_name?: string | null
          commit_message?: string | null
          commit_sha?: string
          committed_at?: string | null
          correlation_id?: string | null
          created_at?: string
          deployed_at?: string
          deployment_id?: string
          duration_seconds?: number | null
          environment?: string
          failed_at?: string | null
          failure_reason?: string | null
          finished_at?: string | null
          first_commit_at?: string | null
          first_commit_sha?: string | null
          id?: string
          metadata?: Json | null
          organization_id?: string
          pipeline_id?: string | null
          pipeline_url?: string | null
          project_id?: string | null
          rollback_deployment_id?: string | null
          source?: string
          status?: string
          tag_name?: string | null
          team_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "deployment_events_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deployment_events_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deployment_events_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      developers: {
        Row: {
          avatar: string | null
          created_at: string
          email: string
          id: string
          name: string
          role: string
          team_id: string
          user_id: string | null
        }
        Insert: {
          avatar?: string | null
          created_at?: string
          email: string
          id?: string
          name: string
          role?: string
          team_id: string
          user_id?: string | null
        }
        Update: {
          avatar?: string | null
          created_at?: string
          email?: string
          id?: string
          name?: string
          role?: string
          team_id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "developers_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      dora_metrics_config: {
        Row: {
          calculation_schedule: string | null
          created_at: string
          failure_severities: string[] | null
          failure_sources: string[] | null
          id: string
          incident_attribution_window_hours: number | null
          is_active: boolean | null
          lead_time_percentiles: number[] | null
          mttr_percentiles: number[] | null
          organization_id: string
          production_environments: string[] | null
          production_sources: string[] | null
          project_id: string | null
          team_id: string | null
          updated_at: string
        }
        Insert: {
          calculation_schedule?: string | null
          created_at?: string
          failure_severities?: string[] | null
          failure_sources?: string[] | null
          id?: string
          incident_attribution_window_hours?: number | null
          is_active?: boolean | null
          lead_time_percentiles?: number[] | null
          mttr_percentiles?: number[] | null
          organization_id: string
          production_environments?: string[] | null
          production_sources?: string[] | null
          project_id?: string | null
          team_id?: string | null
          updated_at?: string
        }
        Update: {
          calculation_schedule?: string | null
          created_at?: string
          failure_severities?: string[] | null
          failure_sources?: string[] | null
          id?: string
          incident_attribution_window_hours?: number | null
          is_active?: boolean | null
          lead_time_percentiles?: number[] | null
          mttr_percentiles?: number[] | null
          organization_id?: string
          production_environments?: string[] | null
          production_sources?: string[] | null
          project_id?: string | null
          team_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "dora_metrics_config_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dora_metrics_config_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dora_metrics_config_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      dora_metrics_snapshots: {
        Row: {
          calculated_at: string
          calculation_metadata: Json | null
          change_failure_rate: number | null
          change_failure_rate_benchmark: number | null
          deployment_frequency: number | null
          deployment_frequency_benchmark: number | null
          dora_classification: string | null
          failed_deployments: number | null
          granularity: string
          id: string
          incidents_sev1: number | null
          incidents_sev2: number | null
          incidents_sev3: number | null
          incidents_sev4: number | null
          lead_time_benchmark_seconds: number | null
          lead_time_for_changes_median_seconds: number | null
          lead_time_for_changes_p95_seconds: number | null
          lead_time_for_changes_seconds: number | null
          mttr_benchmark_seconds: number | null
          organization_id: string
          period_end: string
          period_start: string
          project_id: string | null
          resolved_incidents: number | null
          rolled_back_deployments: number | null
          successful_deployments: number | null
          team_id: string | null
          time_to_restore_service_median_seconds: number | null
          time_to_restore_service_p95_seconds: number | null
          time_to_restore_service_seconds: number | null
          total_deployments: number | null
          total_incidents: number | null
        }
        Insert: {
          calculated_at?: string
          calculation_metadata?: Json | null
          change_failure_rate?: number | null
          change_failure_rate_benchmark?: number | null
          deployment_frequency?: number | null
          deployment_frequency_benchmark?: number | null
          dora_classification?: string | null
          failed_deployments?: number | null
          granularity: string
          id?: string
          incidents_sev1?: number | null
          incidents_sev2?: number | null
          incidents_sev3?: number | null
          incidents_sev4?: number | null
          lead_time_benchmark_seconds?: number | null
          lead_time_for_changes_median_seconds?: number | null
          lead_time_for_changes_p95_seconds?: number | null
          lead_time_for_changes_seconds?: number | null
          mttr_benchmark_seconds?: number | null
          organization_id: string
          period_end: string
          period_start: string
          project_id?: string | null
          resolved_incidents?: number | null
          rolled_back_deployments?: number | null
          successful_deployments?: number | null
          team_id?: string | null
          time_to_restore_service_median_seconds?: number | null
          time_to_restore_service_p95_seconds?: number | null
          time_to_restore_service_seconds?: number | null
          total_deployments?: number | null
          total_incidents?: number | null
        }
        Update: {
          calculated_at?: string
          calculation_metadata?: Json | null
          change_failure_rate?: number | null
          change_failure_rate_benchmark?: number | null
          deployment_frequency?: number | null
          deployment_frequency_benchmark?: number | null
          dora_classification?: string | null
          failed_deployments?: number | null
          granularity?: string
          id?: string
          incidents_sev1?: number | null
          incidents_sev2?: number | null
          incidents_sev3?: number | null
          incidents_sev4?: number | null
          lead_time_benchmark_seconds?: number | null
          lead_time_for_changes_median_seconds?: number | null
          lead_time_for_changes_p95_seconds?: number | null
          lead_time_for_changes_seconds?: number | null
          mttr_benchmark_seconds?: number | null
          organization_id?: string
          period_end?: string
          period_start?: string
          project_id?: string | null
          resolved_incidents?: number | null
          rolled_back_deployments?: number | null
          successful_deployments?: number | null
          team_id?: string | null
          time_to_restore_service_median_seconds?: number | null
          time_to_restore_service_p95_seconds?: number | null
          time_to_restore_service_seconds?: number | null
          total_deployments?: number | null
          total_incidents?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "dora_metrics_snapshots_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dora_metrics_snapshots_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dora_metrics_snapshots_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      epics: {
        Row: {
          color: string
          created_at: string
          description: string | null
          id: string
          name: string
          team_id: string
        }
        Insert: {
          color?: string
          created_at?: string
          description?: string | null
          id?: string
          name: string
          team_id: string
        }
        Update: {
          color?: string
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          team_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "epics_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      external_app_user_mappings: {
        Row: {
          axionn_user_id: string | null
          created_at: string
          external_display_name: string | null
          external_email: string | null
          external_groups: string[] | null
          external_user_id: string
          external_username: string | null
          id: string
          integration_id: string | null
          integration_type: string
          is_active: boolean | null
          last_mapped_at: string | null
          mapping_source: string | null
          organization_id: string
          updated_at: string
        }
        Insert: {
          axionn_user_id?: string | null
          created_at?: string
          external_display_name?: string | null
          external_email?: string | null
          external_groups?: string[] | null
          external_user_id: string
          external_username?: string | null
          id?: string
          integration_id?: string | null
          integration_type: string
          is_active?: boolean | null
          last_mapped_at?: string | null
          mapping_source?: string | null
          organization_id: string
          updated_at?: string
        }
        Update: {
          axionn_user_id?: string | null
          created_at?: string
          external_display_name?: string | null
          external_email?: string | null
          external_groups?: string[] | null
          external_user_id?: string
          external_username?: string | null
          id?: string
          integration_id?: string | null
          integration_type?: string
          is_active?: boolean | null
          last_mapped_at?: string | null
          mapping_source?: string | null
          organization_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "external_app_user_mappings_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      feriados: {
        Row: {
          ano: number | null
          ativo: boolean
          created_at: string
          dia: number
          id: string
          mes: number
          nome: string
          team_id: string | null
          tipo: string
          updated_at: string
        }
        Insert: {
          ano?: number | null
          ativo?: boolean
          created_at?: string
          dia: number
          id?: string
          mes: number
          nome: string
          team_id?: string | null
          tipo?: string
          updated_at?: string
        }
        Update: {
          ano?: number | null
          ativo?: boolean
          created_at?: string
          dia?: number
          id?: string
          mes?: number
          nome?: string
          team_id?: string | null
          tipo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "feriados_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      function_point_analyses: {
        Row: {
          ai_breakdown: Json | null
          ai_confidence: number | null
          ai_raw_count: number | null
          ai_reasoning: string | null
          ai_total_pf: number | null
          apf_generation_id: string | null
          baseline_id: string | null
          baseline_version: number | null
          created_at: string
          delta_pf: number | null
          few_shot_count: number | null
          few_shot_examples_used: number | null
          id: string
          is_validated: boolean
          model_used: string | null
          project_id: string
          prompt_version: string | null
          sprint_id: string | null
          story_acceptance_criteria: string | null
          story_code: string | null
          story_context: Json | null
          story_description: string | null
          story_id: string | null
          story_text: string
          story_title: string | null
          team_id: string | null
          updated_at: string | null
          validated_at: string | null
          validated_breakdown: Json | null
          validated_by: string | null
          validated_count: number | null
          validated_total_pf: number | null
          validation_notes: string | null
        }
        Insert: {
          ai_breakdown?: Json | null
          ai_confidence?: number | null
          ai_raw_count?: number | null
          ai_reasoning?: string | null
          ai_total_pf?: number | null
          apf_generation_id?: string | null
          baseline_id?: string | null
          baseline_version?: number | null
          created_at?: string
          delta_pf?: number | null
          few_shot_count?: number | null
          few_shot_examples_used?: number | null
          id?: string
          is_validated?: boolean
          model_used?: string | null
          project_id: string
          prompt_version?: string | null
          sprint_id?: string | null
          story_acceptance_criteria?: string | null
          story_code?: string | null
          story_context?: Json | null
          story_description?: string | null
          story_id?: string | null
          story_text: string
          story_title?: string | null
          team_id?: string | null
          updated_at?: string | null
          validated_at?: string | null
          validated_breakdown?: Json | null
          validated_by?: string | null
          validated_count?: number | null
          validated_total_pf?: number | null
          validation_notes?: string | null
        }
        Update: {
          ai_breakdown?: Json | null
          ai_confidence?: number | null
          ai_raw_count?: number | null
          ai_reasoning?: string | null
          ai_total_pf?: number | null
          apf_generation_id?: string | null
          baseline_id?: string | null
          baseline_version?: number | null
          created_at?: string
          delta_pf?: number | null
          few_shot_count?: number | null
          few_shot_examples_used?: number | null
          id?: string
          is_validated?: boolean
          model_used?: string | null
          project_id?: string
          prompt_version?: string | null
          sprint_id?: string | null
          story_acceptance_criteria?: string | null
          story_code?: string | null
          story_context?: Json | null
          story_description?: string | null
          story_id?: string | null
          story_text?: string
          story_title?: string | null
          team_id?: string | null
          updated_at?: string | null
          validated_at?: string | null
          validated_breakdown?: Json | null
          validated_by?: string | null
          validated_count?: number | null
          validated_total_pf?: number | null
          validation_notes?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "function_point_analyses_baseline_id_fkey"
            columns: ["baseline_id"]
            isOneToOne: false
            referencedRelation: "project_fp_baselines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "function_point_analyses_sprint_id_fkey"
            columns: ["sprint_id"]
            isOneToOne: false
            referencedRelation: "sprints"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "function_point_analyses_sprint_id_fkey"
            columns: ["sprint_id"]
            isOneToOne: false
            referencedRelation: "vw_sprint_pf_summary"
            referencedColumns: ["sprint_id"]
          },
          {
            foreignKeyName: "function_point_analyses_story_id_fkey"
            columns: ["story_id"]
            isOneToOne: false
            referencedRelation: "user_stories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "function_point_analyses_story_id_fkey"
            columns: ["story_id"]
            isOneToOne: false
            referencedRelation: "v_hu_git_summary"
            referencedColumns: ["hu_id"]
          },
          {
            foreignKeyName: "function_point_analyses_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      git_branches: {
        Row: {
          branch_name: string
          commit_sha: string | null
          created_at: string
          hu_ids: string[] | null
          id: string
          integration_id: string
          is_default: boolean | null
          is_protected: boolean | null
          last_pipeline_at: string | null
          last_pipeline_status: string | null
          organization_id: string
          target_branch: string | null
          updated_at: string
        }
        Insert: {
          branch_name: string
          commit_sha?: string | null
          created_at?: string
          hu_ids?: string[] | null
          id?: string
          integration_id: string
          is_default?: boolean | null
          is_protected?: boolean | null
          last_pipeline_at?: string | null
          last_pipeline_status?: string | null
          organization_id: string
          target_branch?: string | null
          updated_at?: string
        }
        Update: {
          branch_name?: string
          commit_sha?: string | null
          created_at?: string
          hu_ids?: string[] | null
          id?: string
          integration_id?: string
          is_default?: boolean | null
          is_protected?: boolean | null
          last_pipeline_at?: string | null
          last_pipeline_status?: string | null
          organization_id?: string
          target_branch?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "git_branches_integration_id_fkey"
            columns: ["integration_id"]
            isOneToOne: false
            referencedRelation: "git_integrations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "git_branches_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      git_commits: {
        Row: {
          author_email: string | null
          author_id: number | null
          author_name: string | null
          author_username: string | null
          branch_name: string | null
          commit_sha: string
          committed_at: string
          committer_email: string | null
          committer_name: string | null
          committer_username: string | null
          created_at: string
          files_changed: Json | null
          hu_ids: string[] | null
          id: string
          integration_id: string
          message: string
          organization_id: string
          parent_shas: string[] | null
          payload: Json | null
          short_sha: string | null
          stats: Json | null
          tag_name: string | null
          web_url: string | null
        }
        Insert: {
          author_email?: string | null
          author_id?: number | null
          author_name?: string | null
          author_username?: string | null
          branch_name?: string | null
          commit_sha: string
          committed_at: string
          committer_email?: string | null
          committer_name?: string | null
          committer_username?: string | null
          created_at?: string
          files_changed?: Json | null
          hu_ids?: string[] | null
          id?: string
          integration_id: string
          message: string
          organization_id: string
          parent_shas?: string[] | null
          payload?: Json | null
          short_sha?: string | null
          stats?: Json | null
          tag_name?: string | null
          web_url?: string | null
        }
        Update: {
          author_email?: string | null
          author_id?: number | null
          author_name?: string | null
          author_username?: string | null
          branch_name?: string | null
          commit_sha?: string
          committed_at?: string
          committer_email?: string | null
          committer_name?: string | null
          committer_username?: string | null
          created_at?: string
          files_changed?: Json | null
          hu_ids?: string[] | null
          id?: string
          integration_id?: string
          message?: string
          organization_id?: string
          parent_shas?: string[] | null
          payload?: Json | null
          short_sha?: string | null
          stats?: Json | null
          tag_name?: string | null
          web_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "git_commits_integration_id_fkey"
            columns: ["integration_id"]
            isOneToOne: false
            referencedRelation: "git_integrations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "git_commits_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      git_events: {
        Row: {
          correlation_id: string | null
          event_action: string | null
          event_type: string
          headers: Json | null
          id: string
          integration_id: string
          organization_id: string
          payload: Json
          processed: boolean | null
          processed_at: string | null
          processing_error: string | null
          provider_event_id: string | null
          received_at: string
          retry_count: number | null
        }
        Insert: {
          correlation_id?: string | null
          event_action?: string | null
          event_type: string
          headers?: Json | null
          id?: string
          integration_id: string
          organization_id: string
          payload: Json
          processed?: boolean | null
          processed_at?: string | null
          processing_error?: string | null
          provider_event_id?: string | null
          received_at?: string
          retry_count?: number | null
        }
        Update: {
          correlation_id?: string | null
          event_action?: string | null
          event_type?: string
          headers?: Json | null
          id?: string
          integration_id?: string
          organization_id?: string
          payload?: Json
          processed?: boolean | null
          processed_at?: string | null
          processing_error?: string | null
          provider_event_id?: string | null
          received_at?: string
          retry_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "git_events_integration_id_fkey"
            columns: ["integration_id"]
            isOneToOne: false
            referencedRelation: "git_integrations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "git_events_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      git_integrations: {
        Row: {
          access_token_encrypted: string | null
          api_url: string | null
          base_url: string
          config_json: Json | null
          created_at: string
          created_by: string | null
          events: string[] | null
          id: string
          is_active: boolean | null
          issue_labels_team_map: Json
          last_sync_at: string | null
          name: string
          organization_id: string
          production_branches: string[] | null
          project_id: string | null
          provider: string
          repository_id: string | null
          repository_name: string | null
          repository_path: string | null
          staging_branches: string[] | null
          sync_error: string | null
          sync_issues_as_backlog: boolean
          sync_status: string | null
          team_id: string | null
          updated_at: string
          webhook_id: string | null
          webhook_secret_encrypted: string | null
          webhook_url: string | null
        }
        Insert: {
          access_token_encrypted?: string | null
          api_url?: string | null
          base_url: string
          config_json?: Json | null
          created_at?: string
          created_by?: string | null
          events?: string[] | null
          id?: string
          is_active?: boolean | null
          issue_labels_team_map?: Json
          last_sync_at?: string | null
          name: string
          organization_id: string
          production_branches?: string[] | null
          project_id?: string | null
          provider: string
          repository_id?: string | null
          repository_name?: string | null
          repository_path?: string | null
          staging_branches?: string[] | null
          sync_error?: string | null
          sync_issues_as_backlog?: boolean
          sync_status?: string | null
          team_id?: string | null
          updated_at?: string
          webhook_id?: string | null
          webhook_secret_encrypted?: string | null
          webhook_url?: string | null
        }
        Update: {
          access_token_encrypted?: string | null
          api_url?: string | null
          base_url?: string
          config_json?: Json | null
          created_at?: string
          created_by?: string | null
          events?: string[] | null
          id?: string
          is_active?: boolean | null
          issue_labels_team_map?: Json
          last_sync_at?: string | null
          name?: string
          organization_id?: string
          production_branches?: string[] | null
          project_id?: string | null
          provider?: string
          repository_id?: string | null
          repository_name?: string | null
          repository_path?: string | null
          staging_branches?: string[] | null
          sync_error?: string | null
          sync_issues_as_backlog?: boolean
          sync_status?: string | null
          team_id?: string | null
          updated_at?: string
          webhook_id?: string | null
          webhook_secret_encrypted?: string | null
          webhook_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "git_integrations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "git_integrations_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "git_integrations_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      git_merge_requests: {
        Row: {
          action: string | null
          approved_at: string | null
          assignee_emails: string[] | null
          author_email: string | null
          author_id: number | null
          author_username: string | null
          closed_at: string | null
          created_at: string
          description: string | null
          first_review_at: string | null
          hu_ids: string[] | null
          id: string
          integration_id: string
          labels: string[] | null
          merge_commit_sha: string | null
          merged_at: string | null
          mr_id: number | null
          mr_iid: number
          organization_id: string
          payload: Json | null
          reviewer_emails: string[] | null
          source_branch: string
          source_sha: string | null
          state: string
          target_branch: string
          target_sha: string | null
          time_to_close_ms: number | null
          time_to_first_review_ms: number | null
          time_to_merge_ms: number | null
          title: string
          updated_at: string
          web_url: string | null
        }
        Insert: {
          action?: string | null
          approved_at?: string | null
          assignee_emails?: string[] | null
          author_email?: string | null
          author_id?: number | null
          author_username?: string | null
          closed_at?: string | null
          created_at: string
          description?: string | null
          first_review_at?: string | null
          hu_ids?: string[] | null
          id?: string
          integration_id: string
          labels?: string[] | null
          merge_commit_sha?: string | null
          merged_at?: string | null
          mr_id?: number | null
          mr_iid: number
          organization_id: string
          payload?: Json | null
          reviewer_emails?: string[] | null
          source_branch: string
          source_sha?: string | null
          state: string
          target_branch: string
          target_sha?: string | null
          time_to_close_ms?: number | null
          time_to_first_review_ms?: number | null
          time_to_merge_ms?: number | null
          title: string
          updated_at: string
          web_url?: string | null
        }
        Update: {
          action?: string | null
          approved_at?: string | null
          assignee_emails?: string[] | null
          author_email?: string | null
          author_id?: number | null
          author_username?: string | null
          closed_at?: string | null
          created_at?: string
          description?: string | null
          first_review_at?: string | null
          hu_ids?: string[] | null
          id?: string
          integration_id?: string
          labels?: string[] | null
          merge_commit_sha?: string | null
          merged_at?: string | null
          mr_id?: number | null
          mr_iid?: number
          organization_id?: string
          payload?: Json | null
          reviewer_emails?: string[] | null
          source_branch?: string
          source_sha?: string | null
          state?: string
          target_branch?: string
          target_sha?: string | null
          time_to_close_ms?: number | null
          time_to_first_review_ms?: number | null
          time_to_merge_ms?: number | null
          title?: string
          updated_at?: string
          web_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "git_merge_requests_integration_id_fkey"
            columns: ["integration_id"]
            isOneToOne: false
            referencedRelation: "git_integrations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "git_merge_requests_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      gitlab_deployment_events: {
        Row: {
          commit_sha: string
          correlation_id: string | null
          created_at: string
          deployable_id: number | null
          deployable_type: string | null
          deployable_url: string | null
          deployed_at: string | null
          deployment_id: number
          environment: string
          finished_at: string | null
          git_event_id: string | null
          id: string
          integration_id: string
          organization_id: string
          payload: Json | null
          project_id: string | null
          status: string
        }
        Insert: {
          commit_sha: string
          correlation_id?: string | null
          created_at?: string
          deployable_id?: number | null
          deployable_type?: string | null
          deployable_url?: string | null
          deployed_at?: string | null
          deployment_id: number
          environment: string
          finished_at?: string | null
          git_event_id?: string | null
          id?: string
          integration_id: string
          organization_id: string
          payload?: Json | null
          project_id?: string | null
          status: string
        }
        Update: {
          commit_sha?: string
          correlation_id?: string | null
          created_at?: string
          deployable_id?: number | null
          deployable_type?: string | null
          deployable_url?: string | null
          deployed_at?: string | null
          deployment_id?: number
          environment?: string
          finished_at?: string | null
          git_event_id?: string | null
          id?: string
          integration_id?: string
          organization_id?: string
          payload?: Json | null
          project_id?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "gitlab_deployment_events_git_event_id_fkey"
            columns: ["git_event_id"]
            isOneToOne: false
            referencedRelation: "git_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gitlab_deployment_events_integration_id_fkey"
            columns: ["integration_id"]
            isOneToOne: false
            referencedRelation: "git_integrations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gitlab_deployment_events_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gitlab_deployment_events_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      gitlab_job_events: {
        Row: {
          correlation_id: string | null
          coverage: number | null
          created_at: string
          duration_seconds: number | null
          finished_at: string | null
          git_event_id: string | null
          id: string
          integration_id: string
          job_id: number
          job_name: string
          organization_id: string
          pipeline_id: number
          runner_id: number | null
          runner_tags: string[] | null
          stage: string | null
          started_at: string | null
          status: string
          web_url: string | null
        }
        Insert: {
          correlation_id?: string | null
          coverage?: number | null
          created_at?: string
          duration_seconds?: number | null
          finished_at?: string | null
          git_event_id?: string | null
          id?: string
          integration_id: string
          job_id: number
          job_name: string
          organization_id: string
          pipeline_id: number
          runner_id?: number | null
          runner_tags?: string[] | null
          stage?: string | null
          started_at?: string | null
          status: string
          web_url?: string | null
        }
        Update: {
          correlation_id?: string | null
          coverage?: number | null
          created_at?: string
          duration_seconds?: number | null
          finished_at?: string | null
          git_event_id?: string | null
          id?: string
          integration_id?: string
          job_id?: number
          job_name?: string
          organization_id?: string
          pipeline_id?: number
          runner_id?: number | null
          runner_tags?: string[] | null
          stage?: string | null
          started_at?: string | null
          status?: string
          web_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "gitlab_job_events_git_event_id_fkey"
            columns: ["git_event_id"]
            isOneToOne: false
            referencedRelation: "git_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gitlab_job_events_integration_id_fkey"
            columns: ["integration_id"]
            isOneToOne: false
            referencedRelation: "git_integrations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gitlab_job_events_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      gitlab_pipeline_events: {
        Row: {
          coverage: number | null
          created_at: string
          duration_seconds: number | null
          finished_at: string | null
          first_commit_at: string | null
          first_commit_sha: string | null
          git_event_id: string | null
          id: string
          integration_id: string
          organization_id: string
          payload: Json | null
          pipeline_id: number
          pipeline_iid: number | null
          project_id: string | null
          ref: string
          sha: string
          source: string | null
          status: string
          updated_at: string
          web_url: string | null
        }
        Insert: {
          coverage?: number | null
          created_at: string
          duration_seconds?: number | null
          finished_at?: string | null
          first_commit_at?: string | null
          first_commit_sha?: string | null
          git_event_id?: string | null
          id?: string
          integration_id: string
          organization_id: string
          payload?: Json | null
          pipeline_id: number
          pipeline_iid?: number | null
          project_id?: string | null
          ref: string
          sha: string
          source?: string | null
          status: string
          updated_at: string
          web_url?: string | null
        }
        Update: {
          coverage?: number | null
          created_at?: string
          duration_seconds?: number | null
          finished_at?: string | null
          first_commit_at?: string | null
          first_commit_sha?: string | null
          git_event_id?: string | null
          id?: string
          integration_id?: string
          organization_id?: string
          payload?: Json | null
          pipeline_id?: number
          pipeline_iid?: number | null
          project_id?: string | null
          ref?: string
          sha?: string
          source?: string | null
          status?: string
          updated_at?: string
          web_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "gitlab_pipeline_events_git_event_id_fkey"
            columns: ["git_event_id"]
            isOneToOne: false
            referencedRelation: "git_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gitlab_pipeline_events_integration_id_fkey"
            columns: ["integration_id"]
            isOneToOne: false
            referencedRelation: "git_integrations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gitlab_pipeline_events_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gitlab_pipeline_events_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      gitlab_user_mappings: {
        Row: {
          axionn_user_id: string | null
          created_at: string
          gitlab_avatar_url: string | null
          gitlab_email: string | null
          gitlab_name: string | null
          gitlab_user_id: number
          gitlab_username: string
          id: string
          integration_id: string
          is_active: boolean | null
          last_synced_at: string | null
          mapping_source: string | null
          organization_id: string
          updated_at: string
        }
        Insert: {
          axionn_user_id?: string | null
          created_at?: string
          gitlab_avatar_url?: string | null
          gitlab_email?: string | null
          gitlab_name?: string | null
          gitlab_user_id: number
          gitlab_username: string
          id?: string
          integration_id: string
          is_active?: boolean | null
          last_synced_at?: string | null
          mapping_source?: string | null
          organization_id: string
          updated_at?: string
        }
        Update: {
          axionn_user_id?: string | null
          created_at?: string
          gitlab_avatar_url?: string | null
          gitlab_email?: string | null
          gitlab_name?: string | null
          gitlab_user_id?: number
          gitlab_username?: string
          id?: string
          integration_id?: string
          is_active?: boolean | null
          last_synced_at?: string | null
          mapping_source?: string | null
          organization_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "gitlab_user_mappings_integration_id_fkey"
            columns: ["integration_id"]
            isOneToOne: false
            referencedRelation: "git_integrations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gitlab_user_mappings_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      graph_connector_entity_mappings: {
        Row: {
          active_filter: Json | null
          connector_config_id: string
          content_fields: string[] | null
          created_at: string
          entity_type: string
          external_id_field: string
          icon_url: string | null
          id: string
          is_active: boolean | null
          last_synced_at: string | null
          last_synced_count: number | null
          metadata_fields: string[] | null
          property_mapping: Json
          sync_schedule: string | null
          title_field: string
          updated_at: string
          url_template: string | null
        }
        Insert: {
          active_filter?: Json | null
          connector_config_id: string
          content_fields?: string[] | null
          created_at?: string
          entity_type: string
          external_id_field: string
          icon_url?: string | null
          id?: string
          is_active?: boolean | null
          last_synced_at?: string | null
          last_synced_count?: number | null
          metadata_fields?: string[] | null
          property_mapping: Json
          sync_schedule?: string | null
          title_field: string
          updated_at?: string
          url_template?: string | null
        }
        Update: {
          active_filter?: Json | null
          connector_config_id?: string
          content_fields?: string[] | null
          created_at?: string
          entity_type?: string
          external_id_field?: string
          icon_url?: string | null
          id?: string
          is_active?: boolean | null
          last_synced_at?: string | null
          last_synced_count?: number | null
          metadata_fields?: string[] | null
          property_mapping?: Json
          sync_schedule?: string | null
          title_field?: string
          updated_at?: string
          url_template?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "graph_connector_entity_mappings_connector_config_id_fkey"
            columns: ["connector_config_id"]
            isOneToOne: false
            referencedRelation: "graph_connectors_config"
            referencedColumns: ["id"]
          },
        ]
      }
      graph_connector_sync_logs: {
        Row: {
          completed_at: string | null
          connector_config_id: string
          correlation_id: string | null
          entity_mapping_id: string | null
          error_details: Json | null
          id: string
          items_failed: number | null
          items_processed: number | null
          items_succeeded: number | null
          started_at: string
          status: string
          sync_type: string
        }
        Insert: {
          completed_at?: string | null
          connector_config_id: string
          correlation_id?: string | null
          entity_mapping_id?: string | null
          error_details?: Json | null
          id?: string
          items_failed?: number | null
          items_processed?: number | null
          items_succeeded?: number | null
          started_at?: string
          status: string
          sync_type: string
        }
        Update: {
          completed_at?: string | null
          connector_config_id?: string
          correlation_id?: string | null
          entity_mapping_id?: string | null
          error_details?: Json | null
          id?: string
          items_failed?: number | null
          items_processed?: number | null
          items_succeeded?: number | null
          started_at?: string
          status?: string
          sync_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "graph_connector_sync_logs_connector_config_id_fkey"
            columns: ["connector_config_id"]
            isOneToOne: false
            referencedRelation: "graph_connectors_config"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "graph_connector_sync_logs_entity_mapping_id_fkey"
            columns: ["entity_mapping_id"]
            isOneToOne: false
            referencedRelation: "graph_connector_entity_mappings"
            referencedColumns: ["id"]
          },
        ]
      }
      graph_connectors_config: {
        Row: {
          connection_id: string
          created_at: string
          created_by: string | null
          description: string | null
          filter_config: Json | null
          id: string
          is_active: boolean | null
          last_sync_at: string | null
          last_sync_error: string | null
          last_sync_items: number | null
          last_sync_status: string | null
          name: string
          organization_id: string
          project_id: string | null
          schema: Json
          sync_schedule: string | null
          sync_strategy: string | null
          updated_at: string
        }
        Insert: {
          connection_id: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          filter_config?: Json | null
          id?: string
          is_active?: boolean | null
          last_sync_at?: string | null
          last_sync_error?: string | null
          last_sync_items?: number | null
          last_sync_status?: string | null
          name: string
          organization_id: string
          project_id?: string | null
          schema: Json
          sync_schedule?: string | null
          sync_strategy?: string | null
          updated_at?: string
        }
        Update: {
          connection_id?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          filter_config?: Json | null
          id?: string
          is_active?: boolean | null
          last_sync_at?: string | null
          last_sync_error?: string | null
          last_sync_items?: number | null
          last_sync_status?: string | null
          name?: string
          organization_id?: string
          project_id?: string | null
          schema?: Json
          sync_schedule?: string | null
          sync_strategy?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "graph_connectors_config_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "graph_connectors_config_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      hu_git_links: {
        Row: {
          correlation_id: string | null
          git_entity_data: Json | null
          git_entity_id: string
          git_entity_type: string
          hu_id: string
          id: string
          integration_id: string | null
          linked_at: string
          linked_by: string | null
          organization_id: string
          project_id: string | null
        }
        Insert: {
          correlation_id?: string | null
          git_entity_data?: Json | null
          git_entity_id: string
          git_entity_type: string
          hu_id: string
          id?: string
          integration_id?: string | null
          linked_at?: string
          linked_by?: string | null
          organization_id: string
          project_id?: string | null
        }
        Update: {
          correlation_id?: string | null
          git_entity_data?: Json | null
          git_entity_id?: string
          git_entity_type?: string
          hu_id?: string
          id?: string
          integration_id?: string | null
          linked_at?: string
          linked_by?: string | null
          organization_id?: string
          project_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "hu_git_links_hu_id_fkey"
            columns: ["hu_id"]
            isOneToOne: false
            referencedRelation: "user_stories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hu_git_links_hu_id_fkey"
            columns: ["hu_id"]
            isOneToOne: false
            referencedRelation: "v_hu_git_summary"
            referencedColumns: ["hu_id"]
          },
          {
            foreignKeyName: "hu_git_links_integration_id_fkey"
            columns: ["integration_id"]
            isOneToOne: false
            referencedRelation: "git_integrations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hu_git_links_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hu_git_links_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      identity_providers: {
        Row: {
          authorization_endpoint: string | null
          claim_mapping: Json | null
          client_id: string
          client_secret_encrypted: string | null
          config_json: Json | null
          created_at: string
          created_by: string | null
          id: string
          is_active: boolean | null
          is_default: boolean | null
          issuer_url: string
          jwks_url: string | null
          name: string
          organization_id: string
          provider_type: string
          scopes: string[] | null
          token_endpoint: string | null
          updated_at: string
          userinfo_endpoint: string | null
        }
        Insert: {
          authorization_endpoint?: string | null
          claim_mapping?: Json | null
          client_id: string
          client_secret_encrypted?: string | null
          config_json?: Json | null
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean | null
          is_default?: boolean | null
          issuer_url: string
          jwks_url?: string | null
          name: string
          organization_id: string
          provider_type: string
          scopes?: string[] | null
          token_endpoint?: string | null
          updated_at?: string
          userinfo_endpoint?: string | null
        }
        Update: {
          authorization_endpoint?: string | null
          claim_mapping?: Json | null
          client_id?: string
          client_secret_encrypted?: string | null
          config_json?: Json | null
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean | null
          is_default?: boolean | null
          issuer_url?: string
          jwks_url?: string | null
          name?: string
          organization_id?: string
          provider_type?: string
          scopes?: string[] | null
          token_endpoint?: string | null
          updated_at?: string
          userinfo_endpoint?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "identity_providers_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      impediments: {
        Row: {
          criticality: string
          has_ticket: boolean
          hu_id: string | null
          id: string
          reason: string
          reported_at: string
          resolution: string | null
          resolved_at: string | null
          sprint_id: string | null
          started_at: string | null
          team_id: string
          ticket_id: string | null
          ticket_url: string | null
          type: string
        }
        Insert: {
          criticality?: string
          has_ticket?: boolean
          hu_id?: string | null
          id?: string
          reason: string
          reported_at?: string
          resolution?: string | null
          resolved_at?: string | null
          sprint_id?: string | null
          started_at?: string | null
          team_id: string
          ticket_id?: string | null
          ticket_url?: string | null
          type?: string
        }
        Update: {
          criticality?: string
          has_ticket?: boolean
          hu_id?: string | null
          id?: string
          reason?: string
          reported_at?: string
          resolution?: string | null
          resolved_at?: string | null
          sprint_id?: string | null
          started_at?: string | null
          team_id?: string
          ticket_id?: string | null
          ticket_url?: string | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "impediments_hu_id_fkey"
            columns: ["hu_id"]
            isOneToOne: false
            referencedRelation: "user_stories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "impediments_hu_id_fkey"
            columns: ["hu_id"]
            isOneToOne: false
            referencedRelation: "v_hu_git_summary"
            referencedColumns: ["hu_id"]
          },
          {
            foreignKeyName: "impediments_sprint_id_fkey"
            columns: ["sprint_id"]
            isOneToOne: false
            referencedRelation: "sprints"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "impediments_sprint_id_fkey"
            columns: ["sprint_id"]
            isOneToOne: false
            referencedRelation: "vw_sprint_pf_summary"
            referencedColumns: ["sprint_id"]
          },
          {
            foreignKeyName: "impediments_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      incident_events: {
        Row: {
          acknowledged_at: string | null
          action_items: string[] | null
          affected_services: string[] | null
          closed_at: string | null
          correlation_id: string | null
          created_at: string
          description: string | null
          detected_at: string | null
          id: string
          incident_id: string
          metadata: Json | null
          organization_id: string
          project_id: string | null
          related_commit_sha: string | null
          related_deployment_id: string | null
          resolution: string | null
          resolved_at: string | null
          root_cause: string | null
          severity: string
          source: string
          started_at: string
          status: string
          tags: string[] | null
          team_id: string | null
          time_to_acknowledge_seconds: number | null
          time_to_detect_seconds: number | null
          time_to_resolve_seconds: number | null
          title: string
          updated_at: string
        }
        Insert: {
          acknowledged_at?: string | null
          action_items?: string[] | null
          affected_services?: string[] | null
          closed_at?: string | null
          correlation_id?: string | null
          created_at?: string
          description?: string | null
          detected_at?: string | null
          id?: string
          incident_id: string
          metadata?: Json | null
          organization_id: string
          project_id?: string | null
          related_commit_sha?: string | null
          related_deployment_id?: string | null
          resolution?: string | null
          resolved_at?: string | null
          root_cause?: string | null
          severity: string
          source: string
          started_at: string
          status?: string
          tags?: string[] | null
          team_id?: string | null
          time_to_acknowledge_seconds?: number | null
          time_to_detect_seconds?: number | null
          time_to_resolve_seconds?: number | null
          title: string
          updated_at?: string
        }
        Update: {
          acknowledged_at?: string | null
          action_items?: string[] | null
          affected_services?: string[] | null
          closed_at?: string | null
          correlation_id?: string | null
          created_at?: string
          description?: string | null
          detected_at?: string | null
          id?: string
          incident_id?: string
          metadata?: Json | null
          organization_id?: string
          project_id?: string | null
          related_commit_sha?: string | null
          related_deployment_id?: string | null
          resolution?: string | null
          resolved_at?: string | null
          root_cause?: string | null
          severity?: string
          source?: string
          started_at?: string
          status?: string
          tags?: string[] | null
          team_id?: string | null
          time_to_acknowledge_seconds?: number | null
          time_to_detect_seconds?: number | null
          time_to_resolve_seconds?: number | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "incident_events_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "incident_events_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "incident_events_related_deployment_id_fkey"
            columns: ["related_deployment_id"]
            isOneToOne: false
            referencedRelation: "deployment_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "incident_events_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      integration_health_events: {
        Row: {
          check_type: string
          checked_at: string
          correlation_id: string | null
          created_at: string
          details: Json
          error_code: string | null
          error_message: string | null
          id: string
          integration_id: string
          latency_ms: number | null
          organization_id: string
          project_id: string | null
          provider: string
          status: string
        }
        Insert: {
          check_type?: string
          checked_at?: string
          correlation_id?: string | null
          created_at?: string
          details?: Json
          error_code?: string | null
          error_message?: string | null
          id?: string
          integration_id: string
          latency_ms?: number | null
          organization_id: string
          project_id?: string | null
          provider: string
          status: string
        }
        Update: {
          check_type?: string
          checked_at?: string
          correlation_id?: string | null
          created_at?: string
          details?: Json
          error_code?: string | null
          error_message?: string | null
          id?: string
          integration_id?: string
          latency_ms?: number | null
          organization_id?: string
          project_id?: string | null
          provider?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "integration_health_events_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "integration_health_events_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      integration_usage_events: {
        Row: {
          correlation_id: string | null
          created_at: string
          duration_ms: number | null
          error_code: string | null
          error_message: string | null
          event_type: string
          external_system: string
          id: string
          integration_type: string
          metadata_json: Json | null
          retry_count: number | null
          status: string
          tenant_id: string
        }
        Insert: {
          correlation_id?: string | null
          created_at?: string
          duration_ms?: number | null
          error_code?: string | null
          error_message?: string | null
          event_type: string
          external_system: string
          id?: string
          integration_type: string
          metadata_json?: Json | null
          retry_count?: number | null
          status: string
          tenant_id: string
        }
        Update: {
          correlation_id?: string | null
          created_at?: string
          duration_ms?: number | null
          error_code?: string | null
          error_message?: string | null
          event_type?: string
          external_system?: string
          id?: string
          integration_type?: string
          metadata_json?: Json | null
          retry_count?: number | null
          status?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "integration_usage_events_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      keycloak_user_mappings: {
        Row: {
          axionn_user_id: string
          created_at: string
          id: string
          identity_provider_id: string
          keycloak_email: string | null
          keycloak_realm: string | null
          keycloak_user_id: string
          keycloak_username: string | null
          last_synced_at: string | null
          organization_id: string
          sync_metadata: Json | null
          sync_status: string | null
          updated_at: string
        }
        Insert: {
          axionn_user_id: string
          created_at?: string
          id?: string
          identity_provider_id: string
          keycloak_email?: string | null
          keycloak_realm?: string | null
          keycloak_user_id: string
          keycloak_username?: string | null
          last_synced_at?: string | null
          organization_id: string
          sync_metadata?: Json | null
          sync_status?: string | null
          updated_at?: string
        }
        Update: {
          axionn_user_id?: string
          created_at?: string
          id?: string
          identity_provider_id?: string
          keycloak_email?: string | null
          keycloak_realm?: string | null
          keycloak_user_id?: string
          keycloak_username?: string | null
          last_synced_at?: string | null
          organization_id?: string
          sync_metadata?: Json | null
          sync_status?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "keycloak_user_mappings_identity_provider_id_fkey"
            columns: ["identity_provider_id"]
            isOneToOne: false
            referencedRelation: "identity_providers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "keycloak_user_mappings_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      licenses: {
        Row: {
          ai_calls_quota: number | null
          ai_calls_used: number
          company_id: string
          created_at: string
          id: string
          pf_quota_month: number | null
          pf_used_month: number
          plan: string
          quota_reset_at: string
          status: string
          updated_at: string
          valid_until: string
        }
        Insert: {
          ai_calls_quota?: number | null
          ai_calls_used?: number
          company_id: string
          created_at?: string
          id?: string
          pf_quota_month?: number | null
          pf_used_month?: number
          plan?: string
          quota_reset_at?: string
          status?: string
          updated_at?: string
          valid_until?: string
        }
        Update: {
          ai_calls_quota?: number | null
          ai_calls_used?: number
          company_id?: string
          created_at?: string
          id?: string
          pf_quota_month?: number | null
          pf_used_month?: number
          plan?: string
          quota_reset_at?: string
          status?: string
          updated_at?: string
          valid_until?: string
        }
        Relationships: [
          {
            foreignKeyName: "licenses_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: true
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      log_retention_policies: {
        Row: {
          archive_after_days: number | null
          archive_storage: string | null
          created_at: string
          created_by: string | null
          id: string
          is_active: boolean | null
          log_type: string
          retention_days: number
          tenant_id: string
          updated_at: string
        }
        Insert: {
          archive_after_days?: number | null
          archive_storage?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean | null
          log_type: string
          retention_days: number
          tenant_id: string
          updated_at?: string
        }
        Update: {
          archive_after_days?: number | null
          archive_storage?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean | null
          log_type?: string
          retention_days?: number
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "log_retention_policies_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      migration_demanda_hours_log: {
        Row: {
          demanda_id: string
          fase: string
          horas_antes: number
          horas_depois: number
          hour_id: string
          id: number
          nota: string | null
          run_at: string
          status: string
          user_id: string
        }
        Insert: {
          demanda_id: string
          fase: string
          horas_antes: number
          horas_depois: number
          hour_id: string
          id?: number
          nota?: string | null
          run_at?: string
          status: string
          user_id: string
        }
        Update: {
          demanda_id?: string
          fase?: string
          horas_antes?: number
          horas_depois?: number
          hour_id?: string
          id?: number
          nota?: string | null
          run_at?: string
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          is_read: boolean
          link_id: string | null
          link_type: string | null
          message: string
          team_id: string
          title: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_read?: boolean
          link_id?: string | null
          link_type?: string | null
          message?: string
          team_id: string
          title: string
          type?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_read?: boolean
          link_id?: string | null
          link_type?: string | null
          message?: string
          team_id?: string
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      okr_alerts: {
        Row: {
          alert_type: string
          deduplication_key: string
          detected_at: string
          id: string
          key_result_id: string | null
          message: string
          metadata: Json
          objective_id: string
          resolved_at: string | null
          severity: string
          status: string
        }
        Insert: {
          alert_type: string
          deduplication_key: string
          detected_at?: string
          id?: string
          key_result_id?: string | null
          message: string
          metadata?: Json
          objective_id: string
          resolved_at?: string | null
          severity?: string
          status?: string
        }
        Update: {
          alert_type?: string
          deduplication_key?: string
          detected_at?: string
          id?: string
          key_result_id?: string | null
          message?: string
          metadata?: Json
          objective_id?: string
          resolved_at?: string | null
          severity?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "okr_alerts_key_result_id_fkey"
            columns: ["key_result_id"]
            isOneToOne: false
            referencedRelation: "okr_key_results"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "okr_alerts_objective_id_fkey"
            columns: ["objective_id"]
            isOneToOne: false
            referencedRelation: "okr_objectives"
            referencedColumns: ["id"]
          },
        ]
      }
      okr_audit_log: {
        Row: {
          action: string
          actor_id: string | null
          after_data: Json | null
          before_data: Json | null
          created_at: string
          id: string
          initiative_id: string | null
          key_result_id: string | null
          metadata: Json
          objective_id: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          after_data?: Json | null
          before_data?: Json | null
          created_at?: string
          id?: string
          initiative_id?: string | null
          key_result_id?: string | null
          metadata?: Json
          objective_id?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          after_data?: Json | null
          before_data?: Json | null
          created_at?: string
          id?: string
          initiative_id?: string | null
          key_result_id?: string | null
          metadata?: Json
          objective_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "okr_audit_log_initiative_id_fkey"
            columns: ["initiative_id"]
            isOneToOne: false
            referencedRelation: "okr_initiatives"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "okr_audit_log_key_result_id_fkey"
            columns: ["key_result_id"]
            isOneToOne: false
            referencedRelation: "okr_key_results"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "okr_audit_log_objective_id_fkey"
            columns: ["objective_id"]
            isOneToOne: false
            referencedRelation: "okr_objectives"
            referencedColumns: ["id"]
          },
        ]
      }
      okr_check_ins: {
        Row: {
          author_id: string | null
          confidence: number | null
          created_at: string
          evidence: Json
          id: string
          key_result_id: string
          next_steps: string | null
          note: string | null
          objective_id: string | null
          previous_value: number | null
          risks: string | null
          summary: string | null
          updated_at: string
          value: number
        }
        Insert: {
          author_id?: string | null
          confidence?: number | null
          created_at?: string
          evidence?: Json
          id?: string
          key_result_id: string
          next_steps?: string | null
          note?: string | null
          objective_id?: string | null
          previous_value?: number | null
          risks?: string | null
          summary?: string | null
          updated_at?: string
          value: number
        }
        Update: {
          author_id?: string | null
          confidence?: number | null
          created_at?: string
          evidence?: Json
          id?: string
          key_result_id?: string
          next_steps?: string | null
          note?: string | null
          objective_id?: string | null
          previous_value?: number | null
          risks?: string | null
          summary?: string | null
          updated_at?: string
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "okr_check_ins_key_result_id_fkey"
            columns: ["key_result_id"]
            isOneToOne: false
            referencedRelation: "okr_key_results"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "okr_check_ins_objective_id_fkey"
            columns: ["objective_id"]
            isOneToOne: false
            referencedRelation: "okr_objectives"
            referencedColumns: ["id"]
          },
        ]
      }
      okr_initiatives: {
        Row: {
          completed_at: string | null
          created_at: string
          created_by: string | null
          description: string | null
          due_date: string | null
          id: string
          key_result_id: string | null
          linked_entity_id: string | null
          linked_entity_type: string | null
          objective_id: string
          owner_id: string | null
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          key_result_id?: string | null
          linked_entity_id?: string | null
          linked_entity_type?: string | null
          objective_id: string
          owner_id?: string | null
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          key_result_id?: string | null
          linked_entity_id?: string | null
          linked_entity_type?: string | null
          objective_id?: string
          owner_id?: string | null
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "okr_initiatives_key_result_id_fkey"
            columns: ["key_result_id"]
            isOneToOne: false
            referencedRelation: "okr_key_results"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "okr_initiatives_objective_id_fkey"
            columns: ["objective_id"]
            isOneToOne: false
            referencedRelation: "okr_objectives"
            referencedColumns: ["id"]
          },
        ]
      }
      okr_key_result_snapshots: {
        Row: {
          calculated_progress: number | null
          calculation_metadata: Json
          created_at: string
          formula_version: string | null
          health: string
          id: string
          idempotency_key: string | null
          items_considered: number | null
          key_result_id: string
          measured_at: string
          measured_value: number | null
          measurement_quality: string
          period_end: string | null
          period_start: string | null
          raw_progress: number | null
          scope_id: string | null
          scope_type: string | null
          source: string | null
          triggered_by_id: string | null
          triggered_by_type: string
        }
        Insert: {
          calculated_progress?: number | null
          calculation_metadata?: Json
          created_at?: string
          formula_version?: string | null
          health?: string
          id?: string
          idempotency_key?: string | null
          items_considered?: number | null
          key_result_id: string
          measured_at?: string
          measured_value?: number | null
          measurement_quality?: string
          period_end?: string | null
          period_start?: string | null
          raw_progress?: number | null
          scope_id?: string | null
          scope_type?: string | null
          source?: string | null
          triggered_by_id?: string | null
          triggered_by_type?: string
        }
        Update: {
          calculated_progress?: number | null
          calculation_metadata?: Json
          created_at?: string
          formula_version?: string | null
          health?: string
          id?: string
          idempotency_key?: string | null
          items_considered?: number | null
          key_result_id?: string
          measured_at?: string
          measured_value?: number | null
          measurement_quality?: string
          period_end?: string | null
          period_start?: string | null
          raw_progress?: number | null
          scope_id?: string | null
          scope_type?: string | null
          source?: string | null
          triggered_by_id?: string | null
          triggered_by_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "okr_key_result_snapshots_key_result_id_fkey"
            columns: ["key_result_id"]
            isOneToOne: false
            referencedRelation: "okr_key_results"
            referencedColumns: ["id"]
          },
        ]
      }
      okr_key_results: {
        Row: {
          baseline_value: number | null
          calculated_health: string
          calculated_progress: number | null
          created_at: string
          created_by: string | null
          current: number
          current_value: number | null
          description: string | null
          direction: string
          end_date: string | null
          formula_version: string | null
          frequency: string
          id: string
          last_measured_at: string | null
          lifecycle_status: string
          measurement_quality: string
          metric_code: string | null
          metric_config: Json
          objective_id: string
          owner_id: string | null
          raw_progress: number | null
          source_label: string | null
          start_date: string | null
          target: number
          target_max: number | null
          target_min: number | null
          target_value: number | null
          title: string
          unit: string
          update_type: string
          updated_at: string
          updated_by: string | null
          weight: number | null
        }
        Insert: {
          baseline_value?: number | null
          calculated_health?: string
          calculated_progress?: number | null
          created_at?: string
          created_by?: string | null
          current?: number
          current_value?: number | null
          description?: string | null
          direction?: string
          end_date?: string | null
          formula_version?: string | null
          frequency?: string
          id?: string
          last_measured_at?: string | null
          lifecycle_status?: string
          measurement_quality?: string
          metric_code?: string | null
          metric_config?: Json
          objective_id: string
          owner_id?: string | null
          raw_progress?: number | null
          source_label?: string | null
          start_date?: string | null
          target?: number
          target_max?: number | null
          target_min?: number | null
          target_value?: number | null
          title: string
          unit?: string
          update_type?: string
          updated_at?: string
          updated_by?: string | null
          weight?: number | null
        }
        Update: {
          baseline_value?: number | null
          calculated_health?: string
          calculated_progress?: number | null
          created_at?: string
          created_by?: string | null
          current?: number
          current_value?: number | null
          description?: string | null
          direction?: string
          end_date?: string | null
          formula_version?: string | null
          frequency?: string
          id?: string
          last_measured_at?: string | null
          lifecycle_status?: string
          measurement_quality?: string
          metric_code?: string | null
          metric_config?: Json
          objective_id?: string
          owner_id?: string | null
          raw_progress?: number | null
          source_label?: string | null
          start_date?: string | null
          target?: number
          target_max?: number | null
          target_min?: number | null
          target_value?: number | null
          title?: string
          unit?: string
          update_type?: string
          updated_at?: string
          updated_by?: string | null
          weight?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "okr_key_results_objective_id_fkey"
            columns: ["objective_id"]
            isOneToOne: false
            referencedRelation: "okr_objectives"
            referencedColumns: ["id"]
          },
        ]
      }
      okr_objectives: {
        Row: {
          calculated_health: string
          calculated_progress: number | null
          created_at: string
          created_by: string | null
          cycle: string
          description: string | null
          end_date: string | null
          health_override_at: string | null
          health_override_by: string | null
          health_override_reason: string | null
          health_reason: string | null
          id: string
          last_calculated_at: string | null
          legacy_progress: number | null
          lifecycle_status: string
          manual_health_override: string | null
          measurement_status: string
          owner_id: string | null
          progress: number
          scope_type: string
          start_date: string | null
          status: string
          team_id: string | null
          title: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          calculated_health?: string
          calculated_progress?: number | null
          created_at?: string
          created_by?: string | null
          cycle: string
          description?: string | null
          end_date?: string | null
          health_override_at?: string | null
          health_override_by?: string | null
          health_override_reason?: string | null
          health_reason?: string | null
          id?: string
          last_calculated_at?: string | null
          legacy_progress?: number | null
          lifecycle_status?: string
          manual_health_override?: string | null
          measurement_status?: string
          owner_id?: string | null
          progress?: number
          scope_type?: string
          start_date?: string | null
          status?: string
          team_id?: string | null
          title: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          calculated_health?: string
          calculated_progress?: number | null
          created_at?: string
          created_by?: string | null
          cycle?: string
          description?: string | null
          end_date?: string | null
          health_override_at?: string | null
          health_override_by?: string | null
          health_override_reason?: string | null
          health_reason?: string | null
          id?: string
          last_calculated_at?: string | null
          legacy_progress?: number | null
          lifecycle_status?: string
          manual_health_override?: string | null
          measurement_status?: string
          owner_id?: string | null
          progress?: number
          scope_type?: string
          start_date?: string | null
          status?: string
          team_id?: string | null
          title?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "okr_objectives_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      okr_recalculation_queue: {
        Row: {
          attempts: number
          available_at: string
          created_at: string
          id: string
          idempotency_key: string
          last_error: string | null
          locked_at: string | null
          objective_id: string
          processed_at: string | null
          reason: string
          status: string
        }
        Insert: {
          attempts?: number
          available_at?: string
          created_at?: string
          id?: string
          idempotency_key: string
          last_error?: string | null
          locked_at?: string | null
          objective_id: string
          processed_at?: string | null
          reason: string
          status?: string
        }
        Update: {
          attempts?: number
          available_at?: string
          created_at?: string
          id?: string
          idempotency_key?: string
          last_error?: string | null
          locked_at?: string | null
          objective_id?: string
          processed_at?: string | null
          reason?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "okr_recalculation_queue_objective_id_fkey"
            columns: ["objective_id"]
            isOneToOne: false
            referencedRelation: "okr_objectives"
            referencedColumns: ["id"]
          },
        ]
      }
      oracle_integrations: {
        Row: {
          config_json: Json | null
          connection_test_error: string | null
          connection_test_status: string | null
          connection_type: string
          created_at: string
          created_by: string | null
          host: string | null
          id: string
          is_active: boolean | null
          jobs: Json | null
          last_connection_test: string | null
          name: string
          organization_id: string
          password_encrypted: string
          pool_increment: number | null
          pool_max: number | null
          pool_min: number | null
          port: number | null
          project_id: string | null
          proxy_url: string | null
          service_name: string | null
          sid: string | null
          tls_config: Json | null
          tns_alias: string | null
          updated_at: string
          use_tls: boolean | null
          username: string
          wallet_path: string | null
        }
        Insert: {
          config_json?: Json | null
          connection_test_error?: string | null
          connection_test_status?: string | null
          connection_type?: string
          created_at?: string
          created_by?: string | null
          host?: string | null
          id?: string
          is_active?: boolean | null
          jobs?: Json | null
          last_connection_test?: string | null
          name: string
          organization_id: string
          password_encrypted: string
          pool_increment?: number | null
          pool_max?: number | null
          pool_min?: number | null
          port?: number | null
          project_id?: string | null
          proxy_url?: string | null
          service_name?: string | null
          sid?: string | null
          tls_config?: Json | null
          tns_alias?: string | null
          updated_at?: string
          use_tls?: boolean | null
          username: string
          wallet_path?: string | null
        }
        Update: {
          config_json?: Json | null
          connection_test_error?: string | null
          connection_test_status?: string | null
          connection_type?: string
          created_at?: string
          created_by?: string | null
          host?: string | null
          id?: string
          is_active?: boolean | null
          jobs?: Json | null
          last_connection_test?: string | null
          name?: string
          organization_id?: string
          password_encrypted?: string
          pool_increment?: number | null
          pool_max?: number | null
          pool_min?: number | null
          port?: number | null
          project_id?: string | null
          proxy_url?: string | null
          service_name?: string | null
          sid?: string | null
          tls_config?: Json | null
          tns_alias?: string | null
          updated_at?: string
          use_tls?: boolean | null
          username?: string
          wallet_path?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "oracle_integrations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "oracle_integrations_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      oracle_sync_events: {
        Row: {
          bytes_processed: number | null
          completed_at: string | null
          correlation_id: string | null
          error_details: Json | null
          error_sample: Json | null
          extract_checkpoint: Json | null
          extract_duration_ms: number | null
          id: string
          integration_id: string
          job_id: string
          load_duration_ms: number | null
          organization_id: string
          rows_extracted: number | null
          rows_failed: number | null
          rows_loaded: number | null
          rows_transformed: number | null
          run_id: string
          started_at: string
          status: string
          total_duration_ms: number | null
          transform_checkpoint: Json | null
          transform_duration_ms: number | null
          trigger_type: string | null
        }
        Insert: {
          bytes_processed?: number | null
          completed_at?: string | null
          correlation_id?: string | null
          error_details?: Json | null
          error_sample?: Json | null
          extract_checkpoint?: Json | null
          extract_duration_ms?: number | null
          id?: string
          integration_id: string
          job_id: string
          load_duration_ms?: number | null
          organization_id: string
          rows_extracted?: number | null
          rows_failed?: number | null
          rows_loaded?: number | null
          rows_transformed?: number | null
          run_id?: string
          started_at?: string
          status: string
          total_duration_ms?: number | null
          transform_checkpoint?: Json | null
          transform_duration_ms?: number | null
          trigger_type?: string | null
        }
        Update: {
          bytes_processed?: number | null
          completed_at?: string | null
          correlation_id?: string | null
          error_details?: Json | null
          error_sample?: Json | null
          extract_checkpoint?: Json | null
          extract_duration_ms?: number | null
          id?: string
          integration_id?: string
          job_id?: string
          load_duration_ms?: number | null
          organization_id?: string
          rows_extracted?: number | null
          rows_failed?: number | null
          rows_loaded?: number | null
          rows_transformed?: number | null
          run_id?: string
          started_at?: string
          status?: string
          total_duration_ms?: number | null
          transform_checkpoint?: Json | null
          transform_duration_ms?: number | null
          trigger_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "oracle_sync_events_integration_id_fkey"
            columns: ["integration_id"]
            isOneToOne: false
            referencedRelation: "oracle_integrations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "oracle_sync_events_integration_id_fkey"
            columns: ["integration_id"]
            isOneToOne: false
            referencedRelation: "v_oracle_job_health"
            referencedColumns: ["integration_id"]
          },
          {
            foreignKeyName: "oracle_sync_events_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "oracle_sync_jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "oracle_sync_events_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "v_oracle_job_health"
            referencedColumns: ["job_id"]
          },
          {
            foreignKeyName: "oracle_sync_events_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      oracle_sync_jobs: {
        Row: {
          batch_size: number | null
          column_mapping: Json | null
          config_json: Json | null
          created_at: string
          created_by: string | null
          description: string | null
          extraction_strategy: string
          id: string
          incremental_column: string | null
          incremental_watermark: string | null
          integration_id: string
          is_active: boolean | null
          job_type: string
          last_run_at: string | null
          last_run_duration_ms: number | null
          last_run_error: string | null
          last_run_rows: number | null
          last_run_status: string | null
          max_retries: number | null
          name: string
          next_run_at: string | null
          organization_id: string
          retry_delay_seconds: number | null
          schedule: string | null
          source_query: string | null
          source_schema: string | null
          source_table: string | null
          target_schema: string | null
          target_table: string | null
          timeout_seconds: number | null
          timezone: string | null
          transform_sql: string | null
          updated_at: string
        }
        Insert: {
          batch_size?: number | null
          column_mapping?: Json | null
          config_json?: Json | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          extraction_strategy: string
          id?: string
          incremental_column?: string | null
          incremental_watermark?: string | null
          integration_id: string
          is_active?: boolean | null
          job_type: string
          last_run_at?: string | null
          last_run_duration_ms?: number | null
          last_run_error?: string | null
          last_run_rows?: number | null
          last_run_status?: string | null
          max_retries?: number | null
          name: string
          next_run_at?: string | null
          organization_id: string
          retry_delay_seconds?: number | null
          schedule?: string | null
          source_query?: string | null
          source_schema?: string | null
          source_table?: string | null
          target_schema?: string | null
          target_table?: string | null
          timeout_seconds?: number | null
          timezone?: string | null
          transform_sql?: string | null
          updated_at?: string
        }
        Update: {
          batch_size?: number | null
          column_mapping?: Json | null
          config_json?: Json | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          extraction_strategy?: string
          id?: string
          incremental_column?: string | null
          incremental_watermark?: string | null
          integration_id?: string
          is_active?: boolean | null
          job_type?: string
          last_run_at?: string | null
          last_run_duration_ms?: number | null
          last_run_error?: string | null
          last_run_rows?: number | null
          last_run_status?: string | null
          max_retries?: number | null
          name?: string
          next_run_at?: string | null
          organization_id?: string
          retry_delay_seconds?: number | null
          schedule?: string | null
          source_query?: string | null
          source_schema?: string | null
          source_table?: string | null
          target_schema?: string | null
          target_table?: string | null
          timeout_seconds?: number | null
          timezone?: string | null
          transform_sql?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "oracle_sync_jobs_integration_id_fkey"
            columns: ["integration_id"]
            isOneToOne: false
            referencedRelation: "oracle_integrations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "oracle_sync_jobs_integration_id_fkey"
            columns: ["integration_id"]
            isOneToOne: false
            referencedRelation: "v_oracle_job_health"
            referencedColumns: ["integration_id"]
          },
          {
            foreignKeyName: "oracle_sync_jobs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_entitlement_overrides: {
        Row: {
          created_at: string
          created_by: string | null
          enabled: boolean | null
          feature_key: string
          id: string
          limit_value: number | null
          metadata: Json
          org_id: string
          reason: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          enabled?: boolean | null
          feature_key: string
          id?: string
          limit_value?: number | null
          metadata?: Json
          org_id: string
          reason?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          enabled?: boolean | null
          feature_key?: string
          id?: string
          limit_value?: number | null
          metadata?: Json
          org_id?: string
          reason?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_entitlement_overrides_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_invitations: {
        Row: {
          accepted_at: string | null
          accepted_by: string | null
          created_at: string
          email: string
          expires_at: string
          id: string
          invited_by: string
          last_sent_at: string
          metadata: Json
          module_keys: string[]
          org_id: string
          revoked_at: string | null
          revoked_by: string | null
          role: Database["public"]["Enums"]["org_member_role"]
          send_count: number
          status: string
          token_hash: string
          updated_at: string
        }
        Insert: {
          accepted_at?: string | null
          accepted_by?: string | null
          created_at?: string
          email: string
          expires_at: string
          id?: string
          invited_by: string
          last_sent_at?: string
          metadata?: Json
          module_keys?: string[]
          org_id: string
          revoked_at?: string | null
          revoked_by?: string | null
          role?: Database["public"]["Enums"]["org_member_role"]
          send_count?: number
          status?: string
          token_hash: string
          updated_at?: string
        }
        Update: {
          accepted_at?: string | null
          accepted_by?: string | null
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          invited_by?: string
          last_sent_at?: string
          metadata?: Json
          module_keys?: string[]
          org_id?: string
          revoked_at?: string | null
          revoked_by?: string | null
          role?: Database["public"]["Enums"]["org_member_role"]
          send_count?: number
          status?: string
          token_hash?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_invitations_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_member_modules: {
        Row: {
          assigned_by: string | null
          created_at: string
          id: string
          module_key: string
          org_id: string
          role_name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          assigned_by?: string | null
          created_at?: string
          id?: string
          module_key: string
          org_id: string
          role_name?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          assigned_by?: string | null
          created_at?: string
          id?: string
          module_key?: string
          org_id?: string
          role_name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_member_modules_org_id_user_id_fkey"
            columns: ["org_id", "user_id"]
            isOneToOne: false
            referencedRelation: "organization_members"
            referencedColumns: ["org_id", "user_id"]
          },
        ]
      }
      organization_members: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          org_id: string
          role: Database["public"]["Enums"]["org_member_role"]
          updated_at: string
          updated_by: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          org_id: string
          role?: Database["public"]["Enums"]["org_member_role"]
          updated_at?: string
          updated_by?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          org_id?: string
          role?: Database["public"]["Enums"]["org_member_role"]
          updated_at?: string
          updated_by?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_members_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_membership_audit_log: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          details: Json
          id: string
          invitation_id: string | null
          org_id: string
          subject_user_id: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          details?: Json
          id?: string
          invitation_id?: string | null
          org_id: string
          subject_user_id?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          details?: Json
          id?: string
          invitation_id?: string | null
          org_id?: string
          subject_user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "organization_membership_audit_log_invitation_id_fkey"
            columns: ["invitation_id"]
            isOneToOne: false
            referencedRelation: "organization_invitations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organization_membership_audit_log_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_operational_audit_log: {
        Row: {
          action: string
          actor_id: string | null
          after_values: Json
          before_values: Json
          changed_fields: string[]
          created_at: string
          id: string
          metadata: Json
          org_id: string
          resource_id: string | null
          resource_type: string
        }
        Insert: {
          action: string
          actor_id?: string | null
          after_values?: Json
          before_values?: Json
          changed_fields?: string[]
          created_at?: string
          id?: string
          metadata?: Json
          org_id: string
          resource_id?: string | null
          resource_type: string
        }
        Update: {
          action?: string
          actor_id?: string | null
          after_values?: Json
          before_values?: Json
          changed_fields?: string[]
          created_at?: string
          id?: string
          metadata?: Json
          org_id?: string
          resource_id?: string | null
          resource_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_operational_audit_log_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_settings_audit_log: {
        Row: {
          action: string
          actor_id: string | null
          after_values: Json
          before_values: Json
          changed_fields: string[]
          created_at: string
          id: string
          org_id: string
        }
        Insert: {
          action?: string
          actor_id?: string | null
          after_values?: Json
          before_values?: Json
          changed_fields?: string[]
          created_at?: string
          id?: string
          org_id: string
        }
        Update: {
          action?: string
          actor_id?: string | null
          after_values?: Json
          before_values?: Json
          changed_fields?: string[]
          created_at?: string
          id?: string
          org_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_settings_audit_log_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_subscriptions: {
        Row: {
          canceled_at: string | null
          created_at: string
          current_period_end: string | null
          current_period_start: string | null
          external_customer_id: string | null
          external_subscription_id: string | null
          id: string
          metadata: Json
          org_id: string
          plan_id: string
          source: string
          starts_at: string
          status: string
          trial_ends_at: string | null
          updated_at: string
        }
        Insert: {
          canceled_at?: string | null
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          external_customer_id?: string | null
          external_subscription_id?: string | null
          id?: string
          metadata?: Json
          org_id: string
          plan_id: string
          source?: string
          starts_at?: string
          status: string
          trial_ends_at?: string | null
          updated_at?: string
        }
        Update: {
          canceled_at?: string | null
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          external_customer_id?: string | null
          external_subscription_id?: string | null
          id?: string
          metadata?: Json
          org_id?: string
          plan_id?: string
          source?: string
          starts_at?: string
          status?: string
          trial_ends_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_subscriptions_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organization_subscriptions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "saas_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          contact_email: string | null
          contact_name: string | null
          created_at: string
          id: string
          logo_url: string | null
          max_countings_per_month: number
          max_projects: number
          max_users: number
          name: string
          plan: Database["public"]["Enums"]["org_plan"]
          slug: string
          status: Database["public"]["Enums"]["org_status"]
          trial_ends_at: string | null
          updated_at: string
        }
        Insert: {
          contact_email?: string | null
          contact_name?: string | null
          created_at?: string
          id?: string
          logo_url?: string | null
          max_countings_per_month?: number
          max_projects?: number
          max_users?: number
          name: string
          plan?: Database["public"]["Enums"]["org_plan"]
          slug: string
          status?: Database["public"]["Enums"]["org_status"]
          trial_ends_at?: string | null
          updated_at?: string
        }
        Update: {
          contact_email?: string | null
          contact_name?: string | null
          created_at?: string
          id?: string
          logo_url?: string | null
          max_countings_per_month?: number
          max_projects?: number
          max_users?: number
          name?: string
          plan?: Database["public"]["Enums"]["org_plan"]
          slug?: string
          status?: Database["public"]["Enums"]["org_status"]
          trial_ends_at?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      owner_staff_members: {
        Row: {
          avatar_url: string | null
          created_at: string
          department: string | null
          email: string
          full_name: string
          id: string
          is_active: boolean
          last_login_at: string | null
          role: string
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          department?: string | null
          email: string
          full_name: string
          id?: string
          is_active?: boolean
          last_login_at?: string | null
          role: string
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          department?: string | null
          email?: string
          full_name?: string
          id?: string
          is_active?: boolean
          last_login_at?: string | null
          role?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      planning_participants: {
        Row: {
          id: string
          is_facilitator: boolean
          is_online: boolean
          joined_at: string
          last_seen_at: string
          session_id: string
          user_id: string
        }
        Insert: {
          id?: string
          is_facilitator?: boolean
          is_online?: boolean
          joined_at?: string
          last_seen_at?: string
          session_id: string
          user_id: string
        }
        Update: {
          id?: string
          is_facilitator?: boolean
          is_online?: boolean
          joined_at?: string
          last_seen_at?: string
          session_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "planning_participants_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "planning_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      planning_rounds: {
        Row: {
          created_at: string
          facilitator_id: string | null
          hu_id: string
          id: string
          result_hours: number | null
          result_value: string | null
          revealed_at: string | null
          round_number: number
          saved_at: string | null
          session_id: string
          status: string
        }
        Insert: {
          created_at?: string
          facilitator_id?: string | null
          hu_id: string
          id?: string
          result_hours?: number | null
          result_value?: string | null
          revealed_at?: string | null
          round_number?: number
          saved_at?: string | null
          session_id: string
          status?: string
        }
        Update: {
          created_at?: string
          facilitator_id?: string | null
          hu_id?: string
          id?: string
          result_hours?: number | null
          result_value?: string | null
          revealed_at?: string | null
          round_number?: number
          saved_at?: string | null
          session_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "planning_rounds_hu_id_fkey"
            columns: ["hu_id"]
            isOneToOne: false
            referencedRelation: "user_stories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "planning_rounds_hu_id_fkey"
            columns: ["hu_id"]
            isOneToOne: false
            referencedRelation: "v_hu_git_summary"
            referencedColumns: ["hu_id"]
          },
          {
            foreignKeyName: "planning_rounds_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "planning_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      planning_sessao_itens: {
        Row: {
          carta: string | null
          created_at: string | null
          horas: number | null
          hu_codigo: string
          hu_id: string
          hu_titulo: string | null
          id: string
          pontos: number | null
          session_id: string
        }
        Insert: {
          carta?: string | null
          created_at?: string | null
          horas?: number | null
          hu_codigo: string
          hu_id: string
          hu_titulo?: string | null
          id?: string
          pontos?: number | null
          session_id: string
        }
        Update: {
          carta?: string | null
          created_at?: string | null
          horas?: number | null
          hu_codigo?: string
          hu_id?: string
          hu_titulo?: string | null
          id?: string
          pontos?: number | null
          session_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "planning_sessao_itens_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "planning_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      planning_sessions: {
        Row: {
          created_at: string
          created_by: string
          deck_config: Json | null
          deck_mode: string
          finished_at: string | null
          id: string
          sprint_id: string
          status: string
          team_id: string
          total_horas: number | null
          total_hus: number | null
        }
        Insert: {
          created_at?: string
          created_by: string
          deck_config?: Json | null
          deck_mode?: string
          finished_at?: string | null
          id?: string
          sprint_id: string
          status?: string
          team_id: string
          total_horas?: number | null
          total_hus?: number | null
        }
        Update: {
          created_at?: string
          created_by?: string
          deck_config?: Json | null
          deck_mode?: string
          finished_at?: string | null
          id?: string
          sprint_id?: string
          status?: string
          team_id?: string
          total_horas?: number | null
          total_hus?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "planning_sessions_sprint_id_fkey"
            columns: ["sprint_id"]
            isOneToOne: false
            referencedRelation: "sprints"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "planning_sessions_sprint_id_fkey"
            columns: ["sprint_id"]
            isOneToOne: false
            referencedRelation: "vw_sprint_pf_summary"
            referencedColumns: ["sprint_id"]
          },
          {
            foreignKeyName: "planning_sessions_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      planning_votes: {
        Row: {
          created_at: string
          hu_id: string
          id: string
          revealed: boolean
          session_id: string
          user_id: string
          vote_value: string
        }
        Insert: {
          created_at?: string
          hu_id: string
          id?: string
          revealed?: boolean
          session_id: string
          user_id: string
          vote_value: string
        }
        Update: {
          created_at?: string
          hu_id?: string
          id?: string
          revealed?: boolean
          session_id?: string
          user_id?: string
          vote_value?: string
        }
        Relationships: [
          {
            foreignKeyName: "planning_votes_hu_id_fkey"
            columns: ["hu_id"]
            isOneToOne: false
            referencedRelation: "user_stories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "planning_votes_hu_id_fkey"
            columns: ["hu_id"]
            isOneToOne: false
            referencedRelation: "v_hu_git_summary"
            referencedColumns: ["hu_id"]
          },
          {
            foreignKeyName: "planning_votes_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "planning_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_operational_audit_log: {
        Row: {
          action: string
          actor_id: string | null
          after_values: Json
          before_values: Json
          created_at: string
          id: string
          metadata: Json
          resource_id: string | null
          resource_type: string
        }
        Insert: {
          action: string
          actor_id?: string | null
          after_values?: Json
          before_values?: Json
          created_at?: string
          id?: string
          metadata?: Json
          resource_id?: string | null
          resource_type: string
        }
        Update: {
          action?: string
          actor_id?: string | null
          after_values?: Json
          before_values?: Json
          created_at?: string
          id?: string
          metadata?: Json
          resource_id?: string | null
          resource_type?: string
        }
        Relationships: []
      }
      platform_user_roles: {
        Row: {
          created_at: string
          created_by: string | null
          role: string
          user_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          role: string
          user_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          role?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string
          email: string
          full_name: string | null
          id: string
          is_active: boolean
          module_access: string
          must_change_password: boolean
          team_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string
          email?: string
          full_name?: string | null
          id?: string
          is_active?: boolean
          module_access?: string
          must_change_password?: boolean
          team_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string
          email?: string
          full_name?: string | null
          id?: string
          is_active?: boolean
          module_access?: string
          must_change_password?: boolean
          team_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      project_fp_baselines: {
        Row: {
          additional_instructions: string
          anchor_examples: Json
          complexity_rules: Json
          created_at: string
          created_by: string | null
          domain_context: string
          function_type_criteria: Json
          id: string
          project_id: string
          status: string
          technology_stack: string[]
          updated_at: string
          version: number
        }
        Insert: {
          additional_instructions?: string
          anchor_examples?: Json
          complexity_rules?: Json
          created_at?: string
          created_by?: string | null
          domain_context?: string
          function_type_criteria?: Json
          id?: string
          project_id: string
          status?: string
          technology_stack?: string[]
          updated_at?: string
          version?: number
        }
        Update: {
          additional_instructions?: string
          anchor_examples?: Json
          complexity_rules?: Json
          created_at?: string
          created_by?: string | null
          domain_context?: string
          function_type_criteria?: Json
          id?: string
          project_id?: string
          status?: string
          technology_stack?: string[]
          updated_at?: string
          version?: number
        }
        Relationships: []
      }
      project_teams: {
        Row: {
          created_at: string
          id: string
          project_id: string
          role: string
          team_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          project_id: string
          role?: string
          team_id: string
        }
        Update: {
          created_at?: string
          id?: string
          project_id?: string
          role?: string
          team_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_teams_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projetos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_teams_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          code: string | null
          contract_id: string | null
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          legacy_projetos_id: string | null
          module_type: string
          name: string
          org_id: string | null
          redmine_id: number | null
          room_type: string
          sla_id: string | null
          status: string
          team_id: string | null
          updated_at: string
        }
        Insert: {
          code?: string | null
          contract_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          legacy_projetos_id?: string | null
          module_type?: string
          name: string
          org_id?: string | null
          redmine_id?: number | null
          room_type?: string
          sla_id?: string | null
          status?: string
          team_id?: string | null
          updated_at?: string
        }
        Update: {
          code?: string | null
          contract_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          legacy_projetos_id?: string | null
          module_type?: string
          name?: string
          org_id?: string | null
          redmine_id?: number | null
          room_type?: string
          sla_id?: string | null
          status?: string
          team_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "projects_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_sla_id_fkey"
            columns: ["sla_id"]
            isOneToOne: false
            referencedRelation: "contract_slas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      projetos: {
        Row: {
          contract_id: string | null
          created_at: string
          descricao: string | null
          equipe: string | null
          id: string
          nome: string
          sla: string
          sla_id: string | null
          team_id: string
          updated_at: string
        }
        Insert: {
          contract_id?: string | null
          created_at?: string
          descricao?: string | null
          equipe?: string | null
          id?: string
          nome: string
          sla?: string
          sla_id?: string | null
          team_id: string
          updated_at?: string
        }
        Update: {
          contract_id?: string | null
          created_at?: string
          descricao?: string | null
          equipe?: string | null
          id?: string
          nome?: string
          sla?: string
          sla_id?: string | null
          team_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "projetos_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projetos_sla_id_fkey"
            columns: ["sla_id"]
            isOneToOne: false
            referencedRelation: "slas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projetos_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      rdm_audit_log: {
        Row: {
          campo: string
          created_at: string
          id: string
          profile_id: string
          rdm_id: string
          valor_anterior: string | null
          valor_novo: string | null
        }
        Insert: {
          campo: string
          created_at?: string
          id?: string
          profile_id: string
          rdm_id: string
          valor_anterior?: string | null
          valor_novo?: string | null
        }
        Update: {
          campo?: string
          created_at?: string
          id?: string
          profile_id?: string
          rdm_id?: string
          valor_anterior?: string | null
          valor_novo?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rdm_audit_log_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rdm_audit_log_rdm_id_fkey"
            columns: ["rdm_id"]
            isOneToOne: false
            referencedRelation: "rdms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rdm_audit_log_rdm_id_fkey"
            columns: ["rdm_id"]
            isOneToOne: false
            referencedRelation: "vw_rdms_sem_projeto"
            referencedColumns: ["id"]
          },
        ]
      }
      rdm_checklist_items: {
        Row: {
          categoria: string
          comentario: string | null
          concluido_em: string | null
          created_at: string
          descricao: string
          evidencia_url: string | null
          id: string
          ordem: number
          rdm_id: string
          responsavel_id: string | null
          status: string
          updated_at: string
        }
        Insert: {
          categoria: string
          comentario?: string | null
          concluido_em?: string | null
          created_at?: string
          descricao: string
          evidencia_url?: string | null
          id?: string
          ordem?: number
          rdm_id: string
          responsavel_id?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          categoria?: string
          comentario?: string | null
          concluido_em?: string | null
          created_at?: string
          descricao?: string
          evidencia_url?: string | null
          id?: string
          ordem?: number
          rdm_id?: string
          responsavel_id?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "rdm_checklist_items_rdm_id_fkey"
            columns: ["rdm_id"]
            isOneToOne: false
            referencedRelation: "rdms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rdm_checklist_items_rdm_id_fkey"
            columns: ["rdm_id"]
            isOneToOne: false
            referencedRelation: "vw_rdms_sem_projeto"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rdm_checklist_items_responsavel_id_fkey"
            columns: ["responsavel_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      rdm_checklist_templates: {
        Row: {
          ativo: boolean
          categoria: string
          descricao: string
          id: string
          ordem: number
        }
        Insert: {
          ativo?: boolean
          categoria: string
          descricao: string
          id?: string
          ordem?: number
        }
        Update: {
          ativo?: boolean
          categoria?: string
          descricao?: string
          id?: string
          ordem?: number
        }
        Relationships: []
      }
      rdm_deployment_tasks: {
        Row: {
          categoria: string
          concluido_em: string | null
          created_at: string
          descricao: string | null
          id: string
          ordem: number
          rdm_id: string
          responsavel_id: string | null
          status: string
          titulo: string
          updated_at: string
        }
        Insert: {
          categoria: string
          concluido_em?: string | null
          created_at?: string
          descricao?: string | null
          id?: string
          ordem?: number
          rdm_id: string
          responsavel_id?: string | null
          status?: string
          titulo: string
          updated_at?: string
        }
        Update: {
          categoria?: string
          concluido_em?: string | null
          created_at?: string
          descricao?: string | null
          id?: string
          ordem?: number
          rdm_id?: string
          responsavel_id?: string | null
          status?: string
          titulo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "rdm_deployment_tasks_rdm_id_fkey"
            columns: ["rdm_id"]
            isOneToOne: false
            referencedRelation: "rdms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rdm_deployment_tasks_rdm_id_fkey"
            columns: ["rdm_id"]
            isOneToOne: false
            referencedRelation: "vw_rdms_sem_projeto"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rdm_deployment_tasks_responsavel_id_fkey"
            columns: ["responsavel_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      rdm_gonogo: {
        Row: {
          comentario: string | null
          created_at: string
          decisao: string
          id: string
          justificativa: string | null
          papel: string
          profile_id: string
          rdm_id: string
        }
        Insert: {
          comentario?: string | null
          created_at?: string
          decisao: string
          id?: string
          justificativa?: string | null
          papel: string
          profile_id: string
          rdm_id: string
        }
        Update: {
          comentario?: string | null
          created_at?: string
          decisao?: string
          id?: string
          justificativa?: string | null
          papel?: string
          profile_id?: string
          rdm_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "rdm_gonogo_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rdm_gonogo_rdm_id_fkey"
            columns: ["rdm_id"]
            isOneToOne: false
            referencedRelation: "rdms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rdm_gonogo_rdm_id_fkey"
            columns: ["rdm_id"]
            isOneToOne: false
            referencedRelation: "vw_rdms_sem_projeto"
            referencedColumns: ["id"]
          },
        ]
      }
      rdm_participantes: {
        Row: {
          created_at: string
          id: string
          papel: string
          profile_id: string
          rdm_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          papel: string
          profile_id: string
          rdm_id: string
        }
        Update: {
          created_at?: string
          id?: string
          papel?: string
          profile_id?: string
          rdm_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "rdm_participantes_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rdm_participantes_rdm_id_fkey"
            columns: ["rdm_id"]
            isOneToOne: false
            referencedRelation: "rdms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rdm_participantes_rdm_id_fkey"
            columns: ["rdm_id"]
            isOneToOne: false
            referencedRelation: "vw_rdms_sem_projeto"
            referencedColumns: ["id"]
          },
        ]
      }
      rdm_sprint_items: {
        Row: {
          created_at: string
          id: string
          rdm_id: string
          user_story_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          rdm_id: string
          user_story_id: string
        }
        Update: {
          created_at?: string
          id?: string
          rdm_id?: string
          user_story_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "rdm_sprint_items_rdm_id_fkey"
            columns: ["rdm_id"]
            isOneToOne: false
            referencedRelation: "rdms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rdm_sprint_items_rdm_id_fkey"
            columns: ["rdm_id"]
            isOneToOne: false
            referencedRelation: "vw_rdms_sem_projeto"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rdm_sprint_items_user_story_id_fkey"
            columns: ["user_story_id"]
            isOneToOne: false
            referencedRelation: "user_stories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rdm_sprint_items_user_story_id_fkey"
            columns: ["user_story_id"]
            isOneToOne: false
            referencedRelation: "v_hu_git_summary"
            referencedColumns: ["hu_id"]
          },
        ]
      }
      rdm_sprint_redmines: {
        Row: {
          created_at: string
          descricao: string | null
          id: string
          numero: string
          rdm_sprint_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          descricao?: string | null
          id?: string
          numero: string
          rdm_sprint_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          descricao?: string | null
          id?: string
          numero?: string
          rdm_sprint_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "rdm_sprint_redmines_rdm_sprint_id_fkey"
            columns: ["rdm_sprint_id"]
            isOneToOne: false
            referencedRelation: "rdm_sprints"
            referencedColumns: ["id"]
          },
        ]
      }
      rdm_sprints: {
        Row: {
          created_at: string
          id: string
          nome: string
          rdm_id: string
          sprint_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          nome: string
          rdm_id: string
          sprint_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          nome?: string
          rdm_id?: string
          sprint_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "rdm_sprints_rdm_id_fkey"
            columns: ["rdm_id"]
            isOneToOne: false
            referencedRelation: "rdms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rdm_sprints_rdm_id_fkey"
            columns: ["rdm_id"]
            isOneToOne: false
            referencedRelation: "vw_rdms_sem_projeto"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rdm_sprints_sprint_id_fkey"
            columns: ["sprint_id"]
            isOneToOne: false
            referencedRelation: "sprints"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rdm_sprints_sprint_id_fkey"
            columns: ["sprint_id"]
            isOneToOne: false
            referencedRelation: "vw_sprint_pf_summary"
            referencedColumns: ["sprint_id"]
          },
        ]
      }
      rdms: {
        Row: {
          ambiente: string
          codigo: string | null
          created_at: string
          criado_por: string
          data_implantacao: string
          downtime_previsto: boolean
          hora_fim_prevista: string
          hora_inicio: string
          id: string
          nome: string
          objetivo: string
          observacoes: string | null
          project_id: string | null
          risco: string
          rollback_previsto: boolean
          sistema_modulo: string
          sprint_id: string | null
          status: string
          team_id: string
          tempo_rollback_minutos: number | null
          tipo_mudanca: string
          updated_at: string
        }
        Insert: {
          ambiente: string
          codigo?: string | null
          created_at?: string
          criado_por: string
          data_implantacao: string
          downtime_previsto?: boolean
          hora_fim_prevista: string
          hora_inicio: string
          id?: string
          nome: string
          objetivo: string
          observacoes?: string | null
          project_id?: string | null
          risco: string
          rollback_previsto?: boolean
          sistema_modulo: string
          sprint_id?: string | null
          status?: string
          team_id: string
          tempo_rollback_minutos?: number | null
          tipo_mudanca: string
          updated_at?: string
        }
        Update: {
          ambiente?: string
          codigo?: string | null
          created_at?: string
          criado_por?: string
          data_implantacao?: string
          downtime_previsto?: boolean
          hora_fim_prevista?: string
          hora_inicio?: string
          id?: string
          nome?: string
          objetivo?: string
          observacoes?: string | null
          project_id?: string | null
          risco?: string
          rollback_previsto?: boolean
          sistema_modulo?: string
          sprint_id?: string | null
          status?: string
          team_id?: string
          tempo_rollback_minutos?: number | null
          tipo_mudanca?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "rdms_criado_por_fkey"
            columns: ["criado_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rdms_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rdms_sprint_id_fkey"
            columns: ["sprint_id"]
            isOneToOne: false
            referencedRelation: "sprints"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rdms_sprint_id_fkey"
            columns: ["sprint_id"]
            isOneToOne: false
            referencedRelation: "vw_sprint_pf_summary"
            referencedColumns: ["sprint_id"]
          },
          {
            foreignKeyName: "rdms_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      redmine_integrations: {
        Row: {
          api_key_encrypted: string
          base_url: string
          config_json: Json | null
          created_at: string
          created_by: string | null
          id: string
          is_active: boolean | null
          last_sync_at: string | null
          last_sync_error: string | null
          last_sync_items: number | null
          last_sync_status: string | null
          name: string
          organization_id: string
          priority_mappings: Json | null
          project_id: string | null
          project_mappings: Json | null
          status_mappings: Json | null
          sync_direction: string | null
          sync_filter_json: Json | null
          sync_schedule: string | null
          tracker_mappings: Json | null
          updated_at: string
          user_mapping_strategy: string | null
          webhook_events: string[] | null
          webhook_secret_encrypted: string | null
          webhook_url: string | null
        }
        Insert: {
          api_key_encrypted: string
          base_url: string
          config_json?: Json | null
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean | null
          last_sync_at?: string | null
          last_sync_error?: string | null
          last_sync_items?: number | null
          last_sync_status?: string | null
          name: string
          organization_id: string
          priority_mappings?: Json | null
          project_id?: string | null
          project_mappings?: Json | null
          status_mappings?: Json | null
          sync_direction?: string | null
          sync_filter_json?: Json | null
          sync_schedule?: string | null
          tracker_mappings?: Json | null
          updated_at?: string
          user_mapping_strategy?: string | null
          webhook_events?: string[] | null
          webhook_secret_encrypted?: string | null
          webhook_url?: string | null
        }
        Update: {
          api_key_encrypted?: string
          base_url?: string
          config_json?: Json | null
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean | null
          last_sync_at?: string | null
          last_sync_error?: string | null
          last_sync_items?: number | null
          last_sync_status?: string | null
          name?: string
          organization_id?: string
          priority_mappings?: Json | null
          project_id?: string | null
          project_mappings?: Json | null
          status_mappings?: Json | null
          sync_direction?: string | null
          sync_filter_json?: Json | null
          sync_schedule?: string | null
          tracker_mappings?: Json | null
          updated_at?: string
          user_mapping_strategy?: string | null
          webhook_events?: string[] | null
          webhook_secret_encrypted?: string | null
          webhook_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "redmine_integrations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "redmine_integrations_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      redmine_issue_links: {
        Row: {
          axionn_entity_id: string
          axionn_entity_type: string
          conflict_details: Json | null
          created_at: string
          id: string
          integration_id: string
          last_axionn_updated_at: string | null
          last_redmine_updated_on: string | null
          last_synced_at: string | null
          organization_id: string
          redmine_issue_id: number
          redmine_priority_id: number | null
          redmine_project_id: number
          redmine_status_id: number | null
          redmine_tracker_id: number | null
          sync_direction: string
          sync_status: string | null
          updated_at: string
        }
        Insert: {
          axionn_entity_id: string
          axionn_entity_type: string
          conflict_details?: Json | null
          created_at?: string
          id?: string
          integration_id: string
          last_axionn_updated_at?: string | null
          last_redmine_updated_on?: string | null
          last_synced_at?: string | null
          organization_id: string
          redmine_issue_id: number
          redmine_priority_id?: number | null
          redmine_project_id: number
          redmine_status_id?: number | null
          redmine_tracker_id?: number | null
          sync_direction: string
          sync_status?: string | null
          updated_at?: string
        }
        Update: {
          axionn_entity_id?: string
          axionn_entity_type?: string
          conflict_details?: Json | null
          created_at?: string
          id?: string
          integration_id?: string
          last_axionn_updated_at?: string | null
          last_redmine_updated_on?: string | null
          last_synced_at?: string | null
          organization_id?: string
          redmine_issue_id?: number
          redmine_priority_id?: number | null
          redmine_project_id?: number
          redmine_status_id?: number | null
          redmine_tracker_id?: number | null
          sync_direction?: string
          sync_status?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "redmine_issue_links_integration_id_fkey"
            columns: ["integration_id"]
            isOneToOne: false
            referencedRelation: "redmine_integrations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "redmine_issue_links_integration_id_fkey"
            columns: ["integration_id"]
            isOneToOne: false
            referencedRelation: "v_redmine_integration_health"
            referencedColumns: ["integration_id"]
          },
          {
            foreignKeyName: "redmine_issue_links_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      redmine_sync_events: {
        Row: {
          completed_at: string | null
          correlation_id: string | null
          error_details: Json | null
          id: string
          integration_id: string
          issues_created: number | null
          issues_failed: number | null
          issues_processed: number | null
          issues_skipped: number | null
          issues_updated: number | null
          organization_id: string
          started_at: string
          status: string
          sync_type: string
          trigger_source: string | null
        }
        Insert: {
          completed_at?: string | null
          correlation_id?: string | null
          error_details?: Json | null
          id?: string
          integration_id: string
          issues_created?: number | null
          issues_failed?: number | null
          issues_processed?: number | null
          issues_skipped?: number | null
          issues_updated?: number | null
          organization_id: string
          started_at?: string
          status: string
          sync_type: string
          trigger_source?: string | null
        }
        Update: {
          completed_at?: string | null
          correlation_id?: string | null
          error_details?: Json | null
          id?: string
          integration_id?: string
          issues_created?: number | null
          issues_failed?: number | null
          issues_processed?: number | null
          issues_skipped?: number | null
          issues_updated?: number | null
          organization_id?: string
          started_at?: string
          status?: string
          sync_type?: string
          trigger_source?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "redmine_sync_events_integration_id_fkey"
            columns: ["integration_id"]
            isOneToOne: false
            referencedRelation: "redmine_integrations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "redmine_sync_events_integration_id_fkey"
            columns: ["integration_id"]
            isOneToOne: false
            referencedRelation: "v_redmine_integration_health"
            referencedColumns: ["integration_id"]
          },
          {
            foreignKeyName: "redmine_sync_events_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      releases: {
        Row: {
          bugs_fixed: number | null
          contract_id: string | null
          created_at: string
          hus_included: number | null
          id: string
          notes: string | null
          released_at: string
          sprint_id: string | null
          status: string
          team_id: string
          version: string
        }
        Insert: {
          bugs_fixed?: number | null
          contract_id?: string | null
          created_at?: string
          hus_included?: number | null
          id?: string
          notes?: string | null
          released_at?: string
          sprint_id?: string | null
          status?: string
          team_id: string
          version: string
        }
        Update: {
          bugs_fixed?: number | null
          contract_id?: string | null
          created_at?: string
          hus_included?: number | null
          id?: string
          notes?: string | null
          released_at?: string
          sprint_id?: string | null
          status?: string
          team_id?: string
          version?: string
        }
        Relationships: [
          {
            foreignKeyName: "releases_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
        ]
      }
      report_usage_snapshots: {
        Row: {
          created_at: string
          dimension_json: Json | null
          granularity: string
          id: string
          metric_name: string
          metric_value: number
          period_end: string
          period_start: string
          project_id: string | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          dimension_json?: Json | null
          granularity: string
          id?: string
          metric_name: string
          metric_value: number
          period_end: string
          period_start: string
          project_id?: string | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          dimension_json?: Json | null
          granularity?: string
          id?: string
          metric_name?: string
          metric_value?: number
          period_end?: string
          period_start?: string
          project_id?: string | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "report_usage_snapshots_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "report_usage_snapshots_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      retro_action_items: {
        Row: {
          card_id: string | null
          created_at: string
          description: string | null
          due_date: string | null
          id: string
          owner_id: string | null
          session_id: string
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          card_id?: string | null
          created_at?: string
          description?: string | null
          due_date?: string | null
          id?: string
          owner_id?: string | null
          session_id: string
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          card_id?: string | null
          created_at?: string
          description?: string | null
          due_date?: string | null
          id?: string
          owner_id?: string | null
          session_id?: string
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "retro_action_items_card_id_fkey"
            columns: ["card_id"]
            isOneToOne: false
            referencedRelation: "retro_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "retro_action_items_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "retro_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      retro_actions: {
        Row: {
          card_id: string | null
          created_at: string
          description: string
          id: string
          owner_id: string | null
          session_id: string
          status: string
          target_sprint_id: string | null
        }
        Insert: {
          card_id?: string | null
          created_at?: string
          description: string
          id?: string
          owner_id?: string | null
          session_id: string
          status?: string
          target_sprint_id?: string | null
        }
        Update: {
          card_id?: string | null
          created_at?: string
          description?: string
          id?: string
          owner_id?: string | null
          session_id?: string
          status?: string
          target_sprint_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "retro_actions_card_id_fkey"
            columns: ["card_id"]
            isOneToOne: false
            referencedRelation: "retro_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "retro_actions_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "retro_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "retro_actions_target_sprint_id_fkey"
            columns: ["target_sprint_id"]
            isOneToOne: false
            referencedRelation: "sprints"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "retro_actions_target_sprint_id_fkey"
            columns: ["target_sprint_id"]
            isOneToOne: false
            referencedRelation: "vw_sprint_pf_summary"
            referencedColumns: ["sprint_id"]
          },
        ]
      }
      retro_cards: {
        Row: {
          action_owner_id: string | null
          action_target_sprint_id: string | null
          author_id: string
          column_key: string
          created_at: string
          hidden: boolean
          id: string
          is_action: boolean
          session_id: string
          text: string
          votes: number
        }
        Insert: {
          action_owner_id?: string | null
          action_target_sprint_id?: string | null
          author_id: string
          column_key: string
          created_at?: string
          hidden?: boolean
          id?: string
          is_action?: boolean
          session_id: string
          text: string
          votes?: number
        }
        Update: {
          action_owner_id?: string | null
          action_target_sprint_id?: string | null
          author_id?: string
          column_key?: string
          created_at?: string
          hidden?: boolean
          id?: string
          is_action?: boolean
          session_id?: string
          text?: string
          votes?: number
        }
        Relationships: [
          {
            foreignKeyName: "retro_cards_action_target_sprint_id_fkey"
            columns: ["action_target_sprint_id"]
            isOneToOne: false
            referencedRelation: "sprints"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "retro_cards_action_target_sprint_id_fkey"
            columns: ["action_target_sprint_id"]
            isOneToOne: false
            referencedRelation: "vw_sprint_pf_summary"
            referencedColumns: ["sprint_id"]
          },
          {
            foreignKeyName: "retro_cards_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "retro_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      retro_participants: {
        Row: {
          id: string
          is_facilitator: boolean
          is_online: boolean
          joined_at: string
          last_seen_at: string
          session_id: string
          user_id: string
        }
        Insert: {
          id?: string
          is_facilitator?: boolean
          is_online?: boolean
          joined_at?: string
          last_seen_at?: string
          session_id: string
          user_id: string
        }
        Update: {
          id?: string
          is_facilitator?: boolean
          is_online?: boolean
          joined_at?: string
          last_seen_at?: string
          session_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "retro_participants_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "retro_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      retro_sessions: {
        Row: {
          created_at: string
          created_by: string
          current_phase: string
          finished_at: string | null
          id: string
          model: string
          sprint_id: string
          status: string
          team_id: string
        }
        Insert: {
          created_at?: string
          created_by: string
          current_phase?: string
          finished_at?: string | null
          id?: string
          model?: string
          sprint_id: string
          status?: string
          team_id: string
        }
        Update: {
          created_at?: string
          created_by?: string
          current_phase?: string
          finished_at?: string | null
          id?: string
          model?: string
          sprint_id?: string
          status?: string
          team_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "retro_sessions_sprint_id_fkey"
            columns: ["sprint_id"]
            isOneToOne: false
            referencedRelation: "sprints"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "retro_sessions_sprint_id_fkey"
            columns: ["sprint_id"]
            isOneToOne: false
            referencedRelation: "vw_sprint_pf_summary"
            referencedColumns: ["sprint_id"]
          },
          {
            foreignKeyName: "retro_sessions_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      retro_votes: {
        Row: {
          card_id: string
          created_at: string
          id: string
          session_id: string
          user_id: string
        }
        Insert: {
          card_id: string
          created_at?: string
          id?: string
          session_id: string
          user_id: string
        }
        Update: {
          card_id?: string
          created_at?: string
          id?: string
          session_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "retro_votes_card_id_fkey"
            columns: ["card_id"]
            isOneToOne: false
            referencedRelation: "retro_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "retro_votes_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "retro_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      risk_model_versions: {
        Row: {
          accuracy: number | null
          archived_at: string | null
          auc_roc: number | null
          confusion_matrix: Json | null
          created_at: string
          deployed_at: string | null
          error_message: string | null
          f1_score: number | null
          feature_importance: Json | null
          id: string
          model_artifact_path: string | null
          model_artifact_size_bytes: number | null
          model_type: string
          organization_id: string
          precision_score: number | null
          project_id: string | null
          recall_score: number | null
          status: string | null
          test_samples: number | null
          training_period_end: string | null
          training_period_start: string | null
          training_samples: number | null
          validation_samples: number | null
          version: string
        }
        Insert: {
          accuracy?: number | null
          archived_at?: string | null
          auc_roc?: number | null
          confusion_matrix?: Json | null
          created_at?: string
          deployed_at?: string | null
          error_message?: string | null
          f1_score?: number | null
          feature_importance?: Json | null
          id?: string
          model_artifact_path?: string | null
          model_artifact_size_bytes?: number | null
          model_type: string
          organization_id: string
          precision_score?: number | null
          project_id?: string | null
          recall_score?: number | null
          status?: string | null
          test_samples?: number | null
          training_period_end?: string | null
          training_period_start?: string | null
          training_samples?: number | null
          validation_samples?: number | null
          version: string
        }
        Update: {
          accuracy?: number | null
          archived_at?: string | null
          auc_roc?: number | null
          confusion_matrix?: Json | null
          created_at?: string
          deployed_at?: string | null
          error_message?: string | null
          f1_score?: number | null
          feature_importance?: Json | null
          id?: string
          model_artifact_path?: string | null
          model_artifact_size_bytes?: number | null
          model_type?: string
          organization_id?: string
          precision_score?: number | null
          project_id?: string | null
          recall_score?: number | null
          status?: string | null
          test_samples?: number | null
          training_period_end?: string | null
          training_period_start?: string | null
          training_samples?: number | null
          validation_samples?: number | null
          version?: string
        }
        Relationships: [
          {
            foreignKeyName: "risk_model_versions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "risk_model_versions_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      risk_prediction_config: {
        Row: {
          created_at: string
          enabled_features: Json | null
          feature_weights: Json | null
          id: string
          is_active: boolean | null
          min_training_samples: number | null
          model_type: string | null
          model_version: string | null
          notification_channels: string[] | null
          notify_on_critical_risk: boolean | null
          notify_on_high_risk: boolean | null
          organization_id: string
          predict_on_events: string[] | null
          prediction_schedule: string | null
          project_id: string | null
          retrain_schedule: string | null
          risk_thresholds: Json | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          enabled_features?: Json | null
          feature_weights?: Json | null
          id?: string
          is_active?: boolean | null
          min_training_samples?: number | null
          model_type?: string | null
          model_version?: string | null
          notification_channels?: string[] | null
          notify_on_critical_risk?: boolean | null
          notify_on_high_risk?: boolean | null
          organization_id: string
          predict_on_events?: string[] | null
          prediction_schedule?: string | null
          project_id?: string | null
          retrain_schedule?: string | null
          risk_thresholds?: Json | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          enabled_features?: Json | null
          feature_weights?: Json | null
          id?: string
          is_active?: boolean | null
          min_training_samples?: number | null
          model_type?: string | null
          model_version?: string | null
          notification_channels?: string[] | null
          notify_on_critical_risk?: boolean | null
          notify_on_high_risk?: boolean | null
          organization_id?: string
          predict_on_events?: string[] | null
          prediction_schedule?: string | null
          project_id?: string | null
          retrain_schedule?: string | null
          risk_thresholds?: Json | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "risk_prediction_config_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "risk_prediction_config_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      risk_training_data: {
        Row: {
          actual_delay_days: number | null
          actual_outcome: string
          created_at: string
          data_collected_at: string
          dataset_split: string | null
          features: Json
          hu_id: string | null
          id: string
          organization_id: string
          project_id: string | null
          sprint_end_date: string | null
          sprint_id: string | null
          sprint_start_date: string | null
        }
        Insert: {
          actual_delay_days?: number | null
          actual_outcome: string
          created_at?: string
          data_collected_at?: string
          dataset_split?: string | null
          features: Json
          hu_id?: string | null
          id?: string
          organization_id: string
          project_id?: string | null
          sprint_end_date?: string | null
          sprint_id?: string | null
          sprint_start_date?: string | null
        }
        Update: {
          actual_delay_days?: number | null
          actual_outcome?: string
          created_at?: string
          data_collected_at?: string
          dataset_split?: string | null
          features?: Json
          hu_id?: string | null
          id?: string
          organization_id?: string
          project_id?: string | null
          sprint_end_date?: string | null
          sprint_id?: string | null
          sprint_start_date?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "risk_training_data_hu_id_fkey"
            columns: ["hu_id"]
            isOneToOne: false
            referencedRelation: "user_stories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "risk_training_data_hu_id_fkey"
            columns: ["hu_id"]
            isOneToOne: false
            referencedRelation: "v_hu_git_summary"
            referencedColumns: ["hu_id"]
          },
          {
            foreignKeyName: "risk_training_data_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "risk_training_data_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "risk_training_data_sprint_id_fkey"
            columns: ["sprint_id"]
            isOneToOne: false
            referencedRelation: "sprints"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "risk_training_data_sprint_id_fkey"
            columns: ["sprint_id"]
            isOneToOne: false
            referencedRelation: "vw_sprint_pf_summary"
            referencedColumns: ["sprint_id"]
          },
        ]
      }
      role_permissions: {
        Row: {
          permission_key: string
          role_name: string
        }
        Insert: {
          permission_key: string
          role_name: string
        }
        Update: {
          permission_key?: string
          role_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "role_permissions_permission_key_fkey"
            columns: ["permission_key"]
            isOneToOne: false
            referencedRelation: "app_permissions"
            referencedColumns: ["key"]
          },
          {
            foreignKeyName: "role_permissions_role_name_fkey"
            columns: ["role_name"]
            isOneToOne: false
            referencedRelation: "app_roles"
            referencedColumns: ["name"]
          },
        ]
      }
      saas_metrics_snapshots: {
        Row: {
          active_tenants: number
          active_users_30d: number
          arr: number
          churned_mrr: number
          churned_tenants: number
          created_at: string
          id: string
          mrr: number
          new_mrr: number
          open_tickets: number
          snapshot_date: string
          total_tenants: number
          total_users: number
          trial_tenants: number
        }
        Insert: {
          active_tenants?: number
          active_users_30d?: number
          arr?: number
          churned_mrr?: number
          churned_tenants?: number
          created_at?: string
          id?: string
          mrr?: number
          new_mrr?: number
          open_tickets?: number
          snapshot_date?: string
          total_tenants?: number
          total_users?: number
          trial_tenants?: number
        }
        Update: {
          active_tenants?: number
          active_users_30d?: number
          arr?: number
          churned_mrr?: number
          churned_tenants?: number
          created_at?: string
          id?: string
          mrr?: number
          new_mrr?: number
          open_tickets?: number
          snapshot_date?: string
          total_tenants?: number
          total_users?: number
          trial_tenants?: number
        }
        Relationships: []
      }
      saas_plan_entitlements: {
        Row: {
          created_at: string
          enabled: boolean
          feature_key: string
          id: string
          limit_value: number | null
          metadata: Json
          plan_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          enabled?: boolean
          feature_key: string
          id?: string
          limit_value?: number | null
          metadata?: Json
          plan_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          enabled?: boolean
          feature_key?: string
          id?: string
          limit_value?: number | null
          metadata?: Json
          plan_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "saas_plan_entitlements_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "saas_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      saas_plans: {
        Row: {
          annual_price: number
          code: string
          created_at: string
          currency: string
          description: string | null
          id: string
          metadata: Json
          monthly_price: number
          name: string
          status: string
          updated_at: string
        }
        Insert: {
          annual_price?: number
          code: string
          created_at?: string
          currency?: string
          description?: string | null
          id?: string
          metadata?: Json
          monthly_price?: number
          name: string
          status?: string
          updated_at?: string
        }
        Update: {
          annual_price?: number
          code?: string
          created_at?: string
          currency?: string
          description?: string | null
          id?: string
          metadata?: Json
          monthly_price?: number
          name?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      saas_runtime_settings: {
        Row: {
          key: string
          updated_at: string
          updated_by: string | null
          value: Json
        }
        Insert: {
          key: string
          updated_at?: string
          updated_by?: string | null
          value: Json
        }
        Update: {
          key?: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Relationships: []
      }
      slas: {
        Row: {
          created_at: string
          id: string
          nome: string
          regime_base: string
          team_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          nome: string
          regime_base?: string
          team_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          nome?: string
          regime_base?: string
          team_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      sprint_risk_events: {
        Row: {
          acknowledged_at: string | null
          actual_outcome: string | null
          created_at: string
          days_remaining: number | null
          delay_probability: number | null
          features: Json | null
          feedback_at: string | null
          feedback_notes: string | null
          feedback_provided_by: string | null
          hu_id: string | null
          id: string
          incomplete_probability: number | null
          justification: string
          key_factors: Json | null
          model_type: string
          model_version: string
          organization_id: string
          predicted_at: string
          project_id: string | null
          resolved_at: string | null
          risk_level: string
          risk_score: number
          sprint_end_date: string | null
          sprint_id: string | null
          sprint_start_date: string | null
          status: string | null
          updated_at: string
        }
        Insert: {
          acknowledged_at?: string | null
          actual_outcome?: string | null
          created_at?: string
          days_remaining?: number | null
          delay_probability?: number | null
          features?: Json | null
          feedback_at?: string | null
          feedback_notes?: string | null
          feedback_provided_by?: string | null
          hu_id?: string | null
          id?: string
          incomplete_probability?: number | null
          justification: string
          key_factors?: Json | null
          model_type: string
          model_version: string
          organization_id: string
          predicted_at?: string
          project_id?: string | null
          resolved_at?: string | null
          risk_level: string
          risk_score: number
          sprint_end_date?: string | null
          sprint_id?: string | null
          sprint_start_date?: string | null
          status?: string | null
          updated_at?: string
        }
        Update: {
          acknowledged_at?: string | null
          actual_outcome?: string | null
          created_at?: string
          days_remaining?: number | null
          delay_probability?: number | null
          features?: Json | null
          feedback_at?: string | null
          feedback_notes?: string | null
          feedback_provided_by?: string | null
          hu_id?: string | null
          id?: string
          incomplete_probability?: number | null
          justification?: string
          key_factors?: Json | null
          model_type?: string
          model_version?: string
          organization_id?: string
          predicted_at?: string
          project_id?: string | null
          resolved_at?: string | null
          risk_level?: string
          risk_score?: number
          sprint_end_date?: string | null
          sprint_id?: string | null
          sprint_start_date?: string | null
          status?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sprint_risk_events_hu_id_fkey"
            columns: ["hu_id"]
            isOneToOne: false
            referencedRelation: "user_stories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sprint_risk_events_hu_id_fkey"
            columns: ["hu_id"]
            isOneToOne: false
            referencedRelation: "v_hu_git_summary"
            referencedColumns: ["hu_id"]
          },
          {
            foreignKeyName: "sprint_risk_events_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sprint_risk_events_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sprint_risk_events_sprint_id_fkey"
            columns: ["sprint_id"]
            isOneToOne: false
            referencedRelation: "sprints"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sprint_risk_events_sprint_id_fkey"
            columns: ["sprint_id"]
            isOneToOne: false
            referencedRelation: "vw_sprint_pf_summary"
            referencedColumns: ["sprint_id"]
          },
        ]
      }
      sprints: {
        Row: {
          closed_at: string | null
          created_at: string
          delay_days: number | null
          end_date: string
          goal: string | null
          id: string
          is_active: boolean
          name: string
          start_date: string
          team_id: string
          updated_at: string
        }
        Insert: {
          closed_at?: string | null
          created_at?: string
          delay_days?: number | null
          end_date: string
          goal?: string | null
          id?: string
          is_active?: boolean
          name: string
          start_date: string
          team_id: string
          updated_at?: string
        }
        Update: {
          closed_at?: string | null
          created_at?: string
          delay_days?: number | null
          end_date?: string
          goal?: string | null
          id?: string
          is_active?: boolean
          name?: string
          start_date?: string
          team_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sprints_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      support_tickets: {
        Row: {
          assigned_to: string | null
          category: string
          created_at: string
          description: string
          id: string
          priority: string
          reporter_email: string
          reporter_name: string
          resolved_at: string | null
          sla_deadline: string | null
          status: string
          subject: string
          tenant_id: string | null
          tenant_name: string
          ticket_number: string
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          category?: string
          created_at?: string
          description: string
          id?: string
          priority?: string
          reporter_email: string
          reporter_name: string
          resolved_at?: string | null
          sla_deadline?: string | null
          status?: string
          subject: string
          tenant_id?: string | null
          tenant_name: string
          ticket_number?: string
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          category?: string
          created_at?: string
          description?: string
          id?: string
          priority?: string
          reporter_email?: string
          reporter_name?: string
          resolved_at?: string | null
          sla_deadline?: string | null
          status?: string
          subject?: string
          tenant_id?: string | null
          tenant_name?: string
          ticket_number?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_tickets_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "owner_staff_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "support_tickets_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      sustentacao_workflow_steps: {
        Row: {
          ativo: boolean
          cor: string
          created_at: string
          id: string
          nome: string
          ordem: number
          team_id: string
        }
        Insert: {
          ativo?: boolean
          cor?: string
          created_at?: string
          id?: string
          nome: string
          ordem?: number
          team_id: string
        }
        Update: {
          ativo?: boolean
          cor?: string
          created_at?: string
          id?: string
          nome?: string
          ordem?: number
          team_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sustentacao_workflow_steps_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      team_members: {
        Row: {
          id: string
          joined_at: string
          role: string
          team_id: string
          user_id: string
        }
        Insert: {
          id?: string
          joined_at?: string
          role?: string
          team_id: string
          user_id: string
        }
        Update: {
          id?: string
          joined_at?: string
          role?: string
          team_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_members_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      team_modules: {
        Row: {
          created_at: string
          id: string
          module: string
          team_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          module: string
          team_id: string
        }
        Update: {
          created_at?: string
          id?: string
          module?: string
          team_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_modules_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      teams: {
        Row: {
          company_id: string | null
          contract_id: string | null
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          is_active: boolean
          module: string
          name: string
          org_id: string | null
          project_id: string | null
          team_type: string | null
          updated_at: string
        }
        Insert: {
          company_id?: string | null
          contract_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          module?: string
          name: string
          org_id?: string | null
          project_id?: string | null
          team_type?: string | null
          updated_at?: string
        }
        Update: {
          company_id?: string | null
          contract_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          module?: string
          name?: string
          org_id?: string | null
          project_id?: string | null
          team_type?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "teams_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teams_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teams_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teams_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      teams_channel_mappings: {
        Row: {
          channel_id: string
          channel_name: string | null
          created_at: string
          event_types: string[] | null
          filter_json: Json | null
          id: string
          integration_id: string
          is_active: boolean | null
          last_notification_at: string | null
          mention_on_critical: boolean | null
          mention_users: string[] | null
          organization_id: string
          project_id: string | null
          team_id: string
          team_name: string | null
          updated_at: string
        }
        Insert: {
          channel_id: string
          channel_name?: string | null
          created_at?: string
          event_types?: string[] | null
          filter_json?: Json | null
          id?: string
          integration_id: string
          is_active?: boolean | null
          last_notification_at?: string | null
          mention_on_critical?: boolean | null
          mention_users?: string[] | null
          organization_id: string
          project_id?: string | null
          team_id: string
          team_name?: string | null
          updated_at?: string
        }
        Update: {
          channel_id?: string
          channel_name?: string | null
          created_at?: string
          event_types?: string[] | null
          filter_json?: Json | null
          id?: string
          integration_id?: string
          is_active?: boolean | null
          last_notification_at?: string | null
          mention_on_critical?: boolean | null
          mention_users?: string[] | null
          organization_id?: string
          project_id?: string | null
          team_id?: string
          team_name?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "teams_channel_mappings_integration_id_fkey"
            columns: ["integration_id"]
            isOneToOne: false
            referencedRelation: "teams_integrations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teams_channel_mappings_integration_id_fkey"
            columns: ["integration_id"]
            isOneToOne: false
            referencedRelation: "v_teams_adoption_report"
            referencedColumns: ["integration_id"]
          },
          {
            foreignKeyName: "teams_channel_mappings_integration_id_fkey"
            columns: ["integration_id"]
            isOneToOne: false
            referencedRelation: "v_teams_notification_health"
            referencedColumns: ["integration_id"]
          },
          {
            foreignKeyName: "teams_channel_mappings_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teams_channel_mappings_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      teams_custom_commands: {
        Row: {
          allowed_in_channel: boolean | null
          allowed_in_personal: boolean | null
          command_name: string
          created_at: string
          description: string | null
          handler_config: Json
          handler_type: string
          id: string
          integration_id: string
          is_active: boolean | null
          organization_id: string
          required_roles: string[] | null
          updated_at: string
          usage_hint: string | null
        }
        Insert: {
          allowed_in_channel?: boolean | null
          allowed_in_personal?: boolean | null
          command_name: string
          created_at?: string
          description?: string | null
          handler_config: Json
          handler_type?: string
          id?: string
          integration_id: string
          is_active?: boolean | null
          organization_id: string
          required_roles?: string[] | null
          updated_at?: string
          usage_hint?: string | null
        }
        Update: {
          allowed_in_channel?: boolean | null
          allowed_in_personal?: boolean | null
          command_name?: string
          created_at?: string
          description?: string | null
          handler_config?: Json
          handler_type?: string
          id?: string
          integration_id?: string
          is_active?: boolean | null
          organization_id?: string
          required_roles?: string[] | null
          updated_at?: string
          usage_hint?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "teams_custom_commands_integration_id_fkey"
            columns: ["integration_id"]
            isOneToOne: false
            referencedRelation: "teams_integrations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teams_custom_commands_integration_id_fkey"
            columns: ["integration_id"]
            isOneToOne: false
            referencedRelation: "v_teams_adoption_report"
            referencedColumns: ["integration_id"]
          },
          {
            foreignKeyName: "teams_custom_commands_integration_id_fkey"
            columns: ["integration_id"]
            isOneToOne: false
            referencedRelation: "v_teams_notification_health"
            referencedColumns: ["integration_id"]
          },
          {
            foreignKeyName: "teams_custom_commands_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      teams_integrations: {
        Row: {
          azure_client_id: string
          azure_client_secret_encrypted: string | null
          azure_tenant_id: string
          bot_endpoint: string | null
          bot_id: string | null
          bot_password_encrypted: string | null
          card_theme: string | null
          config_json: Json | null
          created_at: string
          created_by: string | null
          default_notification_events: string[] | null
          enabled_commands: string[] | null
          id: string
          include_actions: boolean | null
          installed_at: string | null
          is_active: boolean | null
          last_activity_at: string | null
          name: string
          notification_channels: Json | null
          organization_id: string
          project_id: string | null
          updated_at: string
        }
        Insert: {
          azure_client_id: string
          azure_client_secret_encrypted?: string | null
          azure_tenant_id: string
          bot_endpoint?: string | null
          bot_id?: string | null
          bot_password_encrypted?: string | null
          card_theme?: string | null
          config_json?: Json | null
          created_at?: string
          created_by?: string | null
          default_notification_events?: string[] | null
          enabled_commands?: string[] | null
          id?: string
          include_actions?: boolean | null
          installed_at?: string | null
          is_active?: boolean | null
          last_activity_at?: string | null
          name?: string
          notification_channels?: Json | null
          organization_id: string
          project_id?: string | null
          updated_at?: string
        }
        Update: {
          azure_client_id?: string
          azure_client_secret_encrypted?: string | null
          azure_tenant_id?: string
          bot_endpoint?: string | null
          bot_id?: string | null
          bot_password_encrypted?: string | null
          card_theme?: string | null
          config_json?: Json | null
          created_at?: string
          created_by?: string | null
          default_notification_events?: string[] | null
          enabled_commands?: string[] | null
          id?: string
          include_actions?: boolean | null
          installed_at?: string | null
          is_active?: boolean | null
          last_activity_at?: string | null
          name?: string
          notification_channels?: Json | null
          organization_id?: string
          project_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "teams_integrations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teams_integrations_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      teams_interaction_events: {
        Row: {
          axionn_user_id: string | null
          channel_id: string | null
          channel_name: string | null
          command_args: Json | null
          command_name: string | null
          conversation_id: string | null
          correlation_id: string | null
          created_at: string
          id: string
          integration_id: string
          interaction_type: string
          organization_id: string
          processing_time_ms: number | null
          response_card: Json | null
          response_message: string | null
          response_type: string | null
          team_id: string | null
          team_name: string | null
          teams_user_aad_object_id: string | null
          teams_user_email: string | null
          teams_user_id: string
          teams_user_name: string | null
        }
        Insert: {
          axionn_user_id?: string | null
          channel_id?: string | null
          channel_name?: string | null
          command_args?: Json | null
          command_name?: string | null
          conversation_id?: string | null
          correlation_id?: string | null
          created_at?: string
          id?: string
          integration_id: string
          interaction_type: string
          organization_id: string
          processing_time_ms?: number | null
          response_card?: Json | null
          response_message?: string | null
          response_type?: string | null
          team_id?: string | null
          team_name?: string | null
          teams_user_aad_object_id?: string | null
          teams_user_email?: string | null
          teams_user_id: string
          teams_user_name?: string | null
        }
        Update: {
          axionn_user_id?: string | null
          channel_id?: string | null
          channel_name?: string | null
          command_args?: Json | null
          command_name?: string | null
          conversation_id?: string | null
          correlation_id?: string | null
          created_at?: string
          id?: string
          integration_id?: string
          interaction_type?: string
          organization_id?: string
          processing_time_ms?: number | null
          response_card?: Json | null
          response_message?: string | null
          response_type?: string | null
          team_id?: string | null
          team_name?: string | null
          teams_user_aad_object_id?: string | null
          teams_user_email?: string | null
          teams_user_id?: string
          teams_user_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "teams_interaction_events_integration_id_fkey"
            columns: ["integration_id"]
            isOneToOne: false
            referencedRelation: "teams_integrations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teams_interaction_events_integration_id_fkey"
            columns: ["integration_id"]
            isOneToOne: false
            referencedRelation: "v_teams_adoption_report"
            referencedColumns: ["integration_id"]
          },
          {
            foreignKeyName: "teams_interaction_events_integration_id_fkey"
            columns: ["integration_id"]
            isOneToOne: false
            referencedRelation: "v_teams_notification_health"
            referencedColumns: ["integration_id"]
          },
          {
            foreignKeyName: "teams_interaction_events_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      teams_notifications_sent: {
        Row: {
          card_content: Json | null
          card_type: string | null
          channel_id: string
          channel_mapping_id: string | null
          correlation_id: string | null
          created_at: string
          deduplication_key: string | null
          event_payload: Json | null
          event_source: string | null
          event_type: string
          failed_at: string | null
          failure_reason: string | null
          id: string
          integration_id: string
          message_text: string | null
          organization_id: string
          retry_count: number | null
          sent_at: string | null
          status: string
          team_id: string
        }
        Insert: {
          card_content?: Json | null
          card_type?: string | null
          channel_id: string
          channel_mapping_id?: string | null
          correlation_id?: string | null
          created_at?: string
          deduplication_key?: string | null
          event_payload?: Json | null
          event_source?: string | null
          event_type: string
          failed_at?: string | null
          failure_reason?: string | null
          id?: string
          integration_id: string
          message_text?: string | null
          organization_id: string
          retry_count?: number | null
          sent_at?: string | null
          status?: string
          team_id: string
        }
        Update: {
          card_content?: Json | null
          card_type?: string | null
          channel_id?: string
          channel_mapping_id?: string | null
          correlation_id?: string | null
          created_at?: string
          deduplication_key?: string | null
          event_payload?: Json | null
          event_source?: string | null
          event_type?: string
          failed_at?: string | null
          failure_reason?: string | null
          id?: string
          integration_id?: string
          message_text?: string | null
          organization_id?: string
          retry_count?: number | null
          sent_at?: string | null
          status?: string
          team_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "teams_notifications_sent_channel_mapping_id_fkey"
            columns: ["channel_mapping_id"]
            isOneToOne: false
            referencedRelation: "teams_channel_mappings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teams_notifications_sent_integration_id_fkey"
            columns: ["integration_id"]
            isOneToOne: false
            referencedRelation: "teams_integrations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teams_notifications_sent_integration_id_fkey"
            columns: ["integration_id"]
            isOneToOne: false
            referencedRelation: "v_teams_adoption_report"
            referencedColumns: ["integration_id"]
          },
          {
            foreignKeyName: "teams_notifications_sent_integration_id_fkey"
            columns: ["integration_id"]
            isOneToOne: false
            referencedRelation: "v_teams_notification_health"
            referencedColumns: ["integration_id"]
          },
          {
            foreignKeyName: "teams_notifications_sent_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      user_contracts: {
        Row: {
          contract_id: string
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          updated_at: string
          user_id: string
        }
        Insert: {
          contract_id: string
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
          user_id: string
        }
        Update: {
          contract_id?: string
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_contracts_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
        ]
      }
      user_management_audit_log: {
        Row: {
          action: string
          actor_id: string
          created_at: string
          id: string
          payload: Json | null
          target_id: string
        }
        Insert: {
          action: string
          actor_id: string
          created_at?: string
          id?: string
          payload?: Json | null
          target_id: string
        }
        Update: {
          action?: string
          actor_id?: string
          created_at?: string
          id?: string
          payload?: Json | null
          target_id?: string
        }
        Relationships: []
      }
      user_module_roles: {
        Row: {
          created_at: string | null
          id: string
          module: string
          role_name: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          module: string
          role_name: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          module?: string
          role_name?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      user_stories: {
        Row: {
          acceptance_criteria: string | null
          added_to_sprint_at: string | null
          ai_fp_breakdown: Json | null
          ai_fp_confidence: number | null
          ai_fp_validated: boolean
          apf_counting_session_id: string | null
          apf_factor_sigla: string | null
          apf_function_sigla: string | null
          apf_pf_bruto: number | null
          apf_pf_fs: number | null
          assignee_id: string | null
          backlog_order: number | null
          code: string
          contract_id: string | null
          created_at: string
          custom_fields: Json | null
          description: string | null
          end_date: string | null
          epic_id: string | null
          estimated_hours: number | null
          external_reference: string | null
          function_points: number | null
          id: string
          planning_status: string | null
          position: number
          previous_sprint_id: string | null
          priority: string
          size_reference: string | null
          sprint_id: string | null
          start_date: string | null
          status: string
          status_changed_at: string | null
          story_points: number
          team_id: string
          title: string
          updated_at: string
          voted_at: string | null
          voted_by: string | null
        }
        Insert: {
          acceptance_criteria?: string | null
          added_to_sprint_at?: string | null
          ai_fp_breakdown?: Json | null
          ai_fp_confidence?: number | null
          ai_fp_validated?: boolean
          apf_counting_session_id?: string | null
          apf_factor_sigla?: string | null
          apf_function_sigla?: string | null
          apf_pf_bruto?: number | null
          apf_pf_fs?: number | null
          assignee_id?: string | null
          backlog_order?: number | null
          code: string
          contract_id?: string | null
          created_at?: string
          custom_fields?: Json | null
          description?: string | null
          end_date?: string | null
          epic_id?: string | null
          estimated_hours?: number | null
          external_reference?: string | null
          function_points?: number | null
          id?: string
          planning_status?: string | null
          position?: number
          previous_sprint_id?: string | null
          priority?: string
          size_reference?: string | null
          sprint_id?: string | null
          start_date?: string | null
          status?: string
          status_changed_at?: string | null
          story_points?: number
          team_id: string
          title: string
          updated_at?: string
          voted_at?: string | null
          voted_by?: string | null
        }
        Update: {
          acceptance_criteria?: string | null
          added_to_sprint_at?: string | null
          ai_fp_breakdown?: Json | null
          ai_fp_confidence?: number | null
          ai_fp_validated?: boolean
          apf_counting_session_id?: string | null
          apf_factor_sigla?: string | null
          apf_function_sigla?: string | null
          apf_pf_bruto?: number | null
          apf_pf_fs?: number | null
          assignee_id?: string | null
          backlog_order?: number | null
          code?: string
          contract_id?: string | null
          created_at?: string
          custom_fields?: Json | null
          description?: string | null
          end_date?: string | null
          epic_id?: string | null
          estimated_hours?: number | null
          external_reference?: string | null
          function_points?: number | null
          id?: string
          planning_status?: string | null
          position?: number
          previous_sprint_id?: string | null
          priority?: string
          size_reference?: string | null
          sprint_id?: string | null
          start_date?: string | null
          status?: string
          status_changed_at?: string | null
          story_points?: number
          team_id?: string
          title?: string
          updated_at?: string
          voted_at?: string | null
          voted_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_stories_apf_counting_session_id_fkey"
            columns: ["apf_counting_session_id"]
            isOneToOne: false
            referencedRelation: "apf_counting_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_stories_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_stories_epic_id_fkey"
            columns: ["epic_id"]
            isOneToOne: false
            referencedRelation: "epics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_stories_previous_sprint_id_fkey"
            columns: ["previous_sprint_id"]
            isOneToOne: false
            referencedRelation: "sprints"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_stories_previous_sprint_id_fkey"
            columns: ["previous_sprint_id"]
            isOneToOne: false
            referencedRelation: "vw_sprint_pf_summary"
            referencedColumns: ["sprint_id"]
          },
          {
            foreignKeyName: "user_stories_sprint_id_fkey"
            columns: ["sprint_id"]
            isOneToOne: false
            referencedRelation: "sprints"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_stories_sprint_id_fkey"
            columns: ["sprint_id"]
            isOneToOne: false
            referencedRelation: "vw_sprint_pf_summary"
            referencedColumns: ["sprint_id"]
          },
          {
            foreignKeyName: "user_stories_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      user_story_code_repair_log: {
        Row: {
          external_reference: string | null
          id: string
          migration_key: string
          new_code: string
          old_code: string
          repaired_at: string
          story_id: string
          team_id: string
        }
        Insert: {
          external_reference?: string | null
          id?: string
          migration_key: string
          new_code: string
          old_code: string
          repaired_at?: string
          story_id: string
          team_id: string
        }
        Update: {
          external_reference?: string | null
          id?: string
          migration_key?: string
          new_code?: string
          old_code?: string
          repaired_at?: string
          story_id?: string
          team_id?: string
        }
        Relationships: []
      }
      user_usage_events: {
        Row: {
          correlation_id: string | null
          created_at: string
          entity_id: string | null
          entity_type: string | null
          event_type: string
          id: string
          ip_hash: string | null
          metadata_json: Json | null
          project_id: string | null
          session_id: string | null
          source: string
          tenant_id: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          correlation_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          event_type: string
          id?: string
          ip_hash?: string | null
          metadata_json?: Json | null
          project_id?: string | null
          session_id?: string | null
          source?: string
          tenant_id: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          correlation_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          event_type?: string
          id?: string
          ip_hash?: string | null
          metadata_json?: Json | null
          project_id?: string | null
          session_id?: string | null
          source?: string
          tenant_id?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_usage_events_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_usage_events_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      workflow_columns: {
        Row: {
          color_class: string
          dot_color: string
          hex: string | null
          id: string
          key: string
          label: string
          sort_order: number
          team_id: string
          wip_limit: number | null
        }
        Insert: {
          color_class: string
          dot_color: string
          hex?: string | null
          id?: string
          key: string
          label: string
          sort_order?: number
          team_id: string
          wip_limit?: number | null
        }
        Update: {
          color_class?: string
          dot_color?: string
          hex?: string | null
          id?: string
          key?: string
          label?: string
          sort_order?: number
          team_id?: string
          wip_limit?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "workflow_columns_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      ai_provider_keys_status: {
        Row: {
          configured: boolean | null
          created_at: string | null
          provider: string | null
          updated_at: string | null
        }
        Insert: {
          configured?: never
          created_at?: string | null
          provider?: never
          updated_at?: string | null
        }
        Update: {
          configured?: never
          created_at?: string | null
          provider?: never
          updated_at?: string | null
        }
        Relationships: []
      }
      nome_da_view: {
        Row: {
          id: string | null
          situacao: string | null
          team_id: string | null
          total_transitions: number | null
          updated_at: string | null
        }
        Relationships: [
          {
            foreignKeyName: "demandas_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      v_apex_usage_report: {
        Row: {
          apex_app_name: string | null
          application_id: string | null
          avg_response_time_ms: number | null
          error_requests: number | null
          integration_id: string | null
          integration_name: string | null
          organization_id: string | null
          organization_name: string | null
          successful_requests: number | null
          total_requests: number | null
          total_rows_returned: number | null
          unique_users: number | null
          usage_date: string | null
        }
        Relationships: [
          {
            foreignKeyName: "apex_integrations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      v_apf_accuracy_trend: {
        Row: {
          accuracy_pct: number | null
          complexity_accuracy_pct: number | null
          corrected_items: number | null
          provider_id: string | null
          team_id: string | null
          total_items: number | null
          type_accuracy_pct: number | null
          week: string | null
        }
        Relationships: [
          {
            foreignKeyName: "apf_validation_events_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "ai_providers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "apf_validation_events_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      v_apf_confidence_calibration: {
        Row: {
          actual_accuracy: number | null
          calibration_error: number | null
          confidence_bucket: number | null
          total: number | null
        }
        Relationships: []
      }
      v_apf_confusion_matrix: {
        Row: {
          ai_complexity: string | null
          ai_functional_type: string | null
          occurrences: number | null
          pct_of_ai_type: number | null
          validated_complexity: string | null
          validated_functional_type: string | null
        }
        Relationships: []
      }
      v_apf_process_learning_accuracy: {
        Row: {
          candidate_fragmentation_mean_absolute_error: number | null
          default_selection_accuracy_pct: number | null
          default_selection_mean_absolute_error: number | null
          exact_default_selection: number | null
          factor_confirmation_accuracy_pct: number | null
          factor_override_count: number | null
          mean_absolute_pf_adjustment: number | null
          over_fragmented_analyses: number | null
          project_id: string | null
          team_id: string | null
          total_analyses: number | null
          under_fragmented_analyses: number | null
          user_added_processes: number | null
          user_removed_default_processes: number | null
          week: string | null
        }
        Relationships: [
          {
            foreignKeyName: "apf_process_learning_events_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "apf_process_learning_events_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      v_api_gateway_usage_daily: {
        Row: {
          application_id: string | null
          avg_response_time_ms: number | null
          error_requests: number | null
          organization_id: string | null
          p95_response_time_ms: number | null
          success_requests: number | null
          total_request_bytes: number | null
          total_requests: number | null
          total_response_bytes: number | null
          unique_traces: number | null
          unique_users: number | null
          usage_date: string | null
        }
        Relationships: [
          {
            foreignKeyName: "api_gateway_usage_events_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "api_gateway_applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "api_gateway_usage_events_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      v_copilot_top_intents: {
        Row: {
          avg_processing_time_ms: number | null
          intent: string | null
          organization_id: string | null
          success_rate_pct: number | null
          unique_users: number | null
          usage_count: number | null
        }
        Relationships: [
          {
            foreignKeyName: "copilot_plugin_interactions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      v_copilot_usage_report: {
        Row: {
          avg_processing_time_ms: number | null
          error_interactions: number | null
          helpful_feedback: number | null
          helpful_rate_pct: number | null
          interaction_date: string | null
          no_results_interactions: number | null
          not_helpful_feedback: number | null
          organization_id: string | null
          organization_name: string | null
          plugin_id: string | null
          plugin_name: string | null
          success_rate_pct: number | null
          successful_interactions: number | null
          total_estimated_cost_usd: number | null
          total_interactions: number | null
          total_tokens: number | null
          unique_users: number | null
        }
        Relationships: [
          {
            foreignKeyName: "copilot_plugin_interactions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      v_dora_dashboard: {
        Row: {
          calculated_at: string | null
          cfr_display: string | null
          change_failure_rate: number | null
          deployment_frequency: number | null
          dora_classification: string | null
          failed_deployments: number | null
          frequency_display: string | null
          granularity: string | null
          lead_time_display: string | null
          lead_time_for_changes_median_seconds: number | null
          lead_time_for_changes_p95_seconds: number | null
          lead_time_for_changes_seconds: number | null
          mttr_display: string | null
          organization_id: string | null
          organization_name: string | null
          period_end: string | null
          period_start: string | null
          project_id: string | null
          project_name: string | null
          resolved_incidents: number | null
          successful_deployments: number | null
          team_id: string | null
          team_name: string | null
          time_to_restore_service_median_seconds: number | null
          time_to_restore_service_p95_seconds: number | null
          time_to_restore_service_seconds: number | null
          total_deployments: number | null
          total_incidents: number | null
        }
        Relationships: [
          {
            foreignKeyName: "dora_metrics_snapshots_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dora_metrics_snapshots_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dora_metrics_snapshots_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      v_executive_adoption_report: {
        Row: {
          active_days: number | null
          avg_dau: number | null
          peak_dau: number | null
          tenant_id: string | null
          tenant_name: string | null
          total_ai_interactions: number | null
          total_copilot_interactions: number | null
          total_hu_interactions: number | null
          total_report_exports: number | null
          total_teams_interactions: number | null
        }
        Relationships: [
          {
            foreignKeyName: "user_usage_events_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      v_hu_git_summary: {
        Row: {
          commit_count: number | null
          deployment_count: number | null
          hu_code: string | null
          hu_id: string | null
          hu_status: string | null
          hu_title: string | null
          last_git_activity_at: string | null
          latest_mr: Json | null
          latest_production_deployment: Json | null
          mr_count: number | null
          project_id: string | null
          project_name: string | null
        }
        Relationships: [
          {
            foreignKeyName: "teams_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      v_integration_health_report: {
        Row: {
          avg_success_duration_ms: number | null
          dead_letter_count: number | null
          error_count: number | null
          external_system: string | null
          first_event_at: string | null
          integration_type: string | null
          last_event_at: string | null
          retry_count: number | null
          success_count: number | null
          success_rate_pct: number | null
          tenant_id: string | null
          timeout_count: number | null
          total_events: number | null
        }
        Relationships: [
          {
            foreignKeyName: "integration_usage_events_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      v_oracle_job_health: {
        Row: {
          avg_duration_ms_7d: number | null
          extraction_strategy: string | null
          failed_runs_last_7d: number | null
          integration_id: string | null
          integration_name: string | null
          is_active: boolean | null
          job_id: string | null
          job_name: string | null
          job_type: string | null
          last_run_at: string | null
          last_run_duration_ms: number | null
          last_run_error: string | null
          last_run_rows: number | null
          last_run_status: string | null
          next_run_at: string | null
          organization_id: string | null
          organization_name: string | null
          runs_last_7d: number | null
        }
        Relationships: [
          {
            foreignKeyName: "oracle_integrations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      v_redmine_integration_health: {
        Row: {
          failed_syncs_last_24h: number | null
          integration_id: string | null
          integration_name: string | null
          is_active: boolean | null
          last_sync_at: string | null
          last_sync_error: string | null
          last_sync_items: number | null
          last_sync_status: string | null
          linked_entities: number | null
          linked_issues: number | null
          organization_id: string | null
          organization_name: string | null
          syncs_last_24h: number | null
        }
        Relationships: [
          {
            foreignKeyName: "redmine_integrations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      v_sprint_risk_dashboard: {
        Row: {
          active_predictions: number | null
          avg_risk_score: number | null
          critical_count: number | null
          false_positives: number | null
          high_count: number | null
          last_prediction_at: string | null
          low_count: number | null
          max_risk_score: number | null
          medium_count: number | null
          missed_risks: number | null
          organization_id: string | null
          organization_name: string | null
          project_id: string | null
          project_name: string | null
          sprint_end: string | null
          sprint_id: string | null
          sprint_name: string | null
          sprint_start: string | null
          with_feedback: number | null
        }
        Relationships: [
          {
            foreignKeyName: "sprint_risk_events_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sprint_risk_events_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sprint_risk_events_sprint_id_fkey"
            columns: ["sprint_id"]
            isOneToOne: false
            referencedRelation: "sprints"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sprint_risk_events_sprint_id_fkey"
            columns: ["sprint_id"]
            isOneToOne: false
            referencedRelation: "vw_sprint_pf_summary"
            referencedColumns: ["sprint_id"]
          },
        ]
      }
      v_sustentacao_orfas: {
        Row: {
          created_at: string | null
          id: string | null
          project_id: string | null
          rhm: string | null
          situacao: string | null
          team_id: string | null
          team_name: string | null
          titulo: string | null
        }
        Relationships: [
          {
            foreignKeyName: "demandas_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "demandas_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      v_teams_adoption_report: {
        Row: {
          avg_processing_time_ms: number | null
          command_count: number | null
          error_count: number | null
          hu_commands: number | null
          impediment_commands: number | null
          installed_at: string | null
          integration_id: string | null
          integration_name: string | null
          is_active: boolean | null
          last_interaction_at: string | null
          organization_id: string | null
          organization_name: string | null
          permission_denied_count: number | null
          risk_commands: number | null
          status_commands: number | null
          total_interactions: number | null
          unique_users: number | null
        }
        Relationships: [
          {
            foreignKeyName: "teams_integrations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      v_teams_notification_health: {
        Row: {
          avg_latency_ms: number | null
          event_type: string | null
          failed_count: number | null
          integration_id: string | null
          notification_date: string | null
          organization_id: string | null
          organization_name: string | null
          success_count: number | null
          success_rate_pct: number | null
          total_sent: number | null
        }
        Relationships: [
          {
            foreignKeyName: "teams_integrations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      v_user_story_code_duplicates: {
        Row: {
          code: string | null
          duplicate_count: number | null
          story_ids: string[] | null
          team_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_stories_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      vw_contract_coverage: {
        Row: {
          com_contrato: number | null
          sem_contrato: number | null
          tabela: string | null
          total: number | null
        }
        Relationships: []
      }
      vw_projetos: {
        Row: {
          contract_id: string | null
          contract_name: string | null
          created_at: string | null
          descricao: string | null
          equipe: string | null
          id: string | null
          nome: string | null
          sla: string | null
          sla_id: string | null
          source: string | null
          team_id: string | null
          updated_at: string | null
        }
        Relationships: []
      }
      vw_rdms_sem_projeto: {
        Row: {
          codigo: string | null
          created_at: string | null
          id: string | null
          nome: string | null
          sistema_modulo: string | null
          team_id: string | null
          team_name: string | null
          team_project_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rdms_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teams_project_id_fkey"
            columns: ["team_project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      vw_sprint_pf_summary: {
        Row: {
          avg_delta_pf: number | null
          last_count_at: string | null
          sprint_id: string | null
          sprint_name: string | null
          stories_validated: number | null
          total_ai_pf: number | null
          total_stories_counted: number | null
          total_validated_pf: number | null
        }
        Relationships: []
      }
      vw_user_contract_roles: {
        Row: {
          contract_id: string | null
          contract_name: string | null
          display_name: string | null
          email: string | null
          role_contrato: Database["public"]["Enums"]["app_role"] | null
          role_global: Database["public"]["Enums"]["app_role"] | null
        }
        Relationships: [
          {
            foreignKeyName: "user_contracts_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      _assert_team_access: {
        Args: { p_team_ids: string[] }
        Returns: undefined
      }
      accept_organization_invitation: {
        Args: { p_token: string }
        Returns: {
          accepted: boolean
          membership_role: string
          organization_id: string
          organization_name: string
          result_status: string
        }[]
      }
      add_organization_team_member_v2: {
        Args: {
          p_org_id: string
          p_role?: string
          p_team_id: string
          p_user_id: string
        }
        Returns: string
      }
      anonymize_ai_briefing: {
        Args: { p_briefing_id: string }
        Returns: undefined
      }
      apf_create_dpf_globalweb_model: {
        Args: { p_contract_id: string }
        Returns: string
      }
      apf_import_baseline: {
        Args: {
          p_activate?: boolean
          p_function_types?: Json
          p_impact_factors?: Json
          p_items?: Json
          p_label?: string
          p_project_id: string
          p_source_name?: string
          p_source_summary?: Json
          p_version: string
        }
        Returns: Json
      }
      apf_import_project_baseline: {
        Args: {
          p_activate?: boolean
          p_function_types?: Json
          p_impact_factors?: Json
          p_items?: Json
          p_label?: string
          p_project_id: string
          p_source_name?: string
          p_source_summary?: Json
          p_version: string
        }
        Returns: Json
      }
      apply_ai_briefing_suggestion: {
        Args: { p_suggestion_id: string }
        Returns: {
          application_id: string
          target_id: string
          target_type: string
        }[]
      }
      archive_expired_briefings: { Args: never; Returns: number }
      archive_organization_company_v2: {
        Args: { p_company_id: string; p_org_id: string }
        Returns: undefined
      }
      archive_organization_contract_v2: {
        Args: { p_contract_id: string; p_org_id: string }
        Returns: undefined
      }
      archive_organization_project_v2: {
        Args: { p_org_id: string; p_project_id: string }
        Returns: undefined
      }
      archive_platform_ai_provider_v2: {
        Args: { p_provider_id: string }
        Returns: undefined
      }
      archive_platform_saas_plan_v1: {
        Args: { p_plan_id: string }
        Returns: undefined
      }
      assert_backoffice_staff: {
        Args: { p_allowed_roles?: string[] }
        Returns: {
          avatar_url: string | null
          created_at: string
          department: string | null
          email: string
          full_name: string
          id: string
          is_active: boolean
          last_login_at: string | null
          role: string
          updated_at: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "owner_staff_members"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      assert_organization_entitlement: {
        Args: { p_feature_key: string; p_org_id: string }
        Returns: undefined
      }
      assert_organization_operational_admin: {
        Args: { p_org_id: string }
        Returns: undefined
      }
      assert_organization_resource_capacity: {
        Args: { p_feature_key: string; p_org_id: string }
        Returns: undefined
      }
      assert_platform_admin_v2: { Args: never; Returns: undefined }
      build_apf_prompt:
        | { Args: { p_contract_id: string; p_hu_text?: string }; Returns: Json }
        | { Args: { p_session_id: string }; Returns: Json }
      calc_horas_uteis: {
        Args: {
          p_fim: string
          p_inicio: string
          p_regime?: string
          p_uf?: string
        }
        Returns: number
      }
      calc_imr_periodo: {
        Args: {
          p_e8_alerta?: number
          p_e8_glosa?: number
          p_fim: string
          p_inicio: string
          p_team_id: string
        }
        Returns: Json
      }
      calc_kpis_sustentacao: {
        Args: {
          p_backlog_dias?: number
          p_sla_risco_h?: number
          p_team_id: string
        }
        Returns: Json
      }
      calc_sla_demanda: {
        Args: { p_demanda_id: string; p_regime?: string; p_uf?: string }
        Returns: Json
      }
      calculate_apf_item: {
        Args: {
          p_factor_sigla: string
          p_function_sigla: string
          p_model_id: string
        }
        Returns: {
          action_on_baseline: string
          contribution_pct: number
          factor_name: string
          function_name: string
          pf_bruto: number
          pf_fs: number
        }[]
      }
      calculate_dora_metrics: {
        Args: {
          p_granularity?: string
          p_organization_id: string
          p_period_end?: string
          p_period_start?: string
          p_project_id?: string
          p_team_id?: string
        }
        Returns: {
          calculated_at: string
          calculation_metadata: Json | null
          change_failure_rate: number | null
          change_failure_rate_benchmark: number | null
          deployment_frequency: number | null
          deployment_frequency_benchmark: number | null
          dora_classification: string | null
          failed_deployments: number | null
          granularity: string
          id: string
          incidents_sev1: number | null
          incidents_sev2: number | null
          incidents_sev3: number | null
          incidents_sev4: number | null
          lead_time_benchmark_seconds: number | null
          lead_time_for_changes_median_seconds: number | null
          lead_time_for_changes_p95_seconds: number | null
          lead_time_for_changes_seconds: number | null
          mttr_benchmark_seconds: number | null
          organization_id: string
          period_end: string
          period_start: string
          project_id: string | null
          resolved_incidents: number | null
          rolled_back_deployments: number | null
          successful_deployments: number | null
          team_id: string | null
          time_to_restore_service_median_seconds: number | null
          time_to_restore_service_p95_seconds: number | null
          time_to_restore_service_seconds: number | null
          total_deployments: number | null
          total_incidents: number | null
        }
        SetofOptions: {
          from: "*"
          to: "dora_metrics_snapshots"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      can_access_ai_briefing: {
        Args: { p_org_id: string; p_team_id: string }
        Returns: boolean
      }
      can_operate_contract_v2: {
        Args: { p_contract_id: string; p_user_id?: string }
        Returns: boolean
      }
      can_operate_organization: { Args: { p_org_id: string }; Returns: boolean }
      can_read_contract_v2: {
        Args: { p_contract_id: string; p_user_id?: string }
        Returns: boolean
      }
      can_read_organization: { Args: { p_org_id: string }; Returns: boolean }
      can_view_team: {
        Args: { _team_id: string; _user_id: string }
        Returns: boolean
      }
      check_license_quota: { Args: { p_team_id: string }; Returns: Json }
      claim_next_apf_job: {
        Args: never
        Returns: {
          attempts: number
          created_at: string
          created_by: string | null
          error_message: string | null
          finished_at: string | null
          generation_id: string | null
          id: string
          max_attempts: number
          next_attempt_at: string
          payload: Json
          result: Json | null
          started_at: string | null
          status: string
          team_id: string
          type: string
        }[]
        SetofOptions: {
          from: "*"
          to: "apf_jobs"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      complete_ai_briefing_run: {
        Args: {
          p_duration_ms?: number
          p_estimated_cost?: number
          p_input_tokens?: number
          p_model_name: string
          p_output_payload: Json
          p_output_tokens?: number
          p_provider_id: string
          p_run_id: string
        }
        Returns: number
      }
      complete_correlation_context: {
        Args: {
          p_correlation_id: string
          p_error_message?: string
          p_status?: string
        }
        Returns: undefined
      }
      compute_learning_metrics: {
        Args: { p_week_start?: string }
        Returns: Json
      }
      consolidate_apf_patterns: {
        Args: {
          p_lookback_days?: number
          p_min_evidence?: number
          p_team_id?: string
        }
        Returns: Json
      }
      create_ai_briefing: {
        Args: {
          p_briefing_type: string
          p_language?: string
          p_meeting_date?: string
          p_org_id: string
          p_participants?: Json
          p_project_id?: string
          p_source_content: string
          p_source_hash: string
          p_source_type?: string
          p_sprint_id?: string
          p_team_id?: string
          p_title: string
        }
        Returns: string
      }
      create_backoffice_billing_record: {
        Args: {
          p_amount?: number
          p_billing_period: string
          p_due_date: string
          p_notes?: string
          p_tenant_id: string
        }
        Returns: string
      }
      create_correlation_context: {
        Args: {
          p_initiated_by_application_id?: string
          p_initiated_by_user_id?: string
          p_organization_id?: string
          p_parent_correlation_id?: string
          p_source_component?: string
          p_source_system: string
          p_trace_metadata?: Json
        }
        Returns: string
      }
      create_default_retention_policies: {
        Args: { p_tenant_id: string }
        Returns: undefined
      }
      create_organization_company_v2: {
        Args: {
          p_cnpj?: string
          p_email?: string
          p_logo_url?: string
          p_name: string
          p_org_id: string
          p_phone?: string
          p_status?: string
        }
        Returns: string
      }
      create_organization_contract_v2: {
        Args: {
          p_company_id?: string
          p_currency?: string
          p_ends_at?: string
          p_name: string
          p_number?: string
          p_object?: string
          p_org_id: string
          p_starts_at?: string
          p_status?: string
          p_value_per_pfus?: number
        }
        Returns: string
      }
      create_organization_invitation: {
        Args: {
          p_email: string
          p_expires_at?: string
          p_invited_by: string
          p_module_keys: string[]
          p_org_id: string
          p_role: string
        }
        Returns: {
          expires_at: string
          invitation_id: string
          normalized_email: string
          raw_token: string
        }[]
      }
      create_organization_project_v2: {
        Args: {
          p_code?: string
          p_contract_id: string
          p_description?: string
          p_module_type?: string
          p_name: string
          p_org_id: string
          p_redmine_id?: number
          p_team_id: string
        }
        Returns: string
      }
      create_organization_team_v2: {
        Args: {
          p_company_id?: string
          p_contract_id?: string
          p_module: string
          p_name: string
          p_org_id: string
        }
        Returns: string
      }
      create_platform_ai_provider_v2: {
        Args: {
          p_api_base_url?: string
          p_is_active?: boolean
          p_is_recommended?: boolean
          p_model?: string
          p_name: string
          p_provider_type: string
          p_request_format?: string
        }
        Returns: string
      }
      create_platform_saas_plan_v1: {
        Args: {
          p_code: string
          p_description: string
          p_metadata: Json
          p_name: string
          p_status: string
        }
        Returns: string
      }
      deactivate_backoffice_staff_member: {
        Args: { p_staff_id: string }
        Returns: undefined
      }
      deactivate_organization_member_v2: {
        Args: { p_org_id: string; p_user_id: string }
        Returns: boolean
      }
      deactivate_organization_team_v2: {
        Args: { p_org_id: string; p_team_id: string }
        Returns: undefined
      }
      delete_ai_briefing: {
        Args: { p_briefing_id: string }
        Returns: undefined
      }
      delete_ai_provider_key: { Args: { p_id: string }; Returns: undefined }
      delete_apf_project_baseline: {
        Args: { p_baseline_id: string }
        Returns: Json
      }
      delete_platform_organization_entitlement_override_v1: {
        Args: { p_feature_key: string; p_org_id: string }
        Returns: undefined
      }
      delete_platform_plan_entitlement_v1: {
        Args: { p_feature_key: string; p_plan_id: string }
        Returns: undefined
      }
      extract_user_story_external_reference: {
        Args: { p_title: string }
        Returns: string
      }
      fail_ai_briefing_run: {
        Args: {
          p_duration_ms?: number
          p_error_code: string
          p_error_detail?: string
          p_model_name?: string
          p_provider_id?: string
          p_run_id: string
        }
        Returns: undefined
      }
      finalize_ai_briefing_usage: {
        Args: {
          p_error_code?: string
          p_metadata?: Json
          p_provider_id?: string
          p_request_id: string
          p_status: string
        }
        Returns: undefined
      }
      finalize_ai_usage: {
        Args: {
          p_error_code?: string
          p_metadata?: Json
          p_provider_id?: string
          p_request_id: string
          p_status: string
        }
        Returns: undefined
      }
      fn_audit_log_insert: {
        Args: {
          p_action: string
          p_actor_id: string
          p_new_data?: Json
          p_old_data?: Json
          p_target_id: string
          p_target_table: string
        }
        Returns: undefined
      }
      fn_get_contract_tree: { Args: { p_contract_id?: string }; Returns: Json }
      fn_get_fewshot_examples: {
        Args: { p_limit?: number }
        Returns: {
          story_acceptance_criteria: string
          story_code: string
          story_description: string
          story_title: string
          validated_breakdown: Json
          validated_total_pf: number
          validation_notes: string
        }[]
      }
      fn_get_project_sla_matrix: {
        Args: { p_project_id: string }
        Returns: Json
      }
      fn_get_team_contract: { Args: { p_team_id: string }; Returns: Json }
      fn_get_user_contracts: {
        Args: { p_user_id?: string }
        Returns: {
          contract_id: string
          contract_name: string
          role: string
          room_mode: string
          status: string
          total_teams: number
        }[]
      }
      fn_rdm_criar_com_checklist: {
        Args: {
          p_ambiente: string
          p_criado_por: string
          p_data_implantacao: string
          p_downtime_previsto: boolean
          p_hora_fim_prevista: string
          p_hora_inicio: string
          p_nome: string
          p_objetivo: string
          p_observacoes: string
          p_risco: string
          p_rollback_previsto: boolean
          p_sistema_modulo: string
          p_sprint_id: string
          p_team_id: string
          p_tempo_rollback_minutos: number
          p_tipo_mudanca: string
        }
        Returns: string
      }
      fn_rdm_dashboard_kpis: {
        Args: { p_fim?: string; p_inicio?: string; p_team_id?: string }
        Returns: Json
      }
      fn_rdm_has_permission: {
        Args: { p_permission_key: string }
        Returns: boolean
      }
      fn_rdm_user_team_ids: { Args: never; Returns: string[] }
      fn_resolve_demanda_context: {
        Args: { p_demanda_id: string }
        Returns: Json
      }
      fn_resolve_sla_limits: {
        Args: { p_demanda_id: string; p_priority?: string }
        Returns: {
          business_hours: boolean
          resolution_minutes: number
          response_minutes: number
          source: string
        }[]
      }
      fn_sla_contract_panel: {
        Args: { p_contract_id: string; p_limit_risco?: number }
        Returns: Json
      }
      fn_sla_dashboard_batch: {
        Args: {
          p_contract_id?: string
          p_limit?: number
          p_project_id?: string
          p_regime?: string
          p_team_id?: string
          p_uf?: string
        }
        Returns: Json
      }
      fn_sla_status_summary: {
        Args: { p_contract_id?: string; p_project_id?: string }
        Returns: Json
      }
      generate_backoffice_monthly_billing: {
        Args: { p_due_day?: number; p_reference_date?: string }
        Returns: number
      }
      generate_briefing_agenda: {
        Args: { p_briefing_type?: string; p_limit?: number; p_team_id: string }
        Returns: {
          description: string
          due_date: string
          ordinal: number
          priority_hint: string
          section: string
          source_briefing_id: string
          source_briefing_title: string
          suggestion_type: string
          title: string
        }[]
      }
      get_accessible_companies_v2: {
        Args: { p_org_id: string }
        Returns: {
          cnpj: string
          created_at: string
          email: string
          id: string
          logo_url: string
          name: string
          org_id: string
          phone: string
          status: string
          team_count: number
        }[]
      }
      get_accessible_contracts_v2: {
        Args: { p_org_id: string }
        Returns: {
          company_id: string
          currency: string
          description: string
          ends_at: string
          id: string
          name: string
          number: string
          object: string
          org_id: string
          project_count: number
          room_mode: string
          sla_count: number
          starts_at: string
          status: string
          value_per_pfus: number
        }[]
      }
      get_accessible_projects_v2: {
        Args: { p_contract_id: string; p_org_id: string }
        Returns: {
          code: string
          contract_id: string
          contract_name: string
          created_at: string
          description: string
          id: string
          legacy_projetos_id: string
          module_type: string
          name: string
          org_id: string
          redmine_id: number
          sla_id: string
          status: string
          team_id: string
          team_name: string
          updated_at: string
        }[]
      }
      get_accessible_teams_v2: {
        Args: { p_org_id: string }
        Returns: {
          id: string
          module: string
          name: string
          org_id: string
        }[]
      }
      get_active_apf_context: { Args: { p_project_id: string }; Returns: Json }
      get_admin_kpis: {
        Args: { p_sla_dias?: number; p_team_ids: string[] }
        Returns: Json
      }
      get_ai_briefing_team_followup: {
        Args: { p_team_id: string }
        Returns: {
          applied_items: number
          attention_items: Json
          overdue_items: number
          pending_review: number
          ready_to_apply: number
          team_id: string
          total_briefings: number
        }[]
      }
      get_ai_briefing_team_outcomes: {
        Args: { p_team_id: string }
        Returns: {
          completed_items: number
          missing_items: number
          open_items: number
          overdue_items: number
          total_applied: number
        }[]
      }
      get_ai_provider_key: { Args: { p_provider: string }; Returns: string }
      get_ai_provider_key_by_id: { Args: { p_id: string }; Returns: string }
      get_apf_baseline_candidates: {
        Args: { p_limit?: number; p_project_id: string; p_story_text: string }
        Returns: {
          category_sigla: string
          complexity: string
          contribution_pct: number
          description: string
          factor_sigla: string
          function_sigla: string
          id: string
          is_measurable: boolean
          item_ref: string
          match_score: number
          module: string
          notes: string
          pf_bruto: number
          pf_fs: number
        }[]
      }
      get_apf_baseline_exact_items: {
        Args: { p_item_refs: string[]; p_project_id: string }
        Returns: {
          category_sigla: string
          complexity: string
          contribution_pct: number
          description: string
          factor_sigla: string
          function_sigla: string
          id: string
          is_measurable: boolean
          item_ref: string
          match_score: number
          module: string
          notes: string
          pf_bruto: number
          pf_fs: number
        }[]
      }
      get_apf_metric_history_for_story: {
        Args: { p_project_id: string; p_story_id: string }
        Returns: {
          created_at: string
          description: string
          factor_sigla: string
          function_sigla: string
          id: string
          is_measurable: boolean
          notes: string | null
          pf_bruto: number
          pf_fs: number
          reference_code: string
          source_measurement: string | null
          system_key: string
        }
        SetofOptions: {
          from: "*"
          to: "apf_metric_factor_history"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      get_apf_model_by_contract: {
        Args: { p_contract_id: string }
        Returns: Json
      }
      get_apf_process_analysis: {
        Args: { p_analysis_id: string }
        Returns: Json
      }
      get_apf_project_process_candidates: {
        Args: { p_limit?: number; p_project_id: string; p_story_text: string }
        Returns: {
          baseline_id: string
          item_count: number
          items: Json
          match_score: number
          process_name: string
          process_ref: string
          total_pf_bruto: number
        }[]
      }
      get_apf_project_process_candidates_unfiltered: {
        Args: { p_limit?: number; p_project_id: string; p_story_text: string }
        Returns: {
          baseline_id: string
          item_count: number
          items: Json
          match_score: number
          process_name: string
          process_ref: string
          total_pf_bruto: number
        }[]
      }
      get_apf_session_summary: { Args: { p_session_id: string }; Returns: Json }
      get_backoffice_dashboard_summary: {
        Args: never
        Returns: {
          active_staff_members: number
          active_subscriptions: number
          active_tenants: number
          past_due_subscriptions: number
          staff_members: number
          suspended_tenants: number
          total_tenants: number
          trial_tenants: number
        }[]
      }
      get_backoffice_saas_metrics: {
        Args: never
        Returns: {
          active_tenants: number
          arr: number
          churn_rate: number
          churned_tenants: number
          mrr: number
          open_tickets: number
          overdue_invoices: number
          paid_revenue: number
          trial_tenants: number
        }[]
      }
      get_briefing_backoffice_by_organization: {
        Args: never
        Returns: {
          current_month_runs: number
          monthly_limit: number
          org_id: string
          org_name: string
          plan_code: string
          runs_remaining: number
          suggestion_rate: number
          total_applied: number
          total_briefings: number
          total_cost: number
          total_runs: number
          total_suggestions: number
          total_tokens: number
        }[]
      }
      get_briefing_backoffice_by_provider: {
        Args: never
        Returns: {
          avg_cost_per_run: number
          avg_duration_ms: number
          failed_runs: number
          provider_id: string
          provider_name: string
          provider_type: string
          success_runs: number
          total_cost: number
          total_input_tokens: number
          total_output_tokens: number
          total_runs: number
        }[]
      }
      get_briefing_backoffice_summary: {
        Args: never
        Returns: {
          avg_duration_ms: number
          current_month_cost: number
          current_month_runs: number
          suggestion_approval_rate: number
          total_ai_runs: number
          total_applied: number
          total_briefings: number
          total_estimated_cost: number
          total_failed: number
          total_input_tokens: number
          total_organizations: number
          total_output_tokens: number
          total_suggestions: number
          total_teams: number
          total_usage_events: number
        }[]
      }
      get_briefing_backoffice_team_summary: {
        Args: { p_org_id?: string }
        Returns: {
          org_name: string
          overdue_items: number
          pending_review: number
          team_id: string
          team_name: string
          total_applied: number
          total_briefings: number
          total_cost: number
          total_suggestions: number
        }[]
      }
      get_capacity_planner: {
        Args: {
          p_default_cap?: number
          p_team_id?: string
          p_team_ids: string[]
        }
        Returns: Json
      }
      get_capacity_planner_sustentacao: {
        Args: {
          p_default_cap?: number
          p_team_id?: string
          p_team_ids: string[]
        }
        Returns: Json
      }
      get_default_identity_provider: {
        Args: { p_organization_id: string }
        Returns: {
          authorization_endpoint: string | null
          claim_mapping: Json | null
          client_id: string
          client_secret_encrypted: string | null
          config_json: Json | null
          created_at: string
          created_by: string | null
          id: string
          is_active: boolean | null
          is_default: boolean | null
          issuer_url: string
          jwks_url: string | null
          name: string
          organization_id: string
          provider_type: string
          scopes: string[] | null
          token_endpoint: string | null
          updated_at: string
          userinfo_endpoint: string | null
        }
        SetofOptions: {
          from: "*"
          to: "identity_providers"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      get_demandas_with_responsaveis: {
        Args: { p_team_id: string }
        Returns: Json
      }
      get_demandas_with_responsaveis_paged: {
        Args: { p_cursor?: string; p_limit?: number; p_team_id: string }
        Returns: Json[]
      }
      get_effective_organization_entitlements: {
        Args: { p_org_id: string }
        Returns: {
          enabled: boolean
          feature_key: string
          limit_value: number
          org_id: string
          plan_code: string
          source: string
          subscription_status: string
        }[]
      }
      get_hu_commits: {
        Args: { p_hu_id: string; p_limit?: number }
        Returns: {
          author_email: string | null
          author_id: number | null
          author_name: string | null
          author_username: string | null
          branch_name: string | null
          commit_sha: string
          committed_at: string
          committer_email: string | null
          committer_name: string | null
          committer_username: string | null
          created_at: string
          files_changed: Json | null
          hu_ids: string[] | null
          id: string
          integration_id: string
          message: string
          organization_id: string
          parent_shas: string[] | null
          payload: Json | null
          short_sha: string | null
          stats: Json | null
          tag_name: string | null
          web_url: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "git_commits"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      get_hu_deployments: {
        Args: { p_hu_id: string }
        Returns: {
          commit_sha: string
          correlation_id: string | null
          created_at: string
          deployable_id: number | null
          deployable_type: string | null
          deployable_url: string | null
          deployed_at: string | null
          deployment_id: number
          environment: string
          finished_at: string | null
          git_event_id: string | null
          id: string
          integration_id: string
          organization_id: string
          payload: Json | null
          project_id: string | null
          status: string
        }[]
        SetofOptions: {
          from: "*"
          to: "gitlab_deployment_events"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      get_hu_merge_requests: {
        Args: { p_hu_id: string }
        Returns: {
          action: string | null
          approved_at: string | null
          assignee_emails: string[] | null
          author_email: string | null
          author_id: number | null
          author_username: string | null
          closed_at: string | null
          created_at: string
          description: string | null
          first_review_at: string | null
          hu_ids: string[] | null
          id: string
          integration_id: string
          labels: string[] | null
          merge_commit_sha: string | null
          merged_at: string | null
          mr_id: number | null
          mr_iid: number
          organization_id: string
          payload: Json | null
          reviewer_emails: string[] | null
          source_branch: string
          source_sha: string | null
          state: string
          target_branch: string
          target_sha: string | null
          time_to_close_ms: number | null
          time_to_first_review_ms: number | null
          time_to_merge_ms: number | null
          title: string
          updated_at: string
          web_url: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "git_merge_requests"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      get_identity_provider_public_config: {
        Args: { p_organization_id: string }
        Returns: {
          authorization_endpoint: string
          claim_mapping: Json
          client_id: string
          id: string
          is_default: boolean
          issuer_url: string
          jwks_url: string
          name: string
          organization_id: string
          provider_type: string
          scopes: string[]
          token_endpoint: string
          userinfo_endpoint: string
        }[]
      }
      get_identity_provider_readiness: {
        Args: { p_organization_id: string }
        Returns: {
          active_provider_count: number
          default_provider_count: number
          mapping_count: number
          mapping_error_count: number
          provider_count: number
          providers_missing_required_config: number
          readiness_ok: boolean
        }[]
      }
      get_integration_registry: {
        Args: { p_org_id: string }
        Returns: {
          integration_id: string
          is_active: boolean
          last_activity_at: string
          last_error: string
          last_health_at: string
          last_health_latency_ms: number
          last_health_status: string
          name: string
          operational_status: string
          project_id: string
          provider: string
        }[]
      }
      get_my_backoffice_staff_profile: {
        Args: never
        Returns: {
          avatar_url: string
          created_at: string
          department: string
          email: string
          full_name: string
          id: string
          is_active: boolean
          last_login_at: string
          role: string
          updated_at: string
          user_id: string
        }[]
      }
      get_my_contract_id: { Args: { _user_id?: string }; Returns: string }
      get_my_contracts: {
        Args: { _user_id?: string }
        Returns: {
          contract_id: string
          role: Database["public"]["Enums"]["app_role"]
        }[]
      }
      get_my_module_access: { Args: never; Returns: string }
      get_my_organization_entitlements: {
        Args: { p_org_id: string }
        Returns: {
          enabled: boolean
          feature_key: string
          limit_value: number
          org_id: string
          plan_code: string
          source: string
          subscription_status: string
        }[]
      }
      get_my_organization_module_roles: {
        Args: { p_org_id: string }
        Returns: {
          module: string
          role_name: string
        }[]
      }
      get_my_organizations_v2: {
        Args: never
        Returns: {
          id: string
          is_platform_admin: boolean
          membership_role: string
          name: string
          plan: Database["public"]["Enums"]["org_plan"]
          slug: string
          status: Database["public"]["Enums"]["org_status"]
        }[]
      }
      get_org_briefing_retention_config: {
        Args: { p_org_id: string }
        Returns: Json
      }
      get_organization_account_statuses: {
        Args: { p_org_id: string }
        Returns: {
          is_active: boolean
          user_id: string
        }[]
      }
      get_organization_contract_form_options_v2: {
        Args: { p_org_id: string }
        Returns: Json
      }
      get_organization_contract_v2: {
        Args: { p_contract_id: string; p_org_id: string }
        Returns: Json
      }
      get_organization_invitation_preview: {
        Args: { p_token: string }
        Returns: {
          expires_at: string
          invitation_role: string
          invitation_status: string
          masked_email: string
          organization_name: string
        }[]
      }
      get_organization_invitations_v2: {
        Args: { p_org_id: string }
        Returns: {
          created_at: string
          email: string
          expires_at: string
          invitation_id: string
          invitation_role: string
          invitation_status: string
          invited_by_name: string
          module_keys: string[]
          send_count: number
        }[]
      }
      get_organization_members_v2: {
        Args: { p_org_id: string }
        Returns: {
          display_name: string
          email: string
          is_active: boolean
          joined_at: string
          membership_role: string
          module_keys: string[]
          user_id: string
        }[]
      }
      get_organization_settings_audit_v2: {
        Args: { p_limit?: number; p_org_id: string }
        Returns: {
          action: string
          actor_email: string
          actor_id: string
          actor_name: string
          after_values: Json
          audit_id: string
          before_values: Json
          changed_fields: string[]
          created_at: string
        }[]
      }
      get_organization_settings_v2: {
        Args: { p_org_id: string }
        Returns: {
          contact_email: string
          contact_name: string
          logo_url: string
          name: string
          organization_id: string
          plan: string
          slug: string
          status: string
          updated_at: string
        }[]
      }
      get_organization_team_members_v2: {
        Args: { p_org_id: string; p_team_id: string }
        Returns: {
          display_name: string
          email: string
          is_active: boolean
          joined_at: string
          membership_role: string
          role: string
          team_member_id: string
          user_id: string
        }[]
      }
      get_organization_teams_admin_v2: {
        Args: { p_org_id: string }
        Returns: {
          company_id: string
          contract_id: string
          created_at: string
          id: string
          is_active: boolean
          member_count: number
          module: string
          name: string
          org_id: string
        }[]
      }
      get_organization_usage_summary: {
        Args: { p_org_id: string }
        Returns: {
          ai_calls_limit: number
          ai_calls_used: number
          apf_countings_limit: number
          apf_countings_used: number
          contracts_limit: number
          contracts_used: number
          organization_id: string
          plan_code: string
          projects_limit: number
          projects_used: number
          quota_reset_at: string
          subscription_status: string
          users_limit: number
          users_used: number
        }[]
      }
      get_project_api_url: { Args: never; Returns: string }
      get_service_role_key: { Args: never; Returns: string }
      get_sprint_history: {
        Args: { p_cutoff?: string; p_team_id?: string; p_team_ids: string[] }
        Returns: Json
      }
      get_sprint_risk_predictions: {
        Args: { p_organization_id: string; p_sprint_id: string }
        Returns: {
          actual_outcome: string
          delay_probability: number
          hu_code: string
          hu_id: string
          hu_title: string
          id: string
          incomplete_probability: number
          justification: string
          key_factors: Json
          predicted_at: string
          risk_level: string
          risk_score: number
          status: string
        }[]
      }
      get_team_members_for_teams_v2: {
        Args: { p_org_id: string; p_team_ids: string[] }
        Returns: {
          display_name: string
          email: string
          role: string
          team_id: string
          user_id: string
        }[]
      }
      get_tenancy_readiness_report: {
        Args: never
        Returns: {
          affected_rows: number
          issue: string
          resource: string
        }[]
      }
      has_organization_entitlement: {
        Args: { p_feature_key: string; p_org_id: string }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      hash_ip: { Args: { p_ip: unknown }; Returns: string }
      increment_license_usage: {
        Args: { p_ai_calls?: number; p_pf_count?: number; p_team_id: string }
        Returns: undefined
      }
      is_admin: { Args: never; Returns: boolean }
      is_apf_auxiliary_action: { Args: { p_text: string }; Returns: boolean }
      is_backoffice_admin: { Args: { p_user_id?: string }; Returns: boolean }
      is_backoffice_staff: { Args: { p_user_id?: string }; Returns: boolean }
      is_contract_admin: {
        Args: { _contract_id: string; _user_id: string }
        Returns: boolean
      }
      is_contract_member: {
        Args: { _contract_id: string; _user_id: string }
        Returns: boolean
      }
      is_demanda_responsible: {
        Args: { _demanda_id: string; _user_id: string }
        Returns: boolean
      }
      is_dia_util: { Args: { p_data: string; p_uf?: string }; Returns: boolean }
      is_feriado:
        | { Args: { p_data: string; p_team_id?: string }; Returns: boolean }
        | { Args: { p_data: string; p_uf?: string }; Returns: boolean }
      is_legacy_operational_admin_fallback_enabled: {
        Args: never
        Returns: boolean
      }
      is_organization_admin: {
        Args: { p_org_id: string; p_user_id?: string }
        Returns: boolean
      }
      is_organization_legacy_permission_fallback_enabled: {
        Args: never
        Returns: boolean
      }
      is_organization_member: {
        Args: { p_org_id: string; p_user_id?: string }
        Returns: boolean
      }
      is_organization_operational_console_enabled: {
        Args: never
        Returns: boolean
      }
      is_organization_owner: {
        Args: { p_org_id: string; p_user_id?: string }
        Returns: boolean
      }
      is_organization_resource_limit_enforced: { Args: never; Returns: boolean }
      is_organization_team_admin: {
        Args: { p_team_id: string; p_user_id?: string }
        Returns: boolean
      }
      is_platform_admin: { Args: { p_user_id?: string }; Returns: boolean }
      is_team_admin: {
        Args: { _team_id: string; _user_id: string }
        Returns: boolean
      }
      is_team_in_user_contracts: {
        Args: { _team_id: string; _user_id: string }
        Returns: boolean
      }
      is_team_manager: {
        Args: { _team_id: string; _user_id: string }
        Returns: boolean
      }
      is_team_member: {
        Args: { _team_id: string; _user_id: string }
        Returns: boolean
      }
      is_tenancy_enforced: { Args: never; Returns: boolean }
      list_backoffice_billing_customers: {
        Args: never
        Returns: {
          org_id: string
          org_name: string
          plan_code: string
          plan_name: string
        }[]
      }
      list_backoffice_billing_records: {
        Args: never
        Returns: {
          amount: number
          billing_period: string
          created_at: string
          created_by: string | null
          currency: string
          due_date: string
          id: string
          invoice_url: string | null
          notes: string | null
          paid_at: string | null
          period_end: string | null
          period_start: string | null
          plan_type: string
          status: string
          tenant_id: string | null
          tenant_name: string
          updated_at: string
        }[]
        SetofOptions: {
          from: "*"
          to: "billing_records"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      list_backoffice_plan_prices: {
        Args: never
        Returns: {
          annual_price: number
          code: string
          currency: string
          id: string
          monthly_price: number
          name: string
          status: string
        }[]
      }
      list_backoffice_staff_members: {
        Args: never
        Returns: {
          avatar_url: string
          created_at: string
          department: string
          email: string
          full_name: string
          id: string
          is_active: boolean
          last_login_at: string
          role: string
          updated_at: string
          user_id: string
        }[]
      }
      list_backoffice_support_tickets: {
        Args: never
        Returns: {
          assigned_to: string | null
          category: string
          created_at: string
          description: string
          id: string
          priority: string
          reporter_email: string
          reporter_name: string
          resolved_at: string | null
          sla_deadline: string | null
          status: string
          subject: string
          tenant_id: string | null
          tenant_name: string
          ticket_number: string
          updated_at: string
        }[]
        SetofOptions: {
          from: "*"
          to: "support_tickets"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      list_platform_ai_providers_v2: {
        Args: { p_only_active?: boolean }
        Returns: {
          api_base_url: string
          created_at: string
          has_key: boolean
          id: string
          is_active: boolean
          is_recommended: boolean
          model: string
          name: string
          provider_type: string
          request_format: string
          updated_at: string
        }[]
      }
      list_platform_organization_subscriptions_v1: {
        Args: never
        Returns: {
          canceled_at: string
          contracts_used: number
          current_period_end: string
          current_period_start: string
          org_id: string
          org_name: string
          org_plan: string
          org_slug: string
          org_status: string
          overrides: Json
          plan_code: string
          plan_id: string
          plan_name: string
          projects_used: number
          source: string
          starts_at: string
          subscription_id: string
          subscription_status: string
          trial_ends_at: string
          users_used: number
        }[]
      }
      list_platform_saas_plans_v1: {
        Args: { p_include_archived: boolean }
        Returns: {
          code: string
          created_at: string
          description: string
          entitlements: Json
          id: string
          metadata: Json
          name: string
          status: string
          updated_at: string
        }[]
      }
      log_apex_usage_event: {
        Args: {
          p_apex_app_id?: number
          p_apex_page_id?: number
          p_apex_session_id?: string
          p_apex_user?: string
          p_application_id?: string
          p_axionn_user_id?: string
          p_correlation_id?: string
          p_endpoint_path?: string
          p_integration_id: string
          p_organization_id: string
          p_parameters?: Json
          p_request_type?: string
          p_response_status?: number
          p_response_time_ms?: number
          p_rows_returned?: number
        }
        Returns: string
      }
      log_api_gateway_usage: {
        Args: {
          p_aggregation_period?: string
          p_api_version?: string
          p_application_id: string
          p_authenticated_user_id?: string
          p_consumer_ip?: unknown
          p_contract_version_id?: string
          p_correlation_id?: string
          p_endpoint_path: string
          p_http_method: string
          p_metadata?: Json
          p_organization_id: string
          p_request_size_bytes?: number
          p_response_size_bytes?: number
          p_response_status: number
          p_response_time_ms?: number
          p_user_agent?: string
        }
        Returns: string
      }
      log_audit_event: {
        Args: {
          p_action: string
          p_actor_user_id?: string
          p_after_json?: Json
          p_before_json?: Json
          p_correlation_id?: string
          p_ip_hash?: string
          p_metadata_json?: Json
          p_organization_id?: string
          p_source?: string
          p_target_id?: string
          p_target_type: string
          p_user_agent?: string
        }
        Returns: string
      }
      log_auth_audit_event: {
        Args: {
          p_client_id?: string
          p_correlation_id?: string
          p_event_type: string
          p_failure_reason?: string
          p_identity_provider_id?: string
          p_ip_address?: unknown
          p_metadata?: Json
          p_organization_id?: string
          p_result: string
          p_user_agent?: string
          p_user_id?: string
        }
        Returns: string
      }
      log_copilot_interaction: {
        Args: {
          p_conversation_id?: string
          p_correlation_id?: string
          p_estimated_cost_usd?: number
          p_estimated_tokens?: number
          p_intent?: string
          p_message_id?: string
          p_ms_user_email?: string
          p_ms_user_id: string
          p_ms_user_name?: string
          p_organization_id: string
          p_parameters?: Json
          p_plugin_id: string
          p_processing_time_ms?: number
          p_query_text: string
          p_response_data?: Json
          p_response_summary?: string
          p_response_type?: string
        }
        Returns: string
      }
      log_deployment_event: {
        Args: {
          p_branch_name?: string
          p_changelog?: string
          p_commit_author_email?: string
          p_commit_author_name?: string
          p_commit_message?: string
          p_commit_sha: string
          p_committed_at?: string
          p_correlation_id?: string
          p_deployed_at: string
          p_deployment_id: string
          p_duration_seconds?: number
          p_environment?: string
          p_failed_at?: string
          p_failure_reason?: string
          p_finished_at?: string
          p_first_commit_at?: string
          p_first_commit_sha?: string
          p_metadata?: Json
          p_organization_id: string
          p_pipeline_id?: string
          p_pipeline_url?: string
          p_project_id?: string
          p_rollback_deployment_id?: string
          p_source: string
          p_status: string
          p_tag_name?: string
          p_team_id?: string
        }
        Returns: string
      }
      log_incident_event: {
        Args: {
          p_acknowledged_at?: string
          p_action_items?: string[]
          p_affected_services?: string[]
          p_closed_at?: string
          p_correlation_id?: string
          p_description?: string
          p_detected_at?: string
          p_incident_id: string
          p_metadata?: Json
          p_organization_id: string
          p_project_id?: string
          p_related_commit_sha?: string
          p_related_deployment_id?: string
          p_resolution?: string
          p_resolved_at?: string
          p_root_cause?: string
          p_severity: string
          p_source: string
          p_started_at: string
          p_status?: string
          p_tags?: string[]
          p_team_id?: string
          p_title: string
        }
        Returns: string
      }
      log_integration_usage_event: {
        Args: {
          p_correlation_id?: string
          p_duration_ms?: number
          p_error_code?: string
          p_error_message?: string
          p_event_type: string
          p_external_system: string
          p_integration_type: string
          p_metadata_json?: Json
          p_retry_count?: number
          p_status: string
          p_tenant_id: string
        }
        Returns: string
      }
      log_oracle_sync_event: {
        Args: {
          p_bytes_processed?: number
          p_correlation_id?: string
          p_error_details?: Json
          p_extract_checkpoint?: Json
          p_extract_duration_ms?: number
          p_integration_id: string
          p_job_id: string
          p_load_duration_ms?: number
          p_organization_id: string
          p_rows_extracted?: number
          p_rows_failed?: number
          p_rows_loaded?: number
          p_rows_transformed?: number
          p_status: string
          p_total_duration_ms?: number
          p_transform_checkpoint?: Json
          p_transform_duration_ms?: number
          p_trigger_type?: string
        }
        Returns: string
      }
      log_organization_operational_event: {
        Args: {
          p_action: string
          p_after_values?: Json
          p_before_values?: Json
          p_changed_fields?: string[]
          p_metadata?: Json
          p_org_id: string
          p_resource_id: string
          p_resource_type: string
        }
        Returns: undefined
      }
      log_redmine_sync_event: {
        Args: {
          p_correlation_id?: string
          p_error_details?: Json
          p_integration_id: string
          p_issues_created?: number
          p_issues_failed?: number
          p_issues_processed?: number
          p_issues_skipped?: number
          p_issues_updated?: number
          p_organization_id: string
          p_status: string
          p_sync_type: string
          p_trigger_source?: string
        }
        Returns: string
      }
      log_sprint_risk_prediction: {
        Args: {
          p_days_remaining?: number
          p_delay_probability?: number
          p_features?: Json
          p_hu_id?: string
          p_incomplete_probability?: number
          p_justification: string
          p_key_factors?: Json
          p_model_type: string
          p_model_version: string
          p_organization_id: string
          p_project_id?: string
          p_risk_level: string
          p_risk_score: number
          p_sprint_end_date?: string
          p_sprint_id?: string
          p_sprint_start_date?: string
        }
        Returns: string
      }
      log_teams_interaction: {
        Args: {
          p_channel_id?: string
          p_channel_name?: string
          p_command_args?: Json
          p_command_name?: string
          p_conversation_id?: string
          p_correlation_id?: string
          p_integration_id: string
          p_interaction_type: string
          p_organization_id: string
          p_processing_time_ms?: number
          p_response_card?: Json
          p_response_message?: string
          p_response_type?: string
          p_team_id?: string
          p_team_name?: string
          p_teams_user_aad_object_id?: string
          p_teams_user_email?: string
          p_teams_user_id: string
          p_teams_user_name?: string
        }
        Returns: string
      }
      log_teams_notification: {
        Args: {
          p_card_content?: Json
          p_card_type?: string
          p_channel_id: string
          p_channel_mapping_id?: string
          p_correlation_id?: string
          p_deduplication_key?: string
          p_event_payload?: Json
          p_event_source?: string
          p_event_type: string
          p_failure_reason?: string
          p_integration_id: string
          p_message_text?: string
          p_organization_id: string
          p_sent_at?: string
          p_status?: string
          p_team_id: string
        }
        Returns: string
      }
      log_user_usage_event: {
        Args: {
          p_correlation_id?: string
          p_entity_id?: string
          p_entity_type?: string
          p_event_type: string
          p_ip_hash?: string
          p_metadata_json?: Json
          p_project_id?: string
          p_session_id?: string
          p_source?: string
          p_tenant_id: string
          p_user_agent?: string
          p_user_id?: string
        }
        Returns: string
      }
      match_similar_apf_cases:
        | {
            Args: {
              p_domain?: string
              p_limit?: number
              p_query_embedding: string
              p_similarity_threshold?: number
              p_team_id?: string
            }
            Returns: {
              correction_reason_code: string
              domain: string
              hu_text: string
              hu_title: string
              id: string
              similarity: number
              validated_complexity: string
              validated_functional_type: string
              validated_pf_bruto: number
              was_corrected: boolean
            }[]
          }
        | {
            Args: {
              match_count?: number
              match_threshold?: number
              p_domain?: string
              p_team_id?: string
              query_embedding: string
            }
            Returns: {
              complexity: string
              domain: string
              event_id: string
              functional_type: string
              id: string
              pf_value: number
              similarity: number
            }[]
          }
      materialize_apf_process_analysis: {
        Args: { p_analysis_id: string; p_session_id: string }
        Returns: Json
      }
      my_org_ids: { Args: never; Returns: string[] }
      normalize_apf_contractual_function_sigla: {
        Args: { p_sigla: string }
        Returns: string
      }
      normalize_apf_metric_reference: {
        Args: { p_value: string }
        Returns: string
      }
      normalize_apf_process_key: { Args: { p_text: string }; Returns: string }
      normalize_apf_ref: { Args: { p_text: string }; Returns: string }
      normalize_apf_text: { Args: { p_text: string }; Returns: string }
      open_counting_session:
        | {
            Args: {
              p_baseline_id?: string
              p_contract_id: string
              p_project_id?: string
              p_redmine_ref?: string
              p_release_ref?: string
              p_sprint_ref?: string
            }
            Returns: string
          }
        | {
            Args: {
              p_baseline_id?: string
              p_project_id: string
              p_redmine_ref?: string
              p_release_ref?: string
              p_sprint_ref?: string
            }
            Returns: string
          }
      persist_apf_process_analysis: {
        Args: {
          p_analysis: Json
          p_baseline_id: string
          p_factor_sigla: string
          p_input_hash: string
          p_model_name: string
          p_project_id: string
          p_prompt_version: string
          p_provider_id: string
          p_provider_name: string
          p_raw_response: string
          p_schema_version: string
          p_story_id: string
          p_validation_mode: string
        }
        Returns: string
      }
      platform_plan_org_plan_code: {
        Args: { p_plan_code: string }
        Returns: Database["public"]["Enums"]["org_plan"]
      }
      platform_plan_org_status_code: {
        Args: { p_subscription_status: string }
        Returns: Database["public"]["Enums"]["org_status"]
      }
      provision_apf_model_pfs_dpf: {
        Args: { p_contract_id: string; p_model_name?: string }
        Returns: string
      }
      recalculate_apf_session_totals: {
        Args: { p_session_id: string }
        Returns: undefined
      }
      recalculate_session_totals: {
        Args: { p_session_id: string }
        Returns: undefined
      }
      record_risk_feedback: {
        Args: {
          p_actual_outcome: string
          p_feedback_by?: string
          p_feedback_notes?: string
          p_risk_event_id: string
        }
        Returns: undefined
      }
      remove_organization_team_member_v2: {
        Args: { p_org_id: string; p_team_member_id: string }
        Returns: undefined
      }
      reorder_user_stories: { Args: { p_updates: Json }; Returns: undefined }
      resend_organization_invitation: {
        Args: {
          p_actor_id: string
          p_expires_at?: string
          p_invitation_id: string
        }
        Returns: {
          expires_at: string
          invitation_id: string
          normalized_email: string
          org_id: string
          raw_token: string
        }[]
      }
      reserve_ai_briefing_usage: {
        Args: {
          p_org_id: string
          p_request_id: string
          p_team_id: string
          p_user_id: string
        }
        Returns: Json
      }
      reserve_ai_usage: {
        Args: {
          p_feature: string
          p_request_id?: string
          p_team_id: string
          p_user_id: string
        }
        Returns: Json
      }
      reset_ai_provider_key_state: {
        Args: { p_id: string }
        Returns: undefined
      }
      reset_apf_story_counting: {
        Args: { p_reason?: string; p_session_id: string; p_story_id: string }
        Returns: Json
      }
      resolve_apf_elementary_process_item: {
        Args: {
          p_is_complete: boolean
          p_is_independent: boolean
          p_item_id: string
          p_precedent_ref?: string
          p_process_role: string
          p_reason?: string
        }
        Returns: Json
      }
      resolve_apf_factor_decision: {
        Args: {
          p_project_id: string
          p_proposed_factor?: string
          p_story_id: string
        }
        Returns: Json
      }
      resolve_apf_item_weight: {
        Args: {
          p_baseline_item_id: string
          p_complexity?: string
          p_function_sigla: string
          p_model_id: string
        }
        Returns: number
      }
      resolve_apf_process_analysis: {
        Args: { p_analysis_id: string; p_decisions: Json; p_session_id: string }
        Returns: Json
      }
      resolve_apf_process_analysis_v2: {
        Args: {
          p_analysis_id: string
          p_decisions: Json
          p_factor_override_notes?: string
          p_factor_override_reason?: string
          p_factor_sigla: string
          p_session_id: string
        }
        Returns: Json
      }
      resolve_contract_org_id: {
        Args: { p_contract_id: string }
        Returns: string
      }
      resolve_project_org_id: {
        Args: { p_project_id: string }
        Returns: string
      }
      resolve_team_org_id: { Args: { p_team_id: string }; Returns: string }
      review_ai_briefing_suggestion: {
        Args: {
          p_review_status: string
          p_reviewed_payload?: Json
          p_suggestion_id: string
        }
        Returns: undefined
      }
      revoke_organization_invitation_v2: {
        Args: { p_invitation_id: string }
        Returns: boolean
      }
      save_contractual_counting_items: {
        Args: {
          p_ai_model?: string
          p_items: Json
          p_session_id: string
          p_story_id: string
        }
        Returns: Json
      }
      save_counting_items: {
        Args: { p_ai_model?: string; p_items: Json; p_session_id: string }
        Returns: Json
      }
      save_organization_contract_v3: {
        Args: {
          p_company_id?: string
          p_contract_id: string
          p_currency?: string
          p_ends_at?: string
          p_name: string
          p_number?: string
          p_object?: string
          p_org_id: string
          p_project_ids?: string[]
          p_starts_at?: string
          p_status?: string
          p_team_ids?: string[]
          p_value_per_pfus?: number
        }
        Returns: string
      }
      set_ai_briefing_suggestion_assignee: {
        Args: { p_developer_id?: string; p_suggestion_id: string }
        Returns: undefined
      }
      set_ai_provider_key: {
        Args: { p_key: string; p_provider: string }
        Returns: undefined
      }
      set_ai_provider_key_v2: {
        Args: { p_id: string; p_key: string }
        Returns: undefined
      }
      set_legacy_operational_admin_fallback: {
        Args: { p_enabled: boolean }
        Returns: undefined
      }
      set_okr_health_override: {
        Args: { p_health: string; p_objective_id: string; p_reason: string }
        Returns: undefined
      }
      set_org_briefing_retention: {
        Args: {
          p_allow_permanent_delete?: boolean
          p_auto_anonymize?: boolean
          p_auto_archive?: boolean
          p_default_retention_days: number
          p_org_id: string
        }
        Returns: undefined
      }
      set_organization_legacy_permission_fallback: {
        Args: { p_enabled: boolean }
        Returns: undefined
      }
      set_organization_operational_console: {
        Args: { p_enabled: boolean }
        Returns: undefined
      }
      set_organization_resource_limit_enforcement: {
        Args: { p_enabled: boolean }
        Returns: undefined
      }
      set_platform_ai_provider_key_v2: {
        Args: { p_key: string; p_provider_id: string }
        Returns: undefined
      }
      set_platform_organization_subscription_v1: {
        Args: {
          p_current_period_end: string
          p_current_period_start: string
          p_org_id: string
          p_plan_id: string
          p_source: string
          p_status: string
          p_trial_ends_at: string
        }
        Returns: string
      }
      set_tenancy_enforcement: {
        Args: { p_enabled: boolean }
        Returns: undefined
      }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
      start_ai_briefing_run: {
        Args: {
          p_briefing_id: string
          p_prompt_version: string
          p_request_id: string
          p_schema_version: string
        }
        Returns: {
          briefing_type: string
          language: string
          meeting_date: string
          org_id: string
          participants: Json
          project_id: string
          run_id: string
          source_content: string
          sprint_id: string
          team_id: string
          title: string
        }[]
      }
      status_concluidos: { Args: never; Returns: string[] }
      sync_keycloak_user: {
        Args: {
          p_axionn_user_id?: string
          p_identity_provider_id: string
          p_keycloak_email?: string
          p_keycloak_realm?: string
          p_keycloak_user_id: string
          p_keycloak_username?: string
        }
        Returns: {
          axionn_user_id: string
          created_at: string
          id: string
          identity_provider_id: string
          keycloak_email: string | null
          keycloak_realm: string | null
          keycloak_user_id: string
          keycloak_username: string | null
          last_synced_at: string | null
          organization_id: string
          sync_metadata: Json | null
          sync_status: string | null
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "keycloak_user_mappings"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      transfer_organization_ownership_v2: {
        Args: { p_new_owner_id: string; p_org_id: string }
        Returns: boolean
      }
      update_backoffice_billing_status: {
        Args: { p_billing_id: string; p_status: string }
        Returns: undefined
      }
      update_backoffice_plan_price: {
        Args: {
          p_annual_price: number
          p_currency?: string
          p_monthly_price: number
          p_plan_id: string
        }
        Returns: undefined
      }
      update_backoffice_support_ticket_status: {
        Args: { p_status: string; p_ticket_id: string }
        Returns: undefined
      }
      update_organization_company_v2: {
        Args: {
          p_cnpj?: string
          p_company_id: string
          p_email?: string
          p_logo_url?: string
          p_name: string
          p_org_id: string
          p_phone?: string
          p_status?: string
        }
        Returns: string
      }
      update_organization_member_v2: {
        Args: {
          p_is_active?: boolean
          p_module_keys?: string[]
          p_org_id: string
          p_role?: string
          p_user_id: string
        }
        Returns: boolean
      }
      update_organization_project_v2: {
        Args: {
          p_code?: string
          p_contract_id: string
          p_description?: string
          p_module_type?: string
          p_name: string
          p_org_id: string
          p_project_id: string
          p_redmine_id?: number
          p_team_id: string
        }
        Returns: string
      }
      update_organization_settings_v2: {
        Args: {
          p_contact_email?: string
          p_contact_name?: string
          p_logo_url?: string
          p_name: string
          p_org_id: string
        }
        Returns: {
          changed_fields: string[]
          contact_email: string
          contact_name: string
          logo_url: string
          name: string
          organization_id: string
          plan: string
          slug: string
          status: string
          updated_at: string
        }[]
      }
      update_organization_team_member_role_v2: {
        Args: { p_org_id: string; p_role: string; p_team_member_id: string }
        Returns: undefined
      }
      update_organization_team_v2: {
        Args: {
          p_company_id?: string
          p_contract_id?: string
          p_module: string
          p_name: string
          p_org_id: string
          p_team_id: string
        }
        Returns: string
      }
      update_platform_ai_provider_v2: {
        Args: {
          p_api_base_url?: string
          p_is_active?: boolean
          p_is_recommended?: boolean
          p_model?: string
          p_name: string
          p_provider_id: string
          p_provider_type: string
          p_request_format?: string
        }
        Returns: undefined
      }
      update_platform_saas_plan_v1: {
        Args: {
          p_description: string
          p_metadata: Json
          p_name: string
          p_plan_id: string
          p_status: string
        }
        Returns: undefined
      }
      upsert_backoffice_staff_member: {
        Args: {
          p_avatar_url: string
          p_department: string
          p_email: string
          p_full_name: string
          p_is_active: boolean
          p_role: string
          p_user_id: string
        }
        Returns: string
      }
      upsert_demandas_batch: {
        Args: { p_rows: Json; p_team_id: string }
        Returns: Json
      }
      upsert_platform_organization_entitlement_override_v1: {
        Args: {
          p_enabled: boolean
          p_feature_key: string
          p_limit_value: number
          p_org_id: string
          p_reason: string
        }
        Returns: string
      }
      upsert_platform_plan_entitlement_v1: {
        Args: {
          p_enabled: boolean
          p_feature_key: string
          p_limit_value: number
          p_metadata: Json
          p_plan_id: string
        }
        Returns: string
      }
      users_share_contract: {
        Args: { _a: string; _b: string }
        Returns: boolean
      }
      validate_apf_counting_item: {
        Args: {
          p_factor_sigla: string
          p_function_sigla: string
          p_item_id: string
          p_notes?: string
          p_reason?: string
        }
        Returns: Json
      }
    }
    Enums: {
      apf_baseline_status: "draft" | "active" | "archived"
      apf_correction_reason:
        | "ambiguous_hu"
        | "wrong_functional_type"
        | "wrong_complexity"
        | "domain_convention"
        | "baseline_conflict"
        | "scope_misunderstanding"
        | "split_required"
        | "merge_required"
        | "already_counted"
        | "not_countable"
        | "wrong_impact_factor"
        | "wrong_baseline_match"
        | "wrong_pf_value"
        | "missing_function"
        | "extra_function"
        | "other"
      apf_function_class: "transactional" | "data"
      apf_session_status:
        | "in_progress"
        | "pending_review"
        | "validated"
        | "rejected"
      apf_standard: "pfs_dpf" | "ifpug" | "custom"
      app_role:
        | "admin"
        | "member"
        | "scrum_master"
        | "product_owner"
        | "developer"
        | "analyst"
        | "architect"
        | "qa_analyst"
        | "admin_contrato"
      contract_status:
        | "draft"
        | "active"
        | "suspended"
        | "expired"
        | "terminated"
      org_member_role: "owner" | "admin" | "member"
      org_plan: "free" | "pro" | "enterprise"
      org_status: "active" | "trial" | "suspended" | "cancelled"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      apf_baseline_status: ["draft", "active", "archived"],
      apf_correction_reason: [
        "ambiguous_hu",
        "wrong_functional_type",
        "wrong_complexity",
        "domain_convention",
        "baseline_conflict",
        "scope_misunderstanding",
        "split_required",
        "merge_required",
        "already_counted",
        "not_countable",
        "wrong_impact_factor",
        "wrong_baseline_match",
        "wrong_pf_value",
        "missing_function",
        "extra_function",
        "other",
      ],
      apf_function_class: ["transactional", "data"],
      apf_session_status: [
        "in_progress",
        "pending_review",
        "validated",
        "rejected",
      ],
      apf_standard: ["pfs_dpf", "ifpug", "custom"],
      app_role: [
        "admin",
        "member",
        "scrum_master",
        "product_owner",
        "developer",
        "analyst",
        "architect",
        "qa_analyst",
        "admin_contrato",
      ],
      contract_status: [
        "draft",
        "active",
        "suspended",
        "expired",
        "terminated",
      ],
      org_member_role: ["owner", "admin", "member"],
      org_plan: ["free", "pro", "enterprise"],
      org_status: ["active", "trial", "suspended", "cancelled"],
    },
  },
} as const
