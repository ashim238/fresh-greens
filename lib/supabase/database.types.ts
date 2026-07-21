export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      community_reports: {
        Row: {
          auth_user_id: string | null;
          category_id: string;
          detail: string | null;
          device_uuid: string;
          google_place_id: string | null;
          hidden_at: string | null;
          hidden_reason: string | null;
          id: string;
          is_verified_phone: boolean;
          location: Json;
          photo_uri: string | null;
          place_name: string | null;
          place_type: string | null;
          removed_at: string | null;
          sub_tag: string | null;
          submitted_by: string | null;
          submitter_ip: string | null;
          timestamp: number;
        };
        Insert: {
          auth_user_id?: string | null;
          category_id: string;
          detail?: string | null;
          device_uuid: string;
          google_place_id?: string | null;
          hidden_at?: string | null;
          hidden_reason?: string | null;
          id: string;
          is_verified_phone?: boolean;
          location: Json;
          photo_uri?: string | null;
          place_name?: string | null;
          place_type?: string | null;
          removed_at?: string | null;
          sub_tag?: string | null;
          submitted_by?: string | null;
          submitter_ip?: string | null;
          timestamp: number;
        };
        Update: {
          auth_user_id?: string | null;
          category_id?: string;
          detail?: string | null;
          device_uuid?: string;
          google_place_id?: string | null;
          hidden_at?: string | null;
          hidden_reason?: string | null;
          id?: string;
          is_verified_phone?: boolean;
          location?: Json;
          photo_uri?: string | null;
          place_name?: string | null;
          place_type?: string | null;
          removed_at?: string | null;
          sub_tag?: string | null;
          submitted_by?: string | null;
          submitter_ip?: string | null;
          timestamp?: number;
        };
        Relationships: [];
      };
      user_roles: {
        Row: {
          granted_at: string;
          granted_by: string | null;
          role: string;
          user_id: string;
        };
        Insert: {
          granted_at?: string;
          granted_by?: string | null;
          role: string;
          user_id: string;
        };
        Update: {
          granted_at?: string;
          granted_by?: string | null;
          role?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      report_flags: {
        Row: {
          created_at: string;
          flagger_auth_user_id: string;
          flagger_device_uuid: string;
          flagger_ip: string;
          id: string;
          reason: string | null;
          reason_category: string;
          report_id: string;
        };
        Insert: {
          created_at?: string;
          flagger_auth_user_id: string;
          flagger_device_uuid: string;
          flagger_ip: string;
          id?: string;
          reason?: string | null;
          reason_category: string;
          report_id: string;
        };
        Update: {
          created_at?: string;
          flagger_auth_user_id?: string;
          flagger_device_uuid?: string;
          flagger_ip?: string;
          id?: string;
          reason?: string | null;
          reason_category?: string;
          report_id?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      community_reports_public: {
        Row: {
          category_id: string | null;
          detail: string | null;
          google_place_id: string | null;
          id: string | null;
          location: Json | null;
          photo_uri: string | null;
          place_name: string | null;
          place_type: string | null;
          sub_tag: string | null;
          submitted_by: string | null;
          timestamp: number | null;
          trust_tier: string | null;
        };
        Relationships: [];
      };
      community_reports_moderation: {
        Row: {
          auth_user_id: string | null;
          category_id: string | null;
          detail: string | null;
          device_uuid: string | null;
          google_place_id: string | null;
          hidden_at: string | null;
          hidden_reason: string | null;
          id: string | null;
          is_verified_phone: boolean | null;
          location: Json | null;
          photo_uri: string | null;
          place_name: string | null;
          place_type: string | null;
          removed_at: string | null;
          sub_tag: string | null;
          submitted_by: string | null;
          submitter_ip: string | null;
          timestamp: number | null;
        };
        Relationships: [];
      };
    };
    Functions: {
      moderator_remove_report: {
        Args: { p_reason: string; p_report_id: string };
        Returns: undefined;
      };
      moderator_restore_report: {
        Args: { p_reason: string; p_report_id: string };
        Returns: undefined;
      };
      submitter_delete_report: {
        Args: { p_report_id: string };
        Returns: undefined;
      };
    };
    Enums: Record<never, never>;
    CompositeTypes: Record<never, never>;
  };
};
