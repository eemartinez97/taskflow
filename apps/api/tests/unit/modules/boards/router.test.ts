import { beforeEach, describe, expect, it, vi } from "vitest";

import { createBoardsRouter } from "../../../../src/modules/boards/router";
import * as service from "../../../../src/modules/boards/service";
import {
  db,
  VALID_BOARD_ID,
  VALID_COLUMN_ID,
  VALID_ORG_ID,
  VALID_PROJECT_ID,
  VALID_USER,
} from "../../../helpers";
import { mockIo } from "../../../mocks/socket";
import { callerFor, expectTRPCError, grantRole } from "../../../support/trpc";
import { mockDb } from "../../../mocks/database-mock";
import { TENANT } from "../../../support/tenancy-fixtures";

vi.mock("../../../../src/modules/boards/service");

const router = createBoardsRouter(mockIo);
const caller = () => callerFor(router);
const org = { orgId: VALID_ORG_ID };

describe("boards router", () => {
  beforeEach(() => {
    grantRole("MEMBER");
    mockDb.project.findUnique.mockResolvedValue(TENANT.project);
    mockDb.board.findUnique.mockResolvedValue(TENANT.board);
    mockDb.column.findUnique.mockResolvedValue(TENANT.column);
  });

  it.each([
    [
      "list",
      () => caller().list({ ...org, projectId: VALID_PROJECT_ID }),
      () => {
        expect(service.listBoards).toHaveBeenCalledWith(db, VALID_PROJECT_ID);
      },
    ],
    [
      "get",
      () => caller().get({ ...org, boardId: VALID_BOARD_ID }),
      () => {
        expect(service.getBoardWithColumns).toHaveBeenCalledWith(db, VALID_BOARD_ID);
      },
    ],
    [
      "create",
      () => caller().create({ ...org, data: { projectId: VALID_PROJECT_ID, name: "S" } }),
      () => {
        expect(service.createBoardInProject).toHaveBeenCalledWith(db, {
          projectId: VALID_PROJECT_ID,
          name: "S",
        });
      },
    ],
    [
      "update",
      () => caller().update({ ...org, boardId: VALID_BOARD_ID, data: { name: "R" } }),
      () => {
        expect(service.updateBoardById).toHaveBeenCalledWith(
          db,
          mockIo,
          VALID_BOARD_ID,
          VALID_USER.id,
          { name: "R" },
        );
      },
    ],
    [
      "addColumn",
      () => caller().addColumn({ ...org, boardId: VALID_BOARD_ID, name: "QA" }),
      () => {
        expect(service.addColumn).toHaveBeenCalledWith(
          db,
          mockIo,
          VALID_BOARD_ID,
          VALID_USER.id,
          "QA",
        );
      },
    ],
    [
      "renameColumn",
      () => caller().renameColumn({ ...org, columnId: VALID_COLUMN_ID, name: "Done" }),
      () => {
        expect(service.renameColumn).toHaveBeenCalledWith(
          db,
          mockIo,
          VALID_COLUMN_ID,
          VALID_USER.id,
          "Done",
        );
      },
    ],
    [
      "setColumnStatus",
      () => caller().setColumnStatus({ ...org, columnId: VALID_COLUMN_ID, status: "DONE" }),
      () => {
        expect(service.setColumnStatus).toHaveBeenCalledWith(
          db,
          mockIo,
          VALID_COLUMN_ID,
          VALID_USER.id,
          "DONE",
        );
      },
    ],
    [
      "deleteColumn",
      () => caller().deleteColumn({ ...org, columnId: VALID_COLUMN_ID }),
      () => {
        expect(service.deleteColumnById).toHaveBeenCalledWith(
          db,
          mockIo,
          VALID_COLUMN_ID,
          VALID_USER.id,
        );
      },
    ],
    [
      "reorderColumns",
      () => caller().reorderColumns({ ...org, payload: { boardId: VALID_BOARD_ID, columns: [] } }),
      () => {
        expect(service.reorderBoardColumn).toHaveBeenCalledWith(db, mockIo, VALID_USER.id, {
          boardId: VALID_BOARD_ID,
          columns: [],
        });
      },
    ],
  ])("%s forwards to the service", async (_name, call, assert) => {
    await call();
    assert();
  });

  it("rejects an empty column name", async () => {
    await expect(
      caller().addColumn({ ...org, boardId: VALID_BOARD_ID, name: "" }),
    ).rejects.toThrow();
  });

  it("rejects a column name over 100 chars", async () => {
    await expect(
      caller().addColumn({ ...org, boardId: VALID_BOARD_ID, name: "x".repeat(101) }),
    ).rejects.toThrow();
  });

  it("allows a VIEWER to list boards (read-only)", async () => {
    grantRole("VIEWER");

    await caller().list({ ...org, projectId: VALID_PROJECT_ID });
    expect(service.listBoards).toHaveBeenCalledWith(db, VALID_PROJECT_ID);
  });

  it("rejects a VIEWER from creating a board (write)", async () => {
    grantRole("VIEWER");

    await expectTRPCError(
      caller().create({ ...org, data: { projectId: VALID_PROJECT_ID, name: "S" } }),
      "FORBIDDEN",
    );
  });

  it("delete forwards to the service (requires ADMIN)", async () => {
    grantRole("ADMIN");
    await caller().delete({ ...org, boardId: VALID_BOARD_ID });
    expect(service.deleteBoardById).toHaveBeenCalledWith(db, VALID_BOARD_ID);
  });
});
