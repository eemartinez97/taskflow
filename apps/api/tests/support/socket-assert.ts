import { expect } from "vitest";

import { SOCKET_ROOM_PREFIX, SOCKET_USER_ROOM_PREFIX } from "@taskflow/shared";

import { mockEmit, mockTo } from "../mocks/socket";

export function expectEmittedToProject(projectId: string, event: string, payload: unknown): void {
  expect(mockTo).toHaveBeenCalledWith(`${SOCKET_ROOM_PREFIX}${projectId}`);
  expect(mockEmit).toHaveBeenCalledWith(event, payload);
}

export function expectEmittedToUser(userId: string, event: string, payload: unknown): void {
  expect(mockTo).toHaveBeenCalledWith(`${SOCKET_USER_ROOM_PREFIX}${userId}`);
  expect(mockEmit).toHaveBeenCalledWith(event, payload);
}

export function expectNoEmit(): void {
  expect(mockEmit).not.toHaveBeenCalled();
}
