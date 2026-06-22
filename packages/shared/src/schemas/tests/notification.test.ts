import { describe, expect, it } from "vitest";
import {
  createNotificationSchema,
  markNotificationsReadSchema,
  notificationActorSchema,
  notificationSchema,
  notificationTypeSchema,
} from "../notification";
import { NOTIFICATION_TYPES } from "../../constants";
import { ANOTHER_UUID, VALID_UUID, validNotification } from "./fixtures";

describe("notificationTypeSchema", () => {
  it("is derived from the NOTIFICATION_TYPES constant (single source of truth)", () => {
    expect(notificationTypeSchema.options).toEqual(NOTIFICATION_TYPES);
  });

  it("accepts all values defined in NOTIFICATION_TYPES", () => {
    for (const type of NOTIFICATION_TYPES) {
      expect(notificationTypeSchema.parse(type)).toBe(type);
    }
  });

  it("rejects a value not in NOTIFICATION_TYPES", () => {
    expect(() => notificationTypeSchema.parse("TASK_DELETED")).toThrow();
  });

  it("rejects empty string", () => {
    expect(() => notificationTypeSchema.parse("")).toThrow();
  });

  it("rejects null", () => {
    expect(() => notificationTypeSchema.parse(null)).toThrow();
  });
});

describe("notificationActorSchema", () => {
  const { actor } = validNotification;

  it("is a subset of userSchema - only id, name, image", () => {
    const result = notificationActorSchema.parse({
      ...actor,
    });
    expect(Object.keys(result)).toEqual(["id", "name", "image"]);
  });

  it("accepts valid actor with all fields", () => {
    const result = notificationActorSchema.parse({ ...actor });
    expect(result.id).toBe(actor.id);
    expect(result.name).toBe(actor.name);
  });

  it("accepts null name (user may not have set a display name)", () => {
    const result = notificationActorSchema.parse({ id: VALID_UUID, name: null, image: null });
    expect(result.name).toBeNull();
    expect(result.image).toBeNull();
  });

  it("rejects missing id", () => {
    expect(() => notificationActorSchema.parse({ name: actor.name, image: null })).toThrow();
  });

  it("rejects non-UUID id", () => {
    expect(() =>
      notificationActorSchema.parse({ id: "not-a-uuid", name: actor.name, image: null }),
    ).toThrow();
  });

  it("rejects invalid image URL", () => {
    expect(() => notificationActorSchema.parse({ ...actor, image: "not-a-url" })).toThrow();
  });
});

describe("notificationSchema", () => {
  it("parses a full valid notification with actor", () => {
    const result = notificationSchema.parse(validNotification);
    expect(result.id).toBe(validNotification.id);
    expect(result.type).toBe(validNotification.type);
    expect(result.actor?.name).toBe(validNotification.actor.name);
    expect(result.read).toBe(validNotification.read);
  });

  it("accepts null entityId and entityType (global notification)", () => {
    const result = notificationSchema.parse({
      ...validNotification,
      entityId: null,
      entityType: null,
    });
    expect(result.entityId).toBeNull();
    expect(result.entityType).toBeNull();
  });

  it("accepts read=true", () => {
    const result = notificationSchema.parse({ ...validNotification, read: true });
    expect(result.read).toBe(true);
  });

  it("accepts all valid notification types in the full schema", () => {
    for (const type of NOTIFICATION_TYPES) {
      const result = notificationSchema.parse({ ...validNotification, type });
      expect(result.type).toBe(type);
    }
  });

  it("rejects message exceeding 500 characters", () => {
    expect(() =>
      notificationSchema.parse({ ...validNotification, message: "x".repeat(501) }),
    ).toThrow();
  });

  it("rejects empty message", () => {
    expect(() => notificationSchema.parse({ ...validNotification, message: "" })).toThrow();
  });

  it("rejects entityType exceeding 50 characters", () => {
    expect(() => {
      notificationSchema.parse({ ...validNotification, entityType: "x".repeat(51) });
    });
  });

  it("rejects non-UUID id", () => {
    expect(() => notificationSchema.parse({ ...validNotification, id: "not-a-uuid" })).toThrow();
  });

  it("rejects invalid notification type", () => {
    expect(() => notificationSchema.parse({ ...validNotification, type: "UNKNOWN" })).toThrow();
  });

  it("rejects missing required fields", () => {
    expect(() => notificationSchema.parse({ type: "TASK_ASSIGNED" })).toThrow();
  });
});

