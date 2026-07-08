/**
 * Per-socket data attached during the auth handshake and readable in
 * all event handlers via socket.data.
 * `color` is resolved once at handshake so presence events never recompute it.
 */
export interface SocketData {
  userId: string;
  userEmail: string;
  userName: string | null;
  /** Hex color assigned on join for cursor / avatar display */
  color: string;
}

/**
 * Inter-server events - typed now so Server<C, S, I, D> generic is complete.
 * Required when adding a Redis/cluster adapter for horizontal scaling
 */
export interface InterServerEvents {
  ping: () => void;
}
