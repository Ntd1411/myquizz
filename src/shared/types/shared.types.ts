import { type Request } from "express";
export interface AuthRequest extends Request {
  userId?: number;
  user?: any;
  token?: string;
}

export interface User {
  id: number;
  fullname: string;
  email: string;
  phone?: string;
  password: string;
  role: "admin" | "moderator" | "user";
  is_active: boolean;
  avatar?: string;
  created_at: string;
  updated_at: string;
}
export interface RefreshSession {
  id: number;
  user_id: number;
  device_name: string;
  ip_address: string;
  refresh_token: string;
  expires_at: string;
  created_at: string;
}
