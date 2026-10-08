import { beforeEach, describe, expect, it, vi } from "vitest";
import { getTableName } from "drizzle-orm";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

// A tiny stand-in for Drizzle: selects return queued rows, writes are recorded.
const db = vi.hoisted(() => {
  const state = { selects: [] as unknown[][], writes: [] as string[] };
  const nextRows = () => Promise.resolve(state.selects.shift() ?? []);
  const selectChain = () => {
    const chain: any = {
      from: () => chain,
      where: () => chain,
      for: () => nextRows(),
      limit: () => nextRows(),
      then: (resolve: any, reject: any) => nextRows().then(resolve, reject),
    };
    return chain;
  };
  const name = (table: any) => table[Symbol.for("drizzle:Name")] as string;
  const handle: any = {
    select: () => selectChain(),
    delete: (table: any) => ({ where: () => { state.writes.push(`delete ${name(table)}`); return Promise.resolve(); } }),
    update: (table: any) => ({ set: () => ({ where: () => { state.writes.push(`update ${name(table)}`); return Promise.resolve(); } }) }),
    transaction: (fn: (tx: any) => Promise<unknown>) => fn(handle),
  };
  return { state, handle };
});

vi.mock("./db", () => ({ getDb: vi.fn(async () => db.handle) }));
vi.mock("./storage", () => ({ storageDelete: vi.fn(async () => {}) }));

type Role = "user" | "moderator" | "admin";
function callerAs(role: Role, id: number) {
  const user = {
    id, openId: `user-${id}`, email: null, name: `User ${id}`, loginMethod: "google", role,
    createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date(),
  };
  return appRouter.createCaller({
    user: user as TrpcContext["user"],
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: () => {} } as unknown as TrpcContext["res"],
  });
}

beforeEach(() => {
  db.state.selects = [];
  db.state.writes = [];
});

// Sanity check that the fake reports real table names.
it("uses schema table names", async () => {
  const { posts } = await import("../drizzle/schema");
  expect(getTableName(posts)).toBe("posts");
});

describe("deleting your own post", () => {
  it("lets the author delete it, with its reports, then the post", async () => {
    db.state.selects = [[{ id: 10, userId: 5, mediaUrl: null }], [{ id: 1 }, { id: 2 }]];
    await expect(callerAs("user", 5).posts.delete({ id: 10 })).resolves.toEqual({ success: true });
    expect(db.state.writes).toEqual(["delete reports", "delete posts"]);
  });

  it("refuses anyone else, without deleting anything", async () => {
    db.state.selects = [[{ id: 10, userId: 5, mediaUrl: null }]];
    await expect(callerAs("user", 6).posts.delete({ id: 10 })).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(db.state.writes).toEqual([]);
  });

  it("refuses moderators and admins on someone else's post too (they use admin.deletePost)", async () => {
    db.state.selects = [[{ id: 10, userId: 5, mediaUrl: null }]];
    await expect(callerAs("admin", 1).posts.delete({ id: 10 })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("returns NOT_FOUND for a missing post", async () => {
    await expect(callerAs("user", 5).posts.delete({ id: 999 })).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});

describe("deleting your own comment", () => {
  it("lets the author delete it and decrements the post's comment count", async () => {
    db.state.selects = [[{ id: 3, postId: 10, userId: 5 }]];
    await expect(callerAs("user", 5).posts.deleteComment({ id: 3 })).resolves.toEqual({ success: true });
    expect(db.state.writes).toEqual(["delete reports", "delete comments", "update posts"]);
  });

  it("refuses anyone else, without deleting anything", async () => {
    db.state.selects = [[{ id: 3, postId: 10, userId: 5 }]];
    await expect(callerAs("user", 6).posts.deleteComment({ id: 3 })).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(db.state.writes).toEqual([]);
  });
});

describe("moderator path is unchanged", () => {
  it("moderators delete any post through admin.deletePost", async () => {
    db.state.selects = [[{ id: 10, userId: 5, mediaUrl: null }], []];
    await expect(callerAs("moderator", 2).admin.deletePost({ id: 10 })).resolves.toEqual({ success: true });
    expect(db.state.writes).toEqual(["delete reports", "delete posts"]);
  });

  it("moderators delete any comment through admin.deleteComment", async () => {
    db.state.selects = [[{ id: 3, postId: 10, userId: 5 }]];
    await expect(callerAs("moderator", 2).admin.deleteComment({ id: 3 })).resolves.toEqual({ success: true });
    expect(db.state.writes).toEqual(["delete reports", "delete comments", "update posts"]);
  });

  it("regular users still can't use the moderator procedures", async () => {
    await expect(callerAs("user", 5).admin.deletePost({ id: 10 })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});

describe("uploaded images", () => {
  it("deletes the post's image when no other post uses it", async () => {
    const { storageDelete } = await import("./storage");
    db.state.selects = [[{ id: 10, userId: 5, mediaUrl: "/media/community-posts/abc.webp" }], [], []];
    await callerAs("user", 5).posts.delete({ id: 10 });
    expect(storageDelete).toHaveBeenCalledWith("community-posts/abc.webp");
  });
});
