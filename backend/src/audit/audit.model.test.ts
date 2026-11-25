import { describe, expect, it } from "vitest";
import { AuditLogModel } from "./audit.model.js";

const entry = {
  userId: "U001",
  action: "Created parking spot A-101 in lot North Lot",
  actionType: "spot.created",
};

describe("AuditLogModel", () => {
  it("accepts a spot creation and sets createdAt", () => {
    const doc = new AuditLogModel(entry);
    expect(doc.validateSync()).toBeUndefined();
    expect(doc.createdAt).toBeInstanceOf(Date);
  });

  it("stores the user id only", () => {
    expect(AuditLogModel.schema.path("userId")).toBeDefined();
    expect(AuditLogModel.schema.path("name")).toBeUndefined();
    expect(AuditLogModel.schema.path("email")).toBeUndefined();
    expect(AuditLogModel.schema.get("versionKey")).toBe(false);
  });

  it("rejects an unknown action type", () => {
    const error = new AuditLogModel({
      ...entry,
      actionType: "user.deleted",
    }).validateSync();
    expect(error?.errors.actionType).toBeDefined();
  });

  it("indexes history by time, user and action type", () => {
    expect(AuditLogModel.schema.indexes()).toEqual(
      expect.arrayContaining([
        [{ createdAt: -1 }, expect.any(Object)],
        [{ userId: 1, createdAt: -1 }, expect.any(Object)],
        [{ actionType: 1, createdAt: -1 }, expect.any(Object)],
      ]),
    );
  });
});
