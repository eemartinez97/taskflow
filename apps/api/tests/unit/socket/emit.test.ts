import { describe, expect, it } from "vitest";
import { SOCKET_EVENTS } from "@taskflow/shared";

import { emitToOrg, emitToProject, emitToUser } from "../../../src/socket/emit";
import { mockEmit, mockExcept, mockIo, mockTo } from "../../mocks/socket";
import { ANOTHER_UUID, VALID_ORG_ID, VALID_PROJECT_ID, VALID_USER } from "../../helpers";

describe("emitToProject", () => {
  it("emits to the whole project room when no excludeUserId is given", () => {
    emitToProject(mockIo, VALID_PROJECT_ID, SOCKET_EVENTS.TASK_DELETED, {
      taskId: ANOTHER_UUID,
    });

    expect(mockTo).toHaveBeenCalledWith(`project:${VALID_PROJECT_ID}`);
    expect(mockExcept).not.toHaveBeenCalled();
    expect(mockEmit).toHaveBeenCalledWith(SOCKET_EVENTS.TASK_DELETED, { taskId: ANOTHER_UUID });
  });

  it("excludes the acting user's own room when excludeUserId is given", () => {
    emitToProject(
      mockIo,
      VALID_PROJECT_ID,
      SOCKET_EVENTS.TASK_DELETED,
      { taskId: ANOTHER_UUID },
      VALID_USER.id,
    );

    expect(mockTo).toHaveBeenCalledWith(`project:${VALID_PROJECT_ID}`);
    expect(mockExcept).toHaveBeenCalledWith(`user:${VALID_USER.id}`);
    expect(mockEmit).toHaveBeenCalledWith(SOCKET_EVENTS.TASK_DELETED, { taskId: ANOTHER_UUID });
  });
});

describe("emitToOrg", () => {
  it("emits to the whole org room when no excludeUserId is given", () => {
    emitToOrg(mockIo, VALID_ORG_ID, SOCKET_EVENTS.TASK_DELETED, { taskId: ANOTHER_UUID });

    expect(mockTo).toHaveBeenCalledWith(`org:${VALID_ORG_ID}`);
    expect(mockExcept).not.toHaveBeenCalled();
  });

  it("excludes the acting user's own room when excludeUserId is given", () => {
    emitToOrg(
      mockIo,
      VALID_ORG_ID,
      SOCKET_EVENTS.TASK_DELETED,
      { taskId: ANOTHER_UUID },
      VALID_USER.id,
    );

    expect(mockTo).toHaveBeenCalledWith(`org:${VALID_ORG_ID}`);
    expect(mockExcept).toHaveBeenCalledWith(`user:${VALID_USER.id}`);
  });
});

describe("emitToUser", () => {
  it("emits directly to the user's personal room", () => {
    emitToUser(mockIo, VALID_USER.id, SOCKET_EVENTS.TASK_DELETED, { taskId: ANOTHER_UUID });

    expect(mockTo).toHaveBeenCalledWith(`user:${VALID_USER.id}`);
    expect(mockEmit).toHaveBeenCalledWith(SOCKET_EVENTS.TASK_DELETED, { taskId: ANOTHER_UUID });
  });
});