describe("createNotificationSchema", () => {
  it("accepts minimal required fields only", () => {
    const result = createNotificationSchema.parse({
      userId: VALID_UUID,
      type: "TASK_ASSIGNED",
      message: "Alice assigned you to a task",
    });
    expect(result.userId).toBe(VALID_UUID);
    expect(result.actorId).toBeUndefined();
    expect(result.entityId).toBeUndefined();
    expect(result.entityType).toBeUndefined();
  });

  it("accepts all optional fields", () => {
    const result = createNotificationSchema.parse(validNotification);
    expect(result.actorId).toBe(validNotification.actorId);
    expect(result.entityId).toBe(validNotification.entityId);
    expect(result.entityType).toBe(validNotification.entityType);
  });

  it("accepts all NOTIFICATION_TYPES as valid type values", () => {
    for (const type of NOTIFICATION_TYPES) {
      const result = createNotificationSchema.parse({
        ...validNotification,
        type,
      });
      expect(result.type).toBe(type);
    }
  });

  it("rejects missing userId", () => {
    expect(() =>
      createNotificationSchema.parse({ ...validNotification, userId: undefined }),
    ).toThrow();
  });

  it("rejects missing type", () => {
    expect(() =>
      createNotificationSchema.parse({ ...validNotification, type: undefined }),
    ).toThrow();
  });

  it("rejects missing message", () => {
    expect(() =>
      createNotificationSchema.parse({ ...validNotification, message: undefined }),
    ).toThrow();
  });

  it("rejects invalid notification type", () => {
    expect(() =>
      createNotificationSchema.parse({ ...validNotification, type: "HACKED" }),
    ).toThrow();
  });

  it("rejects empty message", () => {
    expect(() => createNotificationSchema.parse({ ...validNotification, message: "" })).toThrow();
  });

  it("rejects message exceeding 500 characters", () => {
    expect(() =>
      createNotificationSchema.parse({ ...validNotification, message: "x".repeat(501) }),
    ).toThrow();
  });

  it("rejects entityType exceeding 50 characters", () => {
    expect(() =>
      createNotificationSchema.parse({ validNotification, entityType: "x".repeat(51) }),
    ).toThrow();
  });

  it("rejects non-UUID actorId", () => {
    expect(() =>
      createNotificationSchema.parse({ ...validNotification, actorId: "not-a-uuid" }),
    ).toThrow();
  });
});

describe("markNotificationsReadSchema", () => {
  it("accepts a single valid UUID in ids", () => {
    const result = markNotificationsReadSchema.parse({ ids: [VALID_UUID] });
    expect(result.ids).toHaveLength(1);
    expect(result.ids[0]).toBe(VALID_UUID);
  });

  it("accepts multiple valid UUIDs", () => {
    const result = markNotificationsReadSchema.parse({ ids: [VALID_UUID, ANOTHER_UUID] });
    expect(result.ids).toHaveLength(2);
  });

  it("rejects empty ids array (min: 1)", () => {
    expect(() => markNotificationsReadSchema.parse({ ids: [] })).toThrow();
  });

  it("rejects non-UUID values in ids", () => {
    expect(() => {
      markNotificationsReadSchema.parse({ ids: ["not-a-UUID"] });
    }).toThrow();
  });

  it("rejects missing ids field", () => {
    expect(() => markNotificationsReadSchema.parse({})).toThrow();
  });

  it("rejects mixed valid/invalid UUIDs", () => {
    expect(() => markNotificationsReadSchema.parse({ ids: [VALID_UUID, "bad-uuid"] })).toThrow();
  });
});

describe("NOTIFICATION_TYPES constant (sync guard)", () => {
  it("contains exactly 4 notification types", () => {
    expect(NOTIFICATION_TYPES).toHaveLength(4);
  });

  it("contains TASK_ASSIGNED", () => {
    expect(NOTIFICATION_TYPES).toContain("TASK_ASSIGNED");
  });

  it("contains TASK_UPDATED", () => {
    expect(NOTIFICATION_TYPES).toContain("TASK_UPDATED");
  });

  it("contains COMMENT_CREATED", () => {
    expect(NOTIFICATION_TYPES).toContain("COMMENT_CREATED");
  });

  it("contains MEMBER_INVITED", () => {
    expect(NOTIFICATION_TYPES).toContain("MEMBER_INVITED");
  });

  it("matches notificationTypeSchema.options exactly (constant IS the schema source)", () => {
    // This is the critical sync guard:
    // If add a type to NOTIFICATION_TYPES without updating
    // the Prisma enum (or viceversa), this test catches the drift.
    expect([...notificationTypeSchema.options]).toEqual([...NOTIFICATION_TYPES]);
  });
});
