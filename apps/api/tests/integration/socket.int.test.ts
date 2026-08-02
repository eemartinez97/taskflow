import { createServer, type Server as HttpServer } from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { io as ioClient, type Socket } from "socket.io-client";
import { SOCKET_EVENTS } from "@taskflow/shared";

import { createSocketServer } from "../../src/socket/server";
import { makeAuthCookie } from "../helpers";
import { resetDb } from "./setup/db";
import { seedWorkspace, seedUser, seedMember } from "./setup/seed";
import type { AppServer } from "../../src/socket/events";

let httpServer: HttpServer;
let io: AppServer;
let url: string;
const clients: Socket[] = [];

beforeAll(async () => {
  httpServer = createServer();
  io = createSocketServer(httpServer);

  await new Promise<void>((resolve) => {
    httpServer.listen(0, resolve);
  });
  url = `http://localhost:${String((httpServer.address() as AddressInfo).port)}`;
});

afterAll(async () => {
  for (const c of clients) c.disconnect();
  await new Promise<void>((resolve) => {
    void io.close(() => {
      resolve();
    });
  });
});

beforeEach(async () => {
  await resetDb();
});

async function connect(
  userId: string,
  email: string,
  opts: { projectId?: string; boardId?: string } = {},
): Promise<Socket> {
  const cookie = await makeAuthCookie({ sub: userId, email, name: "Tester" });

  const socket = ioClient(url, {
    transports: ["websocket"],
    extraHeaders: { Cookie: cookie },
    query: {
      ...(opts.projectId ? { projectId: opts.projectId } : {}),
      ...(opts.boardId ? { boardId: opts.boardId } : {}),
    },
  });

  clients.push(socket);
  await new Promise<void>((resolve, reject) => {
    socket.on("connect", () => {
      resolve();
    });
    socket.on("connect_error", (err) => {
      reject(err);
    });
  });

  return socket;
}

/** Resolves with the next payload for `event`, or rejects after `ms`. */
function nextEvent<T>(socket: Socket, event: string, ms = 3000): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Timed out waiting for ${event}`));
    }, ms);
    socket.once(event, (payload: T) => {
      clearTimeout(timer);
      resolve(payload);
    });
  });
}

describe("socket handshake", () => {
  it("refuses connections without a valid session cookie", async () => {
    const socket = ioClient(url, { transports: ["websocket"] });
    clients.push(socket);

    const err = await new Promise<Error>((resolve) => socket.on("connect_error", resolve));

    expect(err.message).toBe("UNAUTHORIZED");
  });

  it("accepts a valid NextAuth v4 cookie", async () => {
    const { owner } = await seedWorkspace();
    const socket = await connect(owner.id, owner.email);

    expect(socket.connected).toBe(true);
  });
});

describe("presence", () => {
  it("announces presence:join to everyone already in the project room", async () => {
    const { owner, project, board } = await seedWorkspace();
    const bob = await seedUser({ name: "Bob" });

    const first = await connect(owner.id, owner.email, {
      projectId: project.id,
      boardId: board.id,
    });
    const joined = nextEvent<{ userId: string }>(first, SOCKET_EVENTS.PRESENCE_JOIN);

    await connect(bob.id, bob.email, { projectId: project.id, boardId: board.id });

    await expect(joined).resolves.toMatchObject({ userId: bob.id });
  });

  it("sends presence:sync with the existing roster to the joiner", async () => {
    const { owner, project, board } = await seedWorkspace();
    const bob = await seedUser({ name: "Bob" });

    await connect(owner.id, owner.email, { projectId: project.id, boardId: board.id });
    const second = ioClient(url, {
      transports: ["websocket"],
      extraHeaders: { Cookie: await makeAuthCookie({ sub: bob.id, email: bob.email }) },
      query: { projectId: project.id, boardId: board.id },
    });
    clients.push(second);

    const sync = await nextEvent<{ users: { userId: string }[] }>(
      second,
      SOCKET_EVENTS.PRESENCE_SYNC,
    );

    expect(sync.users.map((u) => u.userId)).toEqual([owner.id]);
  });

  it("broadcasts presence:leave on disconnect", async () => {
    const { owner, project, board } = await seedWorkspace();
    const bob = await seedUser({ name: "Bob" });

    const first = await connect(owner.id, owner.email, {
      projectId: project.id,
      boardId: board.id,
    });
    const second = await connect(bob.id, bob.email, { projectId: project.id, boardId: board.id });

    const left = nextEvent<{ userId: string }>(first, SOCKET_EVENTS.PRESENCE_LEAVE);
    second.disconnect();

    await expect(left).resolves.toEqual({ userId: bob.id });
  });

  it("stays silent while the same user still has another tab open", async () => {
    const { owner, project, board } = await seedWorkspace();
    const bob = await seedUser({ name: "Bob" });

    const watcher = await connect(owner.id, owner.email, {
      projectId: project.id,
      boardId: board.id,
    });
    const tabA = await connect(bob.id, bob.email, { projectId: project.id, boardId: board.id });
    await connect(bob.id, bob.email, { projectId: project.id, boardId: board.id }); // tab B stays open

    let leaveSeen = false;
    watcher.on(SOCKET_EVENTS.PRESENCE_LEAVE, () => {
      leaveSeen = true;
    });

    tabA.disconnect();
    await new Promise((r) => setTimeout(r, 500));

    expect(leaveSeen).toBe(false);
  });
});

describe("global org presence", () => {
  it("announces online to org peers and offline on last disconnect", async () => {
    const { owner, org } = await seedWorkspace();
    const bob = await seedUser({ name: "Bob" });
    await seedMember(org.id, bob.id, "MEMBER");

    // Owner is watching; connecting bob should notify the owner.
    const watcher = await connect(owner.id, owner.email);
    const online = nextEvent<{ userId: string }>(watcher, SOCKET_EVENTS.PRESENCE_ONLINE);

    const bobSocket = await connect(bob.id, bob.email);
    await expect(online).resolves.toMatchObject({ userId: bob.id });

    const offline = nextEvent<{ userId: string }>(watcher, SOCKET_EVENTS.PRESENCE_OFFLINE);
    bobSocket.disconnect();
    await expect(offline).resolves.toEqual({ userId: bob.id });
  });

  it("stays online while a second tab remains open", async () => {
    const { owner, org } = await seedWorkspace();
    const bob = await seedUser({ name: "Bob" });
    await seedMember(org.id, bob.id, "MEMBER");

    const watcher = await connect(owner.id, owner.email);
    const tabA = await connect(bob.id, bob.email);
    await connect(bob.id, bob.email); // tab B stays open

    let offlineSeen = false;
    watcher.on(SOCKET_EVENTS.PRESENCE_OFFLINE, () => {
      offlineSeen = true;
    });

    tabA.disconnect();
    await new Promise((r) => setTimeout(r, 500));

    expect(offlineSeen).toBe(false);
  });
});
