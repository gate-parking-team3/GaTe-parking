import { AuditLogModel } from "./audit.model.js";
import type {
  AuditActionType,
  AuditLogQuery,
  AuditLogRecord,
  AuditLogStore,
  NewAuditLog,
} from "./audit.types.js";

export const mongoAuditLogStore: AuditLogStore = {
  async append(entry: NewAuditLog) {
    const doc = await AuditLogModel.create(entry);
    return toAudit(doc);
  },

  async list(query: AuditLogQuery) {
    const filter: {
      userId?: string;
      actionType?: AuditActionType;
      createdAt?: { $gte?: Date; $lte?: Date };
    } = {};
    if (query.userId !== undefined) filter.userId = query.userId;
    if (query.actionType !== undefined) filter.actionType = query.actionType;
    if (query.dateFrom !== undefined || query.dateTo !== undefined) {
      const createdAt: { $gte?: Date; $lte?: Date } = {};
      if (query.dateFrom !== undefined) createdAt.$gte = query.dateFrom;
      if (query.dateTo !== undefined) createdAt.$lte = query.dateTo;
      filter.createdAt = createdAt;
    }

    let cursor = AuditLogModel.find(filter).sort({ createdAt: -1, _id: -1 });
    if (query.page !== undefined && query.pageSize !== undefined) {
      cursor = cursor
        .skip((query.page - 1) * query.pageSize)
        .limit(query.pageSize);
    }
    const docs = await cursor.lean();
    return docs.map(toAudit);
  },
};

function toAudit(doc: {
  _id: unknown;
  userId: string;
  action: string;
  actionType: string;
  createdAt: Date;
}): AuditLogRecord {
  return {
    id: String(doc._id),
    userId: doc.userId,
    action: doc.action,
    actionType: doc.actionType as AuditActionType,
    createdAt: new Date(doc.createdAt),
  };
}
