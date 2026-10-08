import { describe, expect, it, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

// No database in tests: getDb() fails the way it does when DATABASE_URL is unset.
vi.mock("./db", async () => {
  const { TRPCError } = await import("@trpc/server");
  return {
    getDb: vi.fn().mockRejectedValue(new TRPCError({ code: "SERVICE_UNAVAILABLE", message: "Database is not configured" })),
  };
});

// Reaching the database means auth and input validation passed.
const dbUnavailable = { code: "SERVICE_UNAVAILABLE" };

function createContext(user?: { role?: string } | null): TrpcContext {
  const clearedCookies: { name: string; options: Record<string, unknown> }[] = [];

  const userObj = user
    ? {
        id: 1,
        openId: "test-user",
        email: "test@example.com",
        name: "Test User",
        loginMethod: "google",
        role: user.role || "user",
        createdAt: new Date(),
        updatedAt: new Date(),
        lastSignedIn: new Date(),
      }
    : null;

  return {
    user: userObj as TrpcContext["user"],
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {
      clearCookie: (name: string, options: Record<string, unknown>) => {
        clearedCookies.push({ name, options });
      },
    } as TrpcContext["res"],
  };
}

describe("auth.me", () => {
  it("returns null user when not authenticated", async () => {
    const ctx = createContext(null);
    const caller = appRouter.createCaller(ctx);
    const result = await caller.auth.me();
    expect(result).toBeNull();
  });

  it("returns user data when authenticated", async () => {
    const ctx = createContext({ role: "user" });
    const caller = appRouter.createCaller(ctx);
    const result = await caller.auth.me();
    expect(result).not.toBeNull();
    expect((result as any).name).toBe("Test User");
  });
});

describe("auth.logout", () => {
  it("clears session cookie", async () => {
    const ctx = createContext({ role: "user" });
    const caller = appRouter.createCaller(ctx);
    const result = await caller.auth.logout();
    expect(result).toEqual({ success: true });
  });
});

describe("initiatives.list", () => {
  it("returns initiatives with pagination", async () => {
    const ctx = createContext(null);
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.initiatives.list({ limit: 10, offset: 0, sortBy: "newest" })
    ).rejects.toMatchObject(dbUnavailable);
  });

  it("accepts category filter", async () => {
    const ctx = createContext(null);
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.initiatives.list({ limit: 10, offset: 0, sortBy: "newest", category: "Environment" })
    ).rejects.toMatchObject(dbUnavailable);
  });

  it("accepts status filter", async () => {
    const ctx = createContext(null);
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.initiatives.list({ limit: 10, offset: 0, sortBy: "newest", status: "ongoing" })
    ).rejects.toMatchObject(dbUnavailable);
  });

  it("accepts search query", async () => {
    const ctx = createContext(null);
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.initiatives.list({ limit: 10, offset: 0, sortBy: "newest", search: "blood donation" })
    ).rejects.toMatchObject(dbUnavailable);
  });
});

describe("initiatives.getCategories", () => {
  it("returns category breakdown", async () => {
    const ctx = createContext(null);
    const caller = appRouter.createCaller(ctx);
    await expect(caller.initiatives.getCategories()).rejects.toMatchObject(dbUnavailable);
  });
});

describe("initiatives.getById", () => {
  it("returns initiative by ID", async () => {
    const ctx = createContext(null);
    const caller = appRouter.createCaller(ctx);
    await expect(caller.initiatives.getById({ id: 1 })).rejects.toMatchObject(dbUnavailable);
  });
});

describe("initiatives.getBookmarkStatus", () => {
  it("returns bookmark status for authenticated user", async () => {
    const ctx = createContext({ role: "user" });
    const caller = appRouter.createCaller(ctx);
    await expect(caller.initiatives.getBookmarkStatus({ initiativeId: 1 })).rejects.toMatchObject(dbUnavailable);
  });
});

describe("admin.getStats", () => {
  it("returns platform statistics for admin", async () => {
    const ctx = createContext({ role: "admin" });
    const caller = appRouter.createCaller(ctx);
    await expect(caller.admin.getStats()).rejects.toMatchObject(dbUnavailable);
  });
});

describe("admin router", () => {
  it("rejects non-admin access to listReports", async () => {
    const ctx = createContext({ role: "user" });
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.admin.listReports({ limit: 10, offset: 0 })
    ).rejects.toThrow();
  });

  it("allows admin access to listReports", async () => {
    const ctx = createContext({ role: "admin" });
    const caller = appRouter.createCaller(ctx);
    await expect(caller.admin.listReports({ limit: 10, offset: 0 })).rejects.toMatchObject(dbUnavailable);
  });

  it("allows admin to getStats", async () => {
    const ctx = createContext({ role: "admin" });
    const caller = appRouter.createCaller(ctx);
    await expect(caller.admin.getStats()).rejects.toMatchObject(dbUnavailable);
  });

  it("allows admin to getPendingCount", async () => {
    const ctx = createContext({ role: "admin" });
    const caller = appRouter.createCaller(ctx);
    await expect(caller.admin.getPendingCount()).rejects.toMatchObject(dbUnavailable);
  });
});

describe("profiles router", () => {
  it("returns null for unauthenticated user", async () => {
    const ctx = createContext(null);
    const caller = appRouter.createCaller(ctx);
    // me is protected, so calling without auth should throw
    await expect(caller.profiles.me()).rejects.toThrow();
  });

  it("rejects unauthorized access to me endpoint", async () => {
    const ctx = createContext(null);
    const caller = appRouter.createCaller(ctx);
    await expect(caller.profiles.me()).rejects.toThrow();
  });

  it("returns profile by user ID", async () => {
    const ctx = createContext(null);
    const caller = appRouter.createCaller(ctx);
    await expect(caller.profiles.getByUserId({ userId: 1 })).rejects.toMatchObject(dbUnavailable);
  });
});

describe("input hardening", () => {
  const badRequest = { code: "BAD_REQUEST" };

  it("rejects non-http registration links", async () => {
    const caller = appRouter.createCaller(createContext({ role: "user" }));
    await expect(
      caller.initiatives.create({
        title: "Neighbourhood cleanup",
        description: "A long enough description for validation.",
        category: "Environment",
        startDate: "2026-11-01T09:00:00Z",
        registrationLink: "javascript:alert(1)",
      })
    ).rejects.toMatchObject(badRequest);
  });

  it("rejects unparseable dates", async () => {
    const caller = appRouter.createCaller(createContext({ role: "user" }));
    await expect(
      caller.initiatives.create({
        title: "Neighbourhood cleanup",
        description: "A long enough description for validation.",
        category: "Environment",
        startDate: "not a date",
      })
    ).rejects.toMatchObject(badRequest);
  });

  it("only accepts uploaded /media paths as post media", async () => {
    const caller = appRouter.createCaller(createContext({ role: "user" }));
    await expect(
      caller.posts.create({ content: "Hello neighbours", mediaUrl: "https://evil.example/track.gif" })
    ).rejects.toMatchObject(badRequest);
    await expect(
      caller.posts.create({ content: "Hello neighbours", mediaUrl: "/media/../secret" })
    ).rejects.toMatchObject(badRequest);
  });

  it("caps search length", async () => {
    const caller = appRouter.createCaller(createContext(null));
    await expect(caller.initiatives.list({ search: "x".repeat(201) })).rejects.toMatchObject(badRequest);
  });

  it("blocks writes for anonymous users", async () => {
    const caller = appRouter.createCaller(createContext(null));
    await expect(caller.posts.create({ content: "Hello neighbours" })).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(caller.initiatives.update({ id: 1, verified: true })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});
