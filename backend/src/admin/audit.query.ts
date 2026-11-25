import {
  AUDIT_ACTION_TYPES,
  type AuditLogQuery,
} from "../audit/audit.types.js";
import { readQueryValue } from "./spot.input.js";

type ParseResult<T> = { ok: true; value: T } | { ok: false; error: string };

const DAY = /^(\d{4})-(\d{2})-(\d{2})$/;
const INSTANT =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,3}))?Z$/;
const WHOLE = /^[1-9]\d*$/;

export function parseAuditQuery(query: unknown): ParseResult<AuditLogQuery> {
  const userId = readOptionalText(query, "userId");
  if (!userId.ok) return userId;

  const actionType = readActionType(query);
  if (!actionType.ok) return actionType;

  const dateFrom = readDate(query, "dateFrom", "start");
  if (!dateFrom.ok) return dateFrom;

  const dateTo = readDate(query, "dateTo", "end");
  if (!dateTo.ok) return dateTo;

  if (
    dateFrom.value !== undefined &&
    dateTo.value !== undefined &&
    dateFrom.value.getTime() > dateTo.value.getTime()
  ) {
    return fail("dateFrom must be before or equal to dateTo");
  }

  const page = readPage(query);
  if (!page.ok) return page;

  const value: AuditLogQuery = {};
  if (userId.value !== undefined) value.userId = userId.value;
  if (actionType.value !== undefined) value.actionType = actionType.value;
  if (dateFrom.value !== undefined) value.dateFrom = dateFrom.value;
  if (dateTo.value !== undefined) value.dateTo = dateTo.value;
  if (page.value !== undefined) {
    value.page = page.value.page;
    value.pageSize = page.value.pageSize;
  }
  return { ok: true, value };
}

function readOptionalText(
  query: unknown,
  field: string,
): ParseResult<string | undefined> {
  const read = readQueryValue(query, field);
  if (!read.ok) return read;
  if (read.value === undefined) return { ok: true, value: undefined };
  const trimmed = read.value.trim();
  if (trimmed.length === 0) return fail(`${field} must be a non-empty string`);
  return { ok: true, value: trimmed };
}

function readActionType(
  query: unknown,
): ParseResult<AuditLogQuery["actionType"]> {
  const read = readQueryValue(query, "actionType");
  if (!read.ok) return read;
  if (read.value === undefined) return { ok: true, value: undefined };
  const value = read.value.trim();
  if (!(AUDIT_ACTION_TYPES as readonly string[]).includes(value)) {
    return fail(`actionType must be one of: ${AUDIT_ACTION_TYPES.join(", ")}`);
  }
  return { ok: true, value: value as AuditLogQuery["actionType"] };
}

function readDate(
  query: unknown,
  field: "dateFrom" | "dateTo",
  bound: "start" | "end",
): ParseResult<Date | undefined> {
  const read = readQueryValue(query, field);
  if (!read.ok) return read;
  if (read.value === undefined) return { ok: true, value: undefined };
  const date = parseDate(read.value.trim(), bound);
  if (!date) return fail(`${field} must be an ISO date`);
  return { ok: true, value: date };
}

function readPage(
  query: unknown,
): ParseResult<{ page: number; pageSize: number } | undefined> {
  const page = readQueryValue(query, "page");
  if (!page.ok) return page;
  const pageSize = readQueryValue(query, "pageSize");
  if (!pageSize.ok) return pageSize;
  if (page.value === undefined && pageSize.value === undefined) {
    return { ok: true, value: undefined };
  }
  if (page.value === undefined || pageSize.value === undefined) {
    return fail("page and pageSize must be provided together");
  }
  const parsedPage = readWhole(page.value, "page");
  if (!parsedPage.ok) return parsedPage;
  const parsedSize = readWhole(pageSize.value, "pageSize");
  if (!parsedSize.ok) return parsedSize;
  return {
    ok: true,
    value: { page: parsedPage.value, pageSize: parsedSize.value },
  };
}

function readWhole(value: string, field: string): ParseResult<number> {
  if (!WHOLE.test(value)) {
    return fail(`${field} must be a whole number greater than or equal to 1`);
  }
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed)) {
    return fail(`${field} must be a whole number greater than or equal to 1`);
  }
  return { ok: true, value: parsed };
}

function parseDate(value: string, bound: "start" | "end"): Date | null {
  const day = DAY.exec(value);
  if (day) {
    const year = Number(day[1]);
    const month = Number(day[2]);
    const date = Number(day[3]);
    return utcDate(
      year,
      month,
      date,
      bound === "start" ? 0 : 23,
      bound === "start" ? 0 : 59,
      bound === "start" ? 0 : 59,
      bound === "start" ? 0 : 999,
    );
  }
  const instant = INSTANT.exec(value);
  if (!instant) return null;
  const milliseconds =
    instant[7] === undefined ? 0 : Number(instant[7].padEnd(3, "0"));
  return utcDate(
    Number(instant[1]),
    Number(instant[2]),
    Number(instant[3]),
    Number(instant[4]),
    Number(instant[5]),
    Number(instant[6]),
    milliseconds,
  );
}

function utcDate(
  year: number,
  month: number,
  day: number,
  hours: number,
  minutes: number,
  seconds: number,
  milliseconds: number,
): Date | null {
  if (
    month < 1 ||
    month > 12 ||
    hours > 23 ||
    minutes > 59 ||
    seconds > 59 ||
    milliseconds > 999
  ) {
    return null;
  }
  const date = new Date(
    Date.UTC(year, month - 1, day, hours, minutes, seconds, milliseconds),
  );
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }
  return date;
}

function fail(error: string): ParseResult<never> {
  return { ok: false, error };
}
