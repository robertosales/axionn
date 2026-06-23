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
      apf_baseline_items: {
        Row: {
          baseline_id: string
          category_sigla: string | null
          complexity: string
          created_at: string
          description: string
          function_sigla: string
          id: string
          item_ref: string
          module: string | null
          notes: string | null
          pf_bruto: number | null
          sort_order: number
        }
        Insert: {
          baseline_id: string
          category_sigla?: string | null
          complexity?: string
          created_at?: string
          description: string
          function_sigla: string
          id?: string
          item_ref: string
          module?: string | null
          notes?: string | null
          pf_bruto?: number | null
          sort_order?: number
        }
        Update: {
          baseline_id?: string
          category_sigla?: string | null
          complexity?: string
          created_at?: string
          description?: string
          function_sigla?: string
          id?: string
          item_ref?: string
          module?: string | null
          notes?: string | null
          pf_bruto?: number | null
          sort_order?: number
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
          analyst_note: string | null
          baseline_item_id: string | null
          category_sigla: string | null
          complexity: string | null
          contribution_pct: number
          corrected_factor_sigla: string | null
          corrected_function_sigla: string | null
          corrected_pf_bruto: number | null
          corrected_pf_fs: number | null
          created_at: string
          ef_description: string
          evidence_literal: string | null
          factor_sigla: string
          function_sigla: string
          hu_ref: string | null
          id: string
          is_validated: boolean
          justification: string | null
          pf_bruto: number
          pf_fs: number
          precedent_ref: string | null
          session_id: string
          sort_order: number | null
          validated_at: string | null
          validated_by: string | null
        }
        Insert: {
          analyst_note?: string | null
          baseline_item_id?: string | null
          category_sigla?: string | null
          complexity?: string | null
          contribution_pct?: number
          corrected_factor_sigla?: string | null
          corrected_function_sigla?: string | null
          corrected_pf_bruto?: number | null
          corrected_pf_fs?: number | null
          created_at?: string
          ef_description: string
          evidence_literal?: string | null
          factor_sigla: string
          function_sigla: string
          hu_ref?: string | null
          id?: string
          is_validated?: boolean
          justification?: string | null
          pf_bruto?: number
          pf_fs?: number
          precedent_ref?: string | null
          session_id: string
          sort_order?: number | null
          validated_at?: string | null
          validated_by?: string | null
        }
        Update: {
          analyst_note?: string | null
          baseline_item_id?: string | null
          category_sigla?: string | null
          complexity?: string | null
          contribution_pct?: number
          corrected_factor_sigla?: string | null
          corrected_function_sigla?: string | null
          corrected_pf_bruto?: number | null
          corrected_pf_fs?: number | null
          created_at?: string
          ef_description?: string
          evidence_literal?: string | null
          factor_sigla?: string
          function_sigla?: string
          hu_ref?: string | null
          id?: string
          is_validated?: boolean
          justification?: string | null
          pf_bruto?: number
          pf_fs?: number
          precedent_ref?: string | null
          session_id?: string
          sort_order?: number | null
          validated_at?: string | null
          validated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "apf_counting_items_baseline_item_id_fkey"
            columns: ["baseline_item_id"]
            isOneToOne: false
            referencedRelation: "apf_baseline_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "apf_counting_items_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "apf_counting_sessions"
            referencedColumns: ["id"]
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
          project_id: string
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
          project_id: string
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
          project_id?: string
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
      apf_project_baselines: {
        Row: {
          created_at: string
          id: string
          imported_at: string | null
          imported_by: string | null
          label: string | null
          model_id: string
          project_id: string
          status: Database["public"]["Enums"]["apf_baseline_status"]
          updated_at: string
          version: string
        }
        Insert: {
          created_at?: string
          id?: string
          imported_at?: string | null
          imported_by?: string | null
          label?: string | null
          model_id: string
          project_id: string
          status?: Database["public"]["Enums"]["apf_baseline_status"]
          updated_at?: string
          version: string
        }
        Update: {
          created_at?: string
          id?: string
          imported_at?: string | null
          imported_by?: string | null
          label?: string | null
          model_id?: string
          project_id?: string
          status?: Database["public"]["Enums"]["apf_baseline_status"]
          updated_at?: string
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
          ai_functional_type: string
          ai_pf_bruto: number | null
          ai_reasoning: string | null
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
          validated_functional_type: string
          validated_pf_bruto: number | null
          was_corrected: boolean | null
        }
        Insert: {
          ai_complexity: string
          ai_confidence_score?: number | null
          ai_functional_type: string
          ai_pf_bruto?: number | null
          ai_reasoning?: string | null
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
          validated_functional_type: string
          validated_pf_bruto?: number | null
          was_corrected?: boolean | null
        }
        Update: {
          ai_complexity?: string
          ai_confidence_score?: number | null
          ai_functional_type?: string
          ai_pf_bruto?: number | null
          ai_reasoning?: string | null
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
          validated_functional_type?: string
          validated_pf_bruto?: number | null
          was_corrected?: boolean | null
        }
        Relationships: [
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
      companies: {
        Row: {
          cnpj: string | null
          created_at: string
          email: string | null
          id: string
          logo_url: string | null
          name: string
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
          phone?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
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
            foreignKeyName: "function_point_analyses_team_id_fkey"
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
      okr_check_ins: {
        Row: {
          author_id: string | null
          created_at: string
          id: string
          key_result_id: string
          note: string | null
          value: number
        }
        Insert: {
          author_id?: string | null
          created_at?: string
          id?: string
          key_result_id: string
          note?: string | null
          value: number
        }
        Update: {
          author_id?: string | null
          created_at?: string
          id?: string
          key_result_id?: string
          note?: string | null
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
        ]
      }
      okr_key_results: {
        Row: {
          created_at: string
          current: number
          id: string
          objective_id: string
          target: number
          title: string
          unit: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          current?: number
          id?: string
          objective_id: string
          target?: number
          title: string
          unit?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          current?: number
          id?: string
          objective_id?: string
          target?: number
          title?: string
          unit?: string
          updated_at?: string
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
          created_at: string
          cycle: string
          description: string | null
          id: string
          owner_id: string | null
          progress: number
          status: string
          team_id: string | null
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          cycle: string
          description?: string | null
          id?: string
          owner_id?: string | null
          progress?: number
          status?: string
          team_id?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          cycle?: string
          description?: string | null
          id?: string
          owner_id?: string | null
          progress?: number
          status?: string
          team_id?: string | null
          title?: string
          updated_at?: string
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
      organization_members: {
        Row: {
          created_at: string
          id: string
          org_id: string
          role: Database["public"]["Enums"]["org_member_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          org_id: string
          role?: Database["public"]["Enums"]["org_member_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          org_id?: string
          role?: Database["public"]["Enums"]["org_member_role"]
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
          company_id: string | null
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
          company_id?: string | null
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
          company_id?: string | null
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
            foreignKeyName: "teams_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
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
      apf_create_dpf_globalweb_model: {
        Args: { p_contract_id: string }
        Returns: string
      }
      build_apf_prompt: {
        Args: { p_contract_id: string; p_hu_text?: string }
        Returns: Json
      }
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
      get_admin_kpis: {
        Args: { p_sla_dias?: number; p_team_ids: string[] }
        Returns: Json
      }
      get_ai_provider_key: { Args: { p_provider: string }; Returns: string }
      get_ai_provider_key_by_id: { Args: { p_id: string }; Returns: string }
      get_apf_model_by_contract: {
        Args: { p_contract_id: string }
        Returns: Json
      }
      get_apf_session_summary: { Args: { p_session_id: string }; Returns: Json }
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
      get_my_contract_id: { Args: { _user_id?: string }; Returns: string }
      get_my_contracts: {
        Args: { _user_id?: string }
        Returns: {
          contract_id: string
          role: Database["public"]["Enums"]["app_role"]
        }[]
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
      increment_license_usage: {
        Args: { p_ai_calls?: number; p_pf_count?: number; p_team_id: string }
        Returns: undefined
      }
      is_admin: { Args: never; Returns: boolean }
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
      my_org_ids: { Args: never; Returns: string[] }
      open_counting_session: {
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
      provision_apf_model_pfs_dpf: {
        Args: { p_contract_id: string; p_model_name?: string }
        Returns: string
      }
      recalculate_session_totals: {
        Args: { p_session_id: string }
        Returns: undefined
      }
      reorder_user_stories: { Args: { p_updates: Json }; Returns: undefined }
      save_counting_items: {
        Args: { p_ai_model?: string; p_items: Json; p_session_id: string }
        Returns: Json
      }
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
      users_share_contract: {
        Args: { _a: string; _b: string }
        Returns: boolean
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
