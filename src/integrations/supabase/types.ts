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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      chapters: {
        Row: {
          course_id: string
          created_at: string
          id: string
          position: number
          title: string
          updated_at: string
        }
        Insert: {
          course_id: string
          created_at?: string
          id?: string
          position?: number
          title: string
          updated_at?: string
        }
        Update: {
          course_id?: string
          created_at?: string
          id?: string
          position?: number
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "chapters_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      compete_match_answers: {
        Row: {
          created_at: string
          id: string
          is_correct: boolean
          match_id: string
          points: number
          question_id: string
          question_index: number
          selected_index: number | null
          time_taken_ms: number
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_correct?: boolean
          match_id: string
          points?: number
          question_id: string
          question_index: number
          selected_index?: number | null
          time_taken_ms?: number
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_correct?: boolean
          match_id?: string
          points?: number
          question_id?: string
          question_index?: number
          selected_index?: number | null
          time_taken_ms?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "compete_match_answers_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "compete_matches"
            referencedColumns: ["id"]
          },
        ]
      }
      compete_matches: {
        Row: {
          countdown_until: string | null
          created_at: string
          current_question_index: number
          current_question_started_at: string | null
          finished_at: string | null
          id: string
          is_bot: boolean
          is_private: boolean
          player1_avatar: string | null
          player1_id: string
          player1_name: string | null
          player1_rating_after: number | null
          player1_rating_before: number | null
          player1_score: number
          player2_avatar: string | null
          player2_id: string | null
          player2_name: string | null
          player2_rating_after: number | null
          player2_rating_before: number | null
          player2_score: number
          question_ids: string[]
          room_code: string | null
          started_at: string | null
          status: string
          subject: string
          topic: string
          total_questions: number
          updated_at: string
          winner_id: string | null
        }
        Insert: {
          countdown_until?: string | null
          created_at?: string
          current_question_index?: number
          current_question_started_at?: string | null
          finished_at?: string | null
          id?: string
          is_bot?: boolean
          is_private?: boolean
          player1_avatar?: string | null
          player1_id: string
          player1_name?: string | null
          player1_rating_after?: number | null
          player1_rating_before?: number | null
          player1_score?: number
          player2_avatar?: string | null
          player2_id?: string | null
          player2_name?: string | null
          player2_rating_after?: number | null
          player2_rating_before?: number | null
          player2_score?: number
          question_ids?: string[]
          room_code?: string | null
          started_at?: string | null
          status?: string
          subject: string
          topic: string
          total_questions?: number
          updated_at?: string
          winner_id?: string | null
        }
        Update: {
          countdown_until?: string | null
          created_at?: string
          current_question_index?: number
          current_question_started_at?: string | null
          finished_at?: string | null
          id?: string
          is_bot?: boolean
          is_private?: boolean
          player1_avatar?: string | null
          player1_id?: string
          player1_name?: string | null
          player1_rating_after?: number | null
          player1_rating_before?: number | null
          player1_score?: number
          player2_avatar?: string | null
          player2_id?: string | null
          player2_name?: string | null
          player2_rating_after?: number | null
          player2_rating_before?: number | null
          player2_score?: number
          question_ids?: string[]
          room_code?: string | null
          started_at?: string | null
          status?: string
          subject?: string
          topic?: string
          total_questions?: number
          updated_at?: string
          winner_id?: string | null
        }
        Relationships: []
      }
      compete_questions: {
        Row: {
          class_level: string | null
          correct_index: number
          created_at: string
          created_by: string | null
          difficulty: string
          explanation: string | null
          id: string
          is_active: boolean
          options: Json
          question_text: string
          subject: string
          target_exam: string | null
          topic: string
          updated_at: string
        }
        Insert: {
          class_level?: string | null
          correct_index: number
          created_at?: string
          created_by?: string | null
          difficulty?: string
          explanation?: string | null
          id?: string
          is_active?: boolean
          options: Json
          question_text: string
          subject: string
          target_exam?: string | null
          topic: string
          updated_at?: string
        }
        Update: {
          class_level?: string | null
          correct_index?: number
          created_at?: string
          created_by?: string | null
          difficulty?: string
          explanation?: string | null
          id?: string
          is_active?: boolean
          options?: Json
          question_text?: string
          subject?: string
          target_exam?: string | null
          topic?: string
          updated_at?: string
        }
        Relationships: []
      }
      compete_queue: {
        Row: {
          class_level: string | null
          created_at: string
          id: string
          match_id: string | null
          rating: number
          status: string
          subject: string
          target_exam: string
          topic: string
          user_id: string
        }
        Insert: {
          class_level?: string | null
          created_at?: string
          id?: string
          match_id?: string | null
          rating?: number
          status?: string
          subject: string
          target_exam?: string
          topic: string
          user_id: string
        }
        Update: {
          class_level?: string | null
          created_at?: string
          id?: string
          match_id?: string | null
          rating?: number
          status?: string
          subject?: string
          target_exam?: string
          topic?: string
          user_id?: string
        }
        Relationships: []
      }
      compete_ratings: {
        Row: {
          best_streak: number
          current_streak: number
          draws: number
          id: string
          losses: number
          rating: number
          target_exam: string
          updated_at: string
          user_id: string
          wins: number
        }
        Insert: {
          best_streak?: number
          current_streak?: number
          draws?: number
          id?: string
          losses?: number
          rating?: number
          target_exam?: string
          updated_at?: string
          user_id: string
          wins?: number
        }
        Update: {
          best_streak?: number
          current_streak?: number
          draws?: number
          id?: string
          losses?: number
          rating?: number
          target_exam?: string
          updated_at?: string
          user_id?: string
          wins?: number
        }
        Relationships: []
      }
      course_pdfs: {
        Row: {
          course_id: string
          created_at: string
          file_url: string
          id: string
          position: number
          size_bytes: number | null
          title: string
          updated_at: string
        }
        Insert: {
          course_id: string
          created_at?: string
          file_url: string
          id?: string
          position?: number
          size_bytes?: number | null
          title: string
          updated_at?: string
        }
        Update: {
          course_id?: string
          created_at?: string
          file_url?: string
          id?: string
          position?: number
          size_bytes?: number | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      course_resources: {
        Row: {
          chapter_id: string | null
          course_id: string
          created_at: string
          description: string | null
          file_size_bytes: number | null
          file_url: string
          id: string
          is_published: boolean
          mime_type: string | null
          position: number
          resource_type: string
          title: string
          updated_at: string
          uploaded_by: string | null
        }
        Insert: {
          chapter_id?: string | null
          course_id: string
          created_at?: string
          description?: string | null
          file_size_bytes?: number | null
          file_url: string
          id?: string
          is_published?: boolean
          mime_type?: string | null
          position?: number
          resource_type?: string
          title: string
          updated_at?: string
          uploaded_by?: string | null
        }
        Update: {
          chapter_id?: string | null
          course_id?: string
          created_at?: string
          description?: string | null
          file_size_bytes?: number | null
          file_url?: string
          id?: string
          is_published?: boolean
          mime_type?: string | null
          position?: number
          resource_type?: string
          title?: string
          updated_at?: string
          uploaded_by?: string | null
        }
        Relationships: []
      }
      course_reviews: {
        Row: {
          course_id: string
          created_at: string
          id: string
          rating: number
          review: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          course_id: string
          created_at?: string
          id?: string
          rating: number
          review?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          course_id?: string
          created_at?: string
          id?: string
          rating?: number
          review?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "course_reviews_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      courses: {
        Row: {
          assigned_teacher_id: string | null
          badge: string | null
          created_at: string
          created_by: string | null
          description: string | null
          discount_percent: number | null
          duration_hours: number | null
          educator_name: string
          id: string
          is_featured: boolean | null
          is_published: boolean | null
          level: string | null
          name: string
          original_price: number | null
          price: number
          rating: number | null
          requirements: string[]
          slug: string
          subject: string
          tags: string[] | null
          target_exam: string | null
          thumbnail_url: string | null
          total_enrolled: number | null
          total_lessons: number | null
          updated_at: string
          what_youll_learn: string[]
        }
        Insert: {
          assigned_teacher_id?: string | null
          badge?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          discount_percent?: number | null
          duration_hours?: number | null
          educator_name: string
          id?: string
          is_featured?: boolean | null
          is_published?: boolean | null
          level?: string | null
          name: string
          original_price?: number | null
          price?: number
          rating?: number | null
          requirements?: string[]
          slug: string
          subject: string
          tags?: string[] | null
          target_exam?: string | null
          thumbnail_url?: string | null
          total_enrolled?: number | null
          total_lessons?: number | null
          updated_at?: string
          what_youll_learn?: string[]
        }
        Update: {
          assigned_teacher_id?: string | null
          badge?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          discount_percent?: number | null
          duration_hours?: number | null
          educator_name?: string
          id?: string
          is_featured?: boolean | null
          is_published?: boolean | null
          level?: string | null
          name?: string
          original_price?: number | null
          price?: number
          rating?: number | null
          requirements?: string[]
          slug?: string
          subject?: string
          tags?: string[] | null
          target_exam?: string | null
          thumbnail_url?: string | null
          total_enrolled?: number | null
          total_lessons?: number | null
          updated_at?: string
          what_youll_learn?: string[]
        }
        Relationships: []
      }
      doubt_answers: {
        Row: {
          answer_text: string
          created_at: string
          doubt_id: string
          helpful_count: number | null
          id: string
          image_url: string | null
          responder_id: string
          responder_role: string
        }
        Insert: {
          answer_text: string
          created_at?: string
          doubt_id: string
          helpful_count?: number | null
          id?: string
          image_url?: string | null
          responder_id: string
          responder_role: string
        }
        Update: {
          answer_text?: string
          created_at?: string
          doubt_id?: string
          helpful_count?: number | null
          id?: string
          image_url?: string | null
          responder_id?: string
          responder_role?: string
        }
        Relationships: [
          {
            foreignKeyName: "doubt_answers_doubt_id_fkey"
            columns: ["doubt_id"]
            isOneToOne: false
            referencedRelation: "doubts"
            referencedColumns: ["id"]
          },
        ]
      }
      doubts: {
        Row: {
          ai_answer: string | null
          ai_escalated: boolean
          assigned_teacher_id: string | null
          created_at: string
          id: string
          image_url: string | null
          question_text: string
          resolution_type: string | null
          routed_to: string
          status: string
          subject: string
          topic: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          ai_answer?: string | null
          ai_escalated?: boolean
          assigned_teacher_id?: string | null
          created_at?: string
          id?: string
          image_url?: string | null
          question_text: string
          resolution_type?: string | null
          routed_to?: string
          status?: string
          subject: string
          topic?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          ai_answer?: string | null
          ai_escalated?: boolean
          assigned_teacher_id?: string | null
          created_at?: string
          id?: string
          image_url?: string | null
          question_text?: string
          resolution_type?: string | null
          routed_to?: string
          status?: string
          subject?: string
          topic?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      educator_applications: {
        Row: {
          alt_contact_no: string | null
          candidate_name: string
          class_level: string[] | null
          contact_no: string
          created_at: string
          credentials_sent_at: string | null
          current_ctc: number | null
          current_organization: string | null
          date_of_birth: string
          demo_video_link: string
          email: string
          expected_ctc: number
          highest_qualification: string
          id: string
          other_qualification: string | null
          photo_url: string | null
          previous_organization: string | null
          resume_url: string | null
          status: string
          subject: string
          total_experience: number
          updated_at: string
        }
        Insert: {
          alt_contact_no?: string | null
          candidate_name: string
          class_level?: string[] | null
          contact_no: string
          created_at?: string
          credentials_sent_at?: string | null
          current_ctc?: number | null
          current_organization?: string | null
          date_of_birth: string
          demo_video_link: string
          email: string
          expected_ctc: number
          highest_qualification: string
          id?: string
          other_qualification?: string | null
          photo_url?: string | null
          previous_organization?: string | null
          resume_url?: string | null
          status?: string
          subject: string
          total_experience: number
          updated_at?: string
        }
        Update: {
          alt_contact_no?: string | null
          candidate_name?: string
          class_level?: string[] | null
          contact_no?: string
          created_at?: string
          credentials_sent_at?: string | null
          current_ctc?: number | null
          current_organization?: string | null
          date_of_birth?: string
          demo_video_link?: string
          email?: string
          expected_ctc?: number
          highest_qualification?: string
          id?: string
          other_qualification?: string | null
          photo_url?: string | null
          previous_organization?: string | null
          resume_url?: string | null
          status?: string
          subject?: string
          total_experience?: number
          updated_at?: string
        }
        Relationships: []
      }
      educator_follows: {
        Row: {
          created_at: string
          educator_name: string
          educator_subject: string | null
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          educator_name: string
          educator_subject?: string | null
          id?: string
          user_id: string
        }
        Update: {
          created_at?: string
          educator_name?: string
          educator_subject?: string | null
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      email_send_log: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          message_id: string | null
          metadata: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email?: string
          status?: string
          template_name?: string
        }
        Relationships: []
      }
      email_send_state: {
        Row: {
          auth_email_ttl_minutes: number
          batch_size: number
          id: number
          retry_after_until: string | null
          send_delay_ms: number
          transactional_email_ttl_minutes: number
          updated_at: string
        }
        Insert: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Update: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Relationships: []
      }
      email_unsubscribe_tokens: {
        Row: {
          created_at: string
          email: string
          id: string
          token: string
          used_at: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          token: string
          used_at?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          token?: string
          used_at?: string | null
        }
        Relationships: []
      }
      enquiries: {
        Row: {
          assigned_to: string | null
          created_at: string
          email: string
          id: string
          message: string
          name: string
          phone: string | null
          region: string | null
          source: string
          staff_notes: string | null
          status: string
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          created_at?: string
          email: string
          id?: string
          message: string
          name: string
          phone?: string | null
          region?: string | null
          source?: string
          staff_notes?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          created_at?: string
          email?: string
          id?: string
          message?: string
          name?: string
          phone?: string | null
          region?: string | null
          source?: string
          staff_notes?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      enrollments: {
        Row: {
          completed_lessons: number
          course_id: string
          created_at: string
          id: string
          is_active: boolean
          last_accessed_at: string | null
          last_lesson_title: string | null
          progress_percent: number
          updated_at: string
          user_id: string
        }
        Insert: {
          completed_lessons?: number
          course_id: string
          created_at?: string
          id?: string
          is_active?: boolean
          last_accessed_at?: string | null
          last_lesson_title?: string | null
          progress_percent?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          completed_lessons?: number
          course_id?: string
          created_at?: string
          id?: string
          is_active?: boolean
          last_accessed_at?: string | null
          last_lesson_title?: string | null
          progress_percent?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "enrollments_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      exams: {
        Row: {
          code: string | null
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          is_active: boolean
          name: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          code?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          code?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      lesson_notes: {
        Row: {
          content: string
          created_at: string
          id: string
          lesson_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          content?: string
          created_at?: string
          id?: string
          lesson_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          lesson_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lesson_notes_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
        ]
      }
      lesson_progress: {
        Row: {
          course_id: string
          created_at: string
          id: string
          is_completed: boolean
          last_watched_at: string
          lesson_slug: string
          lesson_title: string | null
          total_seconds: number
          updated_at: string
          user_id: string
          watched_seconds: number
        }
        Insert: {
          course_id: string
          created_at?: string
          id?: string
          is_completed?: boolean
          last_watched_at?: string
          lesson_slug: string
          lesson_title?: string | null
          total_seconds?: number
          updated_at?: string
          user_id: string
          watched_seconds?: number
        }
        Update: {
          course_id?: string
          created_at?: string
          id?: string
          is_completed?: boolean
          last_watched_at?: string
          lesson_slug?: string
          lesson_title?: string | null
          total_seconds?: number
          updated_at?: string
          user_id?: string
          watched_seconds?: number
        }
        Relationships: [
          {
            foreignKeyName: "lesson_progress_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      lessons: {
        Row: {
          chapter_id: string
          course_id: string
          created_at: string
          duration_seconds: number
          id: string
          is_free_preview: boolean
          position: number
          slug: string
          title: string
          type: string
          updated_at: string
          video_url: string | null
        }
        Insert: {
          chapter_id: string
          course_id: string
          created_at?: string
          duration_seconds?: number
          id?: string
          is_free_preview?: boolean
          position?: number
          slug: string
          title: string
          type?: string
          updated_at?: string
          video_url?: string | null
        }
        Update: {
          chapter_id?: string
          course_id?: string
          created_at?: string
          duration_seconds?: number
          id?: string
          is_free_preview?: boolean
          position?: number
          slug?: string
          title?: string
          type?: string
          updated_at?: string
          video_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lessons_chapter_id_fkey"
            columns: ["chapter_id"]
            isOneToOne: false
            referencedRelation: "chapters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lessons_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      live_class_attendance: {
        Row: {
          class_id: string
          created_at: string
          id: string
          joined_at: string | null
          status: string
          user_id: string
        }
        Insert: {
          class_id: string
          created_at?: string
          id?: string
          joined_at?: string | null
          status?: string
          user_id: string
        }
        Update: {
          class_id?: string
          created_at?: string
          id?: string
          joined_at?: string | null
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "live_class_attendance_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "live_classes"
            referencedColumns: ["id"]
          },
        ]
      }
      live_class_messages: {
        Row: {
          class_id: string
          created_at: string
          display_name: string
          id: string
          is_teacher: boolean
          message: string
          user_id: string
        }
        Insert: {
          class_id: string
          created_at?: string
          display_name: string
          id?: string
          is_teacher?: boolean
          message: string
          user_id: string
        }
        Update: {
          class_id?: string
          created_at?: string
          display_name?: string
          id?: string
          is_teacher?: boolean
          message?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "live_class_messages_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "live_classes"
            referencedColumns: ["id"]
          },
        ]
      }
      live_class_templates: {
        Row: {
          created_at: string
          created_by: string
          description: string | null
          duration_minutes: number
          educator_avatar: string | null
          educator_name: string | null
          id: string
          max_participants: number | null
          meeting_url: string | null
          name: string
          subject: string
          target_exam: string | null
          teacher_id: string | null
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          description?: string | null
          duration_minutes?: number
          educator_avatar?: string | null
          educator_name?: string | null
          id?: string
          max_participants?: number | null
          meeting_url?: string | null
          name: string
          subject: string
          target_exam?: string | null
          teacher_id?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          description?: string | null
          duration_minutes?: number
          educator_avatar?: string | null
          educator_name?: string | null
          id?: string
          max_participants?: number | null
          meeting_url?: string | null
          name?: string
          subject?: string
          target_exam?: string | null
          teacher_id?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      live_classes: {
        Row: {
          cancellation_reason: string | null
          cancelled_at: string | null
          cancelled_by: string | null
          course_id: string | null
          created_at: string
          created_by: string | null
          description: string | null
          educator_avatar: string | null
          educator_name: string
          ends_at: string | null
          id: string
          max_participants: number | null
          meeting_url: string | null
          recording_url: string | null
          scheduled_by: string | null
          slug: string
          starts_at: string
          status: string
          subject: string
          target_exam: string | null
          title: string
          updated_at: string
        }
        Insert: {
          cancellation_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          course_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          educator_avatar?: string | null
          educator_name: string
          ends_at?: string | null
          id?: string
          max_participants?: number | null
          meeting_url?: string | null
          recording_url?: string | null
          scheduled_by?: string | null
          slug?: string
          starts_at: string
          status?: string
          subject: string
          target_exam?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          cancellation_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          course_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          educator_avatar?: string | null
          educator_name?: string
          ends_at?: string | null
          id?: string
          max_participants?: number | null
          meeting_url?: string | null
          recording_url?: string | null
          scheduled_by?: string | null
          slug?: string
          starts_at?: string
          status?: string
          subject?: string
          target_exam?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "live_classes_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      mentor_announcement_rsvps: {
        Row: {
          announcement_id: string
          created_at: string
          id: string
          responded_at: string | null
          response: string
          student_id: string
        }
        Insert: {
          announcement_id: string
          created_at?: string
          id?: string
          responded_at?: string | null
          response?: string
          student_id: string
        }
        Update: {
          announcement_id?: string
          created_at?: string
          id?: string
          responded_at?: string | null
          response?: string
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "mentor_announcement_rsvps_announcement_id_fkey"
            columns: ["announcement_id"]
            isOneToOne: false
            referencedRelation: "mentor_announcements"
            referencedColumns: ["id"]
          },
        ]
      }
      mentor_announcements: {
        Row: {
          agenda: string | null
          created_at: string
          duration_minutes: number
          id: string
          meeting_at: string
          meeting_url: string | null
          mentor_id: string
          parent_template_id: string | null
          recurrence: string
          recurrence_active: boolean
          recurrence_interval_days: number | null
          reminder_sent_at: string | null
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          agenda?: string | null
          created_at?: string
          duration_minutes?: number
          id?: string
          meeting_at: string
          meeting_url?: string | null
          mentor_id: string
          parent_template_id?: string | null
          recurrence?: string
          recurrence_active?: boolean
          recurrence_interval_days?: number | null
          reminder_sent_at?: string | null
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          agenda?: string | null
          created_at?: string
          duration_minutes?: number
          id?: string
          meeting_at?: string
          meeting_url?: string | null
          mentor_id?: string
          parent_template_id?: string | null
          recurrence?: string
          recurrence_active?: boolean
          recurrence_interval_days?: number | null
          reminder_sent_at?: string | null
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "mentor_announcements_parent_template_id_fkey"
            columns: ["parent_template_id"]
            isOneToOne: false
            referencedRelation: "mentor_announcements"
            referencedColumns: ["id"]
          },
        ]
      }
      mentor_backup_pool: {
        Row: {
          added_by: string
          backup_mentor_id: string
          created_at: string
          id: string
          primary_mentor_id: string
        }
        Insert: {
          added_by: string
          backup_mentor_id: string
          created_at?: string
          id?: string
          primary_mentor_id: string
        }
        Update: {
          added_by?: string
          backup_mentor_id?: string
          created_at?: string
          id?: string
          primary_mentor_id?: string
        }
        Relationships: []
      }
      mentor_group_members: {
        Row: {
          group_id: string
          id: string
          joined_at: string
          student_id: string
        }
        Insert: {
          group_id: string
          id?: string
          joined_at?: string
          student_id: string
        }
        Update: {
          group_id?: string
          id?: string
          joined_at?: string
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "mentor_group_members_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "mentor_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      mentor_group_reads: {
        Row: {
          group_id: string
          id: string
          last_read_at: string
          updated_at: string
          user_id: string
        }
        Insert: {
          group_id: string
          id?: string
          last_read_at?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          group_id?: string
          id?: string
          last_read_at?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      mentor_groups: {
        Row: {
          created_at: string
          id: string
          mentor_id: string
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          mentor_id: string
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          mentor_id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      mentor_handovers: {
        Row: {
          backup_mentor_id: string
          created_at: string
          created_by: string
          ended_early_at: string | null
          ends_at: string
          id: string
          primary_mentor_id: string
          reason: string | null
          started_at: string
        }
        Insert: {
          backup_mentor_id: string
          created_at?: string
          created_by: string
          ended_early_at?: string | null
          ends_at: string
          id?: string
          primary_mentor_id: string
          reason?: string | null
          started_at?: string
        }
        Update: {
          backup_mentor_id?: string
          created_at?: string
          created_by?: string
          ended_early_at?: string | null
          ends_at?: string
          id?: string
          primary_mentor_id?: string
          reason?: string | null
          started_at?: string
        }
        Relationships: []
      }
      mentor_messages: {
        Row: {
          content: string | null
          conversation_type: string
          created_at: string
          file_mime: string | null
          file_name: string | null
          file_path: string | null
          file_size_bytes: number | null
          file_url: string | null
          group_id: string | null
          id: string
          image_url: string | null
          is_deleted: boolean
          read_at: string | null
          recipient_id: string | null
          sender_id: string
        }
        Insert: {
          content?: string | null
          conversation_type: string
          created_at?: string
          file_mime?: string | null
          file_name?: string | null
          file_path?: string | null
          file_size_bytes?: number | null
          file_url?: string | null
          group_id?: string | null
          id?: string
          image_url?: string | null
          is_deleted?: boolean
          read_at?: string | null
          recipient_id?: string | null
          sender_id: string
        }
        Update: {
          content?: string | null
          conversation_type?: string
          created_at?: string
          file_mime?: string | null
          file_name?: string | null
          file_path?: string | null
          file_size_bytes?: number | null
          file_url?: string | null
          group_id?: string | null
          id?: string
          image_url?: string | null
          is_deleted?: boolean
          read_at?: string | null
          recipient_id?: string | null
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "mentor_messages_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "mentor_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      mentor_reviews: {
        Row: {
          created_at: string
          id: string
          mentor_id: string
          rating: number
          review: string | null
          student_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          mentor_id: string
          rating: number
          review?: string | null
          student_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          mentor_id?: string
          rating?: number
          review?: string | null
          student_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      mentor_student_assignments: {
        Row: {
          assigned_at: string
          assigned_by: string
          id: string
          mentor_id: string
          removed_at: string | null
          student_id: string
        }
        Insert: {
          assigned_at?: string
          assigned_by: string
          id?: string
          mentor_id: string
          removed_at?: string | null
          student_id: string
        }
        Update: {
          assigned_at?: string
          assigned_by?: string
          id?: string
          mentor_id?: string
          removed_at?: string | null
          student_id?: string
        }
        Relationships: []
      }
      notification_preferences: {
        Row: {
          created_at: string
          email_doubt_answered: boolean
          email_live_class_reminder: boolean
          email_mentor_message: boolean
          email_payment_receipt: boolean
          email_system: boolean
          id: string
          inapp_doubt_answered: boolean
          inapp_live_class_reminder: boolean
          inapp_mentor_message: boolean
          inapp_payment_receipt: boolean
          inapp_system: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          email_doubt_answered?: boolean
          email_live_class_reminder?: boolean
          email_mentor_message?: boolean
          email_payment_receipt?: boolean
          email_system?: boolean
          id?: string
          inapp_doubt_answered?: boolean
          inapp_live_class_reminder?: boolean
          inapp_mentor_message?: boolean
          inapp_payment_receipt?: boolean
          inapp_system?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          email_doubt_answered?: boolean
          email_live_class_reminder?: boolean
          email_mentor_message?: boolean
          email_payment_receipt?: boolean
          email_system?: boolean
          id?: string
          inapp_doubt_answered?: boolean
          inapp_live_class_reminder?: boolean
          inapp_mentor_message?: boolean
          inapp_payment_receipt?: boolean
          inapp_system?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          archived_at: string | null
          body: string | null
          created_at: string
          id: string
          link: string | null
          read_at: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          archived_at?: string | null
          body?: string | null
          created_at?: string
          id?: string
          link?: string | null
          read_at?: string | null
          title: string
          type?: string
          user_id: string
        }
        Update: {
          archived_at?: string | null
          body?: string | null
          created_at?: string
          id?: string
          link?: string | null
          read_at?: string | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      payments: {
        Row: {
          amount: number
          created_at: string
          currency: string
          external_id: string | null
          gateway: string
          id: string
          metadata: Json | null
          plan: string | null
          refunded_at: string | null
          status: string
          student_name: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          amount?: number
          created_at?: string
          currency?: string
          external_id?: string | null
          gateway?: string
          id?: string
          metadata?: Json | null
          plan?: string | null
          refunded_at?: string | null
          status?: string
          student_name?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          amount?: number
          created_at?: string
          currency?: string
          external_id?: string | null
          gateway?: string
          id?: string
          metadata?: Json | null
          plan?: string | null
          refunded_at?: string | null
          status?: string
          student_name?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      platform_settings: {
        Row: {
          admin_email_alerts: boolean
          id: number
          maintenance_mode: boolean
          open_registrations: boolean
          site_name: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          admin_email_alerts?: boolean
          id?: number
          maintenance_mode?: boolean
          open_registrations?: boolean
          site_name?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          admin_email_alerts?: boolean
          id?: number
          maintenance_mode?: boolean
          open_registrations?: boolean
          site_name?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          city: string | null
          class_level: string | null
          country: string | null
          created_at: string
          doubt_preference: string
          full_name: string | null
          goal: string | null
          id: string
          is_associated_to_school: boolean
          is_suspended: boolean
          onboarding_completed: boolean
          phone: string | null
          plan: string
          school_id: string | null
          target_exam: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          city?: string | null
          class_level?: string | null
          country?: string | null
          created_at?: string
          doubt_preference?: string
          full_name?: string | null
          goal?: string | null
          id?: string
          is_associated_to_school?: boolean
          is_suspended?: boolean
          onboarding_completed?: boolean
          phone?: string | null
          plan?: string
          school_id?: string | null
          target_exam?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          city?: string | null
          class_level?: string | null
          country?: string | null
          created_at?: string
          doubt_preference?: string
          full_name?: string | null
          goal?: string | null
          id?: string
          is_associated_to_school?: boolean
          is_suspended?: boolean
          onboarding_completed?: boolean
          phone?: string | null
          plan?: string
          school_id?: string | null
          target_exam?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      question_bank: {
        Row: {
          correct_answer: Json
          created_at: string
          created_by: string | null
          difficulty: string
          explanation: string | null
          id: string
          is_public: boolean
          marks_correct: number
          marks_wrong: number
          options: Json
          question_image_url: string | null
          question_text: string
          subject: string
          tags: string[]
          topic: string | null
          updated_at: string
        }
        Insert: {
          correct_answer: Json
          created_at?: string
          created_by?: string | null
          difficulty?: string
          explanation?: string | null
          id?: string
          is_public?: boolean
          marks_correct?: number
          marks_wrong?: number
          options?: Json
          question_image_url?: string | null
          question_text: string
          subject: string
          tags?: string[]
          topic?: string | null
          updated_at?: string
        }
        Update: {
          correct_answer?: Json
          created_at?: string
          created_by?: string | null
          difficulty?: string
          explanation?: string | null
          id?: string
          is_public?: boolean
          marks_correct?: number
          marks_wrong?: number
          options?: Json
          question_image_url?: string | null
          question_text?: string
          subject?: string
          tags?: string[]
          topic?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      reports: {
        Row: {
          category: string
          created_at: string
          description: string
          evidence_url: string | null
          handled_by: string | null
          id: string
          reported_name: string
          reported_role: string
          reported_user_id: string | null
          reporter_id: string
          resolution_notes: string | null
          status: string
          subject: string
          updated_at: string
        }
        Insert: {
          category?: string
          created_at?: string
          description: string
          evidence_url?: string | null
          handled_by?: string | null
          id?: string
          reported_name: string
          reported_role?: string
          reported_user_id?: string | null
          reporter_id: string
          resolution_notes?: string | null
          status?: string
          subject: string
          updated_at?: string
        }
        Update: {
          category?: string
          created_at?: string
          description?: string
          evidence_url?: string | null
          handled_by?: string | null
          id?: string
          reported_name?: string
          reported_role?: string
          reported_user_id?: string | null
          reporter_id?: string
          resolution_notes?: string | null
          status?: string
          subject?: string
          updated_at?: string
        }
        Relationships: []
      }
      schools: {
        Row: {
          address: string | null
          board: string | null
          city: string | null
          code: string | null
          contact_email: string | null
          contact_person: string | null
          contact_phone: string | null
          country: string | null
          created_at: string
          created_by: string | null
          id: string
          is_active: boolean
          name: string
          updated_at: string
        }
        Insert: {
          address?: string | null
          board?: string | null
          city?: string | null
          code?: string | null
          contact_email?: string | null
          contact_person?: string | null
          contact_phone?: string | null
          country?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          address?: string | null
          board?: string | null
          city?: string | null
          code?: string | null
          contact_email?: string | null
          contact_person?: string | null
          contact_phone?: string | null
          country?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      study_sessions: {
        Row: {
          created_at: string
          id: string
          minutes_studied: number
          questions_attempted: number
          questions_correct: number
          session_date: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          minutes_studied?: number
          questions_attempted?: number
          questions_correct?: number
          session_date?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          minutes_studied?: number
          questions_attempted?: number
          questions_correct?: number
          session_date?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      suppressed_emails: {
        Row: {
          created_at: string
          email: string
          id: string
          metadata: Json | null
          reason: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          metadata?: Json | null
          reason: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          metadata?: Json | null
          reason?: string
        }
        Relationships: []
      }
      test_attempts: {
        Row: {
          answers: Json | null
          attempted_at: string
          correct_answers: number
          created_at: string
          id: string
          metadata: Json | null
          percentile: number | null
          question_statuses: Json | null
          score: number
          started_at: string | null
          status: string
          subject: string | null
          submitted_at: string | null
          test_id: string | null
          test_name: string
          time_spent_seconds: number | null
          total_questions: number
          user_id: string
        }
        Insert: {
          answers?: Json | null
          attempted_at?: string
          correct_answers?: number
          created_at?: string
          id?: string
          metadata?: Json | null
          percentile?: number | null
          question_statuses?: Json | null
          score?: number
          started_at?: string | null
          status?: string
          subject?: string | null
          submitted_at?: string | null
          test_id?: string | null
          test_name: string
          time_spent_seconds?: number | null
          total_questions?: number
          user_id: string
        }
        Update: {
          answers?: Json | null
          attempted_at?: string
          correct_answers?: number
          created_at?: string
          id?: string
          metadata?: Json | null
          percentile?: number | null
          question_statuses?: Json | null
          score?: number
          started_at?: string | null
          status?: string
          subject?: string | null
          submitted_at?: string | null
          test_id?: string | null
          test_name?: string
          time_spent_seconds?: number | null
          total_questions?: number
          user_id?: string
        }
        Relationships: []
      }
      test_questions: {
        Row: {
          correct_answer: Json
          created_at: string
          difficulty: string | null
          explanation: string | null
          id: string
          marks_correct: number | null
          marks_wrong: number | null
          options: Json
          position: number
          question_image_url: string | null
          question_text: string
          question_type: string
          subject: string | null
          test_id: string
          topic: string | null
        }
        Insert: {
          correct_answer: Json
          created_at?: string
          difficulty?: string | null
          explanation?: string | null
          id?: string
          marks_correct?: number | null
          marks_wrong?: number | null
          options?: Json
          position?: number
          question_image_url?: string | null
          question_text: string
          question_type?: string
          subject?: string | null
          test_id: string
          topic?: string | null
        }
        Update: {
          correct_answer?: Json
          created_at?: string
          difficulty?: string | null
          explanation?: string | null
          id?: string
          marks_correct?: number | null
          marks_wrong?: number | null
          options?: Json
          position?: number
          question_image_url?: string | null
          question_text?: string
          question_type?: string
          subject?: string | null
          test_id?: string
          topic?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "test_questions_test_id_fkey"
            columns: ["test_id"]
            isOneToOne: false
            referencedRelation: "tests"
            referencedColumns: ["id"]
          },
        ]
      }
      tests: {
        Row: {
          correct_marks: number
          course_id: string | null
          created_at: string
          created_by: string | null
          description: string | null
          duration_minutes: number
          ends_at: string | null
          exam_pattern: string
          id: string
          is_published: boolean
          slug: string
          starts_at: string | null
          subjects: string[] | null
          test_type: string
          title: string
          total_marks: number
          total_questions: number
          updated_at: string
          visibility: string
          wrong_marks: number
        }
        Insert: {
          correct_marks?: number
          course_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          duration_minutes?: number
          ends_at?: string | null
          exam_pattern?: string
          id?: string
          is_published?: boolean
          slug: string
          starts_at?: string | null
          subjects?: string[] | null
          test_type?: string
          title: string
          total_marks?: number
          total_questions?: number
          updated_at?: string
          visibility?: string
          wrong_marks?: number
        }
        Update: {
          correct_marks?: number
          course_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          duration_minutes?: number
          ends_at?: string | null
          exam_pattern?: string
          id?: string
          is_published?: boolean
          slug?: string
          starts_at?: string | null
          subjects?: string[] | null
          test_type?: string
          title?: string
          total_marks?: number
          total_questions?: number
          updated_at?: string
          visibility?: string
          wrong_marks?: number
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_set_user_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: undefined
      }
      delete_email: {
        Args: { message_id: number; queue_name: string }
        Returns: boolean
      }
      educator_application_exists: {
        Args: { _contact_no: string; _email: string }
        Returns: boolean
      }
      enqueue_email: {
        Args: { payload: Json; queue_name: string }
        Returns: number
      }
      enquiry_recently_submitted: {
        Args: { _email: string; _phone: string }
        Returns: boolean
      }
      get_user_streak: { Args: { _user_id: string }; Returns: number }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_active_backup_for_mentor: {
        Args: { _backup: string; _primary: string }
        Returns: boolean
      }
      is_active_backup_for_student: {
        Args: { _mentor: string; _student: string }
        Returns: boolean
      }
      is_admin_or_super: { Args: { _user_id: string }; Returns: boolean }
      is_member_of_group: {
        Args: { _group_id: string; _user_id: string }
        Returns: boolean
      }
      is_mentor_of_group: {
        Args: { _group_id: string; _user_id: string }
        Returns: boolean
      }
      move_to_dlq: {
        Args: {
          dlq_name: string
          message_id: number
          payload: Json
          source_queue: string
        }
        Returns: number
      }
      notify_admins: {
        Args: { _body: string; _link: string; _title: string; _type: string }
        Returns: undefined
      }
      pick_teacher_for_doubt: { Args: never; Returns: string }
      read_email_batch: {
        Args: { batch_size: number; queue_name: string; vt: number }
        Returns: {
          message: Json
          msg_id: number
          read_ct: number
        }[]
      }
      slugify_text: { Args: { input: string }; Returns: string }
      submit_test_attempt: { Args: { _attempt_id: string }; Returns: Json }
      upcoming_live_class_reminders: {
        Args: { _lookahead_minutes?: number }
        Returns: {
          class_id: string
          class_title: string
          educator_name: string
          starts_at: string
          subject: string
          user_email: string
          user_id: string
          user_name: string
        }[]
      }
    }
    Enums: {
      app_role: "super_admin" | "admin" | "student" | "teacher" | "mentor"
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
      app_role: ["super_admin", "admin", "student", "teacher", "mentor"],
    },
  },
} as const
