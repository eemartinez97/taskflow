import { describe, expect, it, vi } from "vitest";

import { notificationsRouter } from "../../../../src/modules/notifications/router";
import * as service from "../../../../src/modules/notifications/service";
import { db, VALID_TASK_ID, VALID_USER } from "../../../helpers";
import { callerFor, expectTRPCError } from "../../../support/trpc";

vi.mock("../../../../src/modules/notifications/service");

const caller = () => callerFor(notificationsRouter);

describe("notifications router", () => {
  it("list -> listNotifications", async () => {
    await caller().list();

    expect(service.listNotifications).toHaveBeenCalledWith(db, VALID_USER.id);
  });

  it("markRead -> markReadById", async () => {
    await caller().markRead({ ids: [VALID_TASK_ID] });

    expect(service.markReadById).toHaveBeenCalledWith(db, VALID_USER.id, [VALID_TASK_ID]);
  });

  it("markAllRead -> markAllRead", async () => {
    await caller().markAllRead();

    expect(service.markAllRead).toHaveBeenCalledWith(db, VALID_USER.id);
  });

  it("delete -> deleteNotificationById scoped to the caller", async () => {
    await caller().delete({ notificationId: VALID_TASK_ID });

    expect(service.deleteNotificationById).toHaveBeenCalledWith(db, VALID_TASK_ID, VALID_USER.id);
  });

  it("rejects an empty ids array", async () => {
    await expect(caller().markRead({ ids: [] })).rejects.toThrow();
  });

  it.each(["list", "markAllRead"] as const)("%s requires a session", async (procedure) => {
    await expectTRPCError(callerFor(notificationsRouter, null)[procedure](), "UNAUTHORIZED");
  });
});
