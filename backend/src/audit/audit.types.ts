export const AUDIT_ACTION_TYPES = ["spot.created"] as const;
export type AuditActionType = (typeof AUDIT_ACTION_TYPES)[number];

export type AuditLogRecord = {
  id: string;
  userId: string;
  action: string;
  actionType: AuditActionType;
  createdAt: Date;
};

export type NewAuditLog = {
  userId: string;
  action: string;
  actionType: AuditActionType;
  createdAt: Date;
};

export type AuditLogQuery = {
  userId?: string;
  actionType?: AuditActionType;
  dateFrom?: Date;
  dateTo?: Date;
  page?: number;
  pageSize?: number;
};

export interface AuditLogStore {
  append(entry: NewAuditLog): Promise<AuditLogRecord>;
  list(query: AuditLogQuery): Promise<AuditLogRecord[]>;
}
