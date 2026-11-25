export interface AuditUser {
  id: string;
  name: string;
  email: string;
}

export interface AuditLogEntry {
  id: string;
  user: AuditUser;
  action: string;
  createdAt: string;
  details?: Record<string, unknown>;
}
