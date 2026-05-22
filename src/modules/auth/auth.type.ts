import { type Request } from 'express'

export interface User {
  id: number;
  fullname: string;
  email: string;
  phone?: string;
  password: string;
  role: "admin" | "moderator" | "user";
  is_active: boolean;
  avatar?: string;
  created_at: Date;
  updated_at: Date;
}
