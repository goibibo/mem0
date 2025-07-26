export interface App {
  id: string;
  name: string;
  description?: string;
  metadata?: Record<string, any>;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Category {
  id: string;
  name: string;
  description?: string;
  created_at: string;
  updated_at: string;
}

export interface User {
  id: string;
  user_id: string;
  name?: string;
  email?: string;
  metadata?: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface Memory {
  id: string;
  user_id: string;
  app_id: string;
  content: string;
  vector?: string;
  metadata?: Record<string, any>;
  state: "active" | "paused" | "archived" | "deleted";
  created_at: string;
  updated_at: string;
  archived_at?: string;
  deleted_at?: string;
} 