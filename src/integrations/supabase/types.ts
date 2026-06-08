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
      ai_providers: {
        Row: {
          created_at: string
          created_by: string | null
          has_key: boolean
          id: string
          is_active: boolean
          is_recommended: boolean
          model: string | null
          name: string
          provider_type: string
          updated_at: string
          vault_secret_id: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          has_key?: boolean
          id?: string
          is_active?: boolean
          is_recommended?: boolean
          model?: string | null
          name: string
          provider_type: string
          updated_at?: string
          vault_secret_id?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          has_key?: boolean
          id?: string
          is_active?: boolean
          is_recommended?: boolean
          model?: string | null
          name?: string
          provider_type?: string
          updated_at?: string
          vault_secret_id?: string | null
        }
        Relationships: []
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
      contract_room_teams: {
        Row: {
          contract_id: string
          created_at: string
          id: string
          room_type: string
          team_id: string
        }
        Insert: {
          contract_id: string
          created_at?: string
          id?: string
          room_type: string
          team_id: string
        }
        Update: {
          contract_id?: string
          created_at?: string
          id?: string
          room_type?: string
          team_id?: string
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
      contracts: {
        Row: {
          created_at: string | null
          created_by: string | null
          description: string | null
          ends_at: string | null
          id: string
          name: string
          room_mode: string
          starts_at: string | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          ends_at?: string | null
          id?: string
          name: string
          room_mode?: string
          starts_at?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          ends_at?: string | null
          id?: string
          name?: string
          room_mode?: string
          starts_at?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: []
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
            foreignKeyName: "impediments_sprint_id_fkey"
            columns: ["sprint_id"]
            isOneToOne: false
            referencedRelation: "sprints"
            referencedColumns: ["id"]
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
            foreignKeyName: "planning_votes_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "planning_sessions"
            referencedColumns: ["id"]
          },
        ]
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
          contract_id: string
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          module_type: string
          name: string
          redmine_id: number | null
          room_type: string
          status: string
          updated_at: string
        }
        Insert: {
          code?: string | null
          contract_id: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          module_type?: string
          name: string
          redmine_id?: number | null
          room_type?: string
          status?: string
          updated_at?: string
        }
        Update: {
          code?: string | null
          contract_id?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          module_type?: string
          name?: string
          redmine_id?: number | null
          room_type?: string
          status?: string
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
            foreignKeyName: "rdms_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      releases: {
        Row: {
          bugs_fixed: number | null
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
        Relationships: []
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
          contract_id: string | null
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          module: string
          name: string
          project_id: string | null
          team_type: string | null
          updated_at: string
        }
        Insert: {
          contract_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          module?: string
          name: string
          project_id?: string | null
          team_type?: string | null
          updated_at?: string
        }
        Update: {
          contract_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          module?: string
          name?: string
          project_id?: string | null
          team_type?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "teams_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
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
          added_to_sprint_at: string | null
          assignee_id: string | null
          backlog_order: number | null
          code: string
          created_at: string
          custom_fields: Json | null
          description: string | null
          end_date: string | null
          epic_id: string | null
          estimated_hours: number | null
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
          added_to_sprint_at?: string | null
          assignee_id?: string | null
          backlog_order?: number | null
          code: string
          created_at?: string
          custom_fields?: Json | null
          description?: string | null
          end_date?: string | null
          epic_id?: string | null
          estimated_hours?: number | null
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
          added_to_sprint_at?: string | null
          assignee_id?: string | null
          backlog_order?: number | null
          code?: string
          created_at?: string
          custom_fields?: Json | null
          description?: string | null
          end_date?: string | null
          epic_id?: string | null
          estimated_hours?: number | null
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
            foreignKeyName: "user_stories_sprint_id_fkey"
            columns: ["sprint_id"]
            isOneToOne: false
            referencedRelation: "sprints"
            referencedColumns: ["id"]
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
    }
    Functions: {
      _assert_team_access: {
        Args: { p_team_ids: string[] }
        Returns: undefined
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
      delete_ai_provider_key: { Args: { p_id: string }; Returns: undefined }
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
      fn_check_sla_status: {
        Args: {
          p_contract_id: string
          p_created_at: string
          p_demanda_id: string
          p_now?: string
          p_priority: string
        }
        Returns: Json
      }
      fn_get_contract_tree: { Args: { p_contract_id?: string }; Returns: Json }
      fn_get_project_sla_matrix: {
        Args: { p_project_id: string }
        Returns: Json
      }
      fn_get_team_contract: { Args: { p_team_id: string }; Returns: Json }
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
      get_admin_kpis: {
        Args: { p_sla_dias?: number; p_team_ids: string[] }
        Returns: Json
      }
      get_ai_provider_key: { Args: { p_provider: string }; Returns: string }
      get_ai_provider_key_by_id: { Args: { p_id: string }; Returns: string }
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
      get_demandas_with_responsaveis: {
        Args: { p_team_id: string }
        Returns: Json
      }
      get_demandas_with_responsaveis_paged: {
        Args: { p_cursor?: string; p_limit?: number; p_team_id: string }
        Returns: Json[]
      }
      get_my_module_access: { Args: never; Returns: string }
      get_project_api_url: { Args: never; Returns: string }
      get_service_role_key: { Args: never; Returns: string }
      get_sprint_history: {
        Args: { p_cutoff?: string; p_team_id?: string; p_team_ids: string[] }
        Returns: Json
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin: { Args: never; Returns: boolean }
      is_feriado: {
        Args: { p_data: string; p_team_id?: string }
        Returns: boolean
      }
      is_team_member: {
        Args: { _team_id: string; _user_id: string }
        Returns: boolean
      }
      reorder_user_stories: { Args: { p_updates: Json }; Returns: undefined }
      set_ai_provider_key: {
        Args: { p_key: string; p_provider: string }
        Returns: undefined
      }
      set_ai_provider_key_v2: {
        Args: { p_id: string; p_key: string }
        Returns: undefined
      }
      status_concluidos: { Args: never; Returns: string[] }
      upsert_demandas_batch: {
        Args: { p_rows: Json; p_team_id: string }
        Returns: Json
      }
    }
    Enums: {
      app_role:
        | "admin"
        | "member"
        | "scrum_master"
        | "product_owner"
        | "developer"
        | "analyst"
        | "architect"
        | "qa_analyst"
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
      app_role: [
        "admin",
        "member",
        "scrum_master",
        "product_owner",
        "developer",
        "analyst",
        "architect",
        "qa_analyst",
      ],
    },
  },
} as const
