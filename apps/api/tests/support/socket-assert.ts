import { expect } from "vitest";

import {
  SOCKET_ORG_ROOM_PREFIX,
  SOCKET_ROOM_PREFIX,
  SOCKET_USER_ROOM_PREFIX,
} from "@taskflow/shared";

import { mockEmit, mockExcept, mockTo } from "../mocks/socket";

export function expectEmittedToProject(
  projectId: string,
  event: string,
  payload: unknown,
  excludeUserId?: string,
): void {
  expect(mockTo).toHaveBeenCalledWith(`${SOCKET_ROOM_PREFIX}${projectId}`);
  expect(mockEmit).toHaveBeenCalledWith(event, payload);
  if (excludeUserId) {
    expect(mockExcept).toHaveBeenCalledWith(`${SOCKET_USER_ROOM_PREFIX}${excludeUserId}`);
  }
}

export function expectEmittedToUser(userId: string, event: string, payload: unknown): void {
  expect(mockTo).toHaveBeenCalledWith(`${SOCKET_USER_ROOM_PREFIX}${userId}`);
  expect(mockEmit).toHaveBeenCalledWith(event, payload);
}

export function expectEmittedToOrg(
  orgId: string,
  event: string,
  payload: unknown,
  excludeUserId?: string,
): void {
  expect(mockTo).toHaveBeenCalledWith(`${SOCKET_ORG_ROOM_PREFIX}${orgId}`);
  expect(mockEmit).toHaveBeenCalledWith(event, payload);
  if (excludeUserId) {
    expect(mockExcept).toHaveBeenCalledWith(`${SOCKET_USER_ROOM_PREFIX}${excludeUserId}`);
  }
}

export function expectNoEmit(): void {
  expect(mockEmit).not.toHaveBeenCalled();
}
