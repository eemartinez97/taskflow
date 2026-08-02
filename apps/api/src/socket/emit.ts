import { SOCKET_ROOM_PREFIX, SOCKET_USER_ROOM_PREFIX } from "@taskflow/shared";
import type { ServerToClientEvents } from "@taskflow/shared";
import type { AppServer } from "./events";

/** Names of every server -> client event, derived from the shared contract. */
type ServerEvent = keyof ServerToClientEvents;

/** Payload tuple for a given server event (usually a single object arg). */
type ServerEventArgs<Ev extends ServerEvent> = Parameters<ServerToClientEvents[Ev]>;

/** Broadcasts a typed event to every socket in a project room. */
export function emitToProject<Ev extends ServerEvent>(
  io: AppServer,
  projectId: string,
  event: Ev,
  ...payload: ServerEventArgs<Ev>
): void {
  io.to(`${SOCKET_ROOM_PREFIX}${projectId}`).emit(event, ...payload);
}

/** Broadcasts a typed event to a single user's personal room. */
export function emitToUser<Ev extends ServerEvent>(
  io: AppServer,
  userId: string,
  event: Ev,
  ...payload: ServerEventArgs<Ev>
): void {
  io.to(`${SOCKET_USER_ROOM_PREFIX}${userId}`).emit(event, ...payload);
}
