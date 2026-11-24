import type {
  AuditLogQuery,
  AuditLogRecord,
  AuditLogStore,
  NewAuditLog,
} from "./audit.types.js";

// In-memory audit log for tests. Copies records so a test cannot change the store.
export function memoryAuditLogStore(
  initial: AuditLogRecord[] = [],
): AuditLogStore {
  const logs = initial.map((entry) => ({ ...entry }));
  let sequence = logs.length + 1;

  return {
    async append(entry: NewAuditLog) {
      const record: AuditLogRecord = {
        id: sequence.toString(16).padStart(24, "0"),
        userId: entry.userId,
        action: entry.action,
        actionType: entry.actionType,
        createdAt: entry.createdAt,
      };
      sequence += 1;
      logs.push(record);
      return { ...record };
    },

    async list(query: AuditLogQuery) {
      const matched = logs.filter((entry) => {
        if (query.userId !== undefined && entry.userId !== query.userId) {
          return false;
        }
        if (
          query.actionType !== undefined &&
          entry.actionType !== query.actionType
        ) {
          return false;
        }
        if (
          query.dateFrom !== undefined &&
          entry.createdAt.getTime() < query.dateFrom.getTime()
        ) {
          return false;
        }
        if (
          query.dateTo !== undefined &&
          entry.createdAt.getTime() > query.dateTo.getTime()
        ) {
          return false;
        }
        return true;
      });
      matched.sort((a, b) => {
        const byTime = b.createdAt.getTime() - a.createdAt.getTime();
        if (byTime !== 0) return byTime;
        if (a.id < b.id) return 1;
        if (a.id > b.id) return -1;
        return 0;
      });
      const page = query.page;
      const pageSize = query.pageSize;
      const slice =
        page === undefined || pageSize === undefined
          ? matched
          : matched.slice((page - 1) * pageSize, page * pageSize);
      return slice.map((entry) => ({ ...entry }));
    },
  };
}
