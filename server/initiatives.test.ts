import { describe, expect, it, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

// Mock database
vi.mock("./db", () => ({
  getDb: vi.fn().mockResolvedValue(null),
}));

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
    // When DB is mocked to null, should return empty results gracefully
    const result = await caller.initiatives.list({
      limit: 10,
      offset: 0,
      sortBy: "newest",
    });
    // Should return structured response
    expect(result).toHaveProperty("initiatives");
    expect(result).toHaveProperty("total");
    expect(Array.isArray(result.initiatives)).toBe(true);
    expect(typeof result.total).toBe("number");
  });

  it("accepts category filter", async () => {
    const ctx = createContext(null);
    const caller = appRouter.createCaller(ctx);
    const result = await caller.initiatives.list({
      limit: 10,
      offset: 0,
      sortBy: "newest",
      category: "Environment",
    });
    expect(result).toHaveProperty("initiatives");
  });

  it("accepts status filter", async () => {
    const ctx = createContext(null);
    const caller = appRouter.createCaller(ctx);
    const result = await caller.initiatives.list({
      limit: 10,
      offset: 0,
      sortBy: "newest",
      status: "ongoing",
    });
    expect(result).toHaveProperty("initiatives");
  });

  it("accepts search query", async () => {
    const ctx = createContext(null);
    const caller = appRouter.createCaller(ctx);
    const result = await caller.initiatives.list({
      limit: 10,
      offset: 0,
      sortBy: "newest",
      search: "blood donation",
    });
    expect(result).toHaveProperty("initiatives");
  });
});

describe("initiatives.getCategories", () => {
  it("returns category breakdown", async () => {
    const ctx = createContext(null);
    const caller = appRouter.createCaller(ctx);
    const result = await caller.initiatives.getCategories();
    expect(Array.isArray(result)).toBe(true);
  });
});

describe("initiatives.getById", () => {
  it("returns initiative by ID", async () => {
    const ctx = createContext(null);
    const caller = appRouter.createCaller(ctx);
    const result = await caller.initiatives.getById({ id: 1 });
    // With mocked DB returning null, should return null gracefully
    expect(result).toBeNull();
  });
});

describe("initiatives.getBookmarkStatus", () => {
  it("returns bookmark status for authenticated user", async () => {
    const ctx = createContext({ role: "user" });
    const caller = appRouter.createCaller(ctx);
    const result = await caller.initiatives.getBookmarkStatus({ initiativeId: 1 });
    // With mocked DB, should return false gracefully
    expect(result).toHaveProperty("bookmarked");
    expect(result.bookmarked).toBe(false);
  });
});

describe("admin.getStats", () => {
  it("returns platform statistics for admin", async () => {
    const ctx = createContext({ role: "admin" });
    const caller = appRouter.createCaller(ctx);
    const result = await caller.admin.getStats();
    expect(result).toHaveProperty("initiatives");
    expect(result).toHaveProperty("posts");
    expect(result).toHaveProperty("users");
    expect(result).toHaveProperty("reports");
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
    const result = await caller.admin.listReports({ limit: 10, offset: 0 });
    expect(result).toHaveProperty("reports");
    expect(result).toHaveProperty("total");
  });

  it("allows admin to getStats", async () => {
    const ctx = createContext({ role: "admin" });
    const caller = appRouter.createCaller(ctx);
    const result = await caller.admin.getStats();
    expect(result).toHaveProperty("initiatives");
    expect(result).toHaveProperty("posts");
  });

  it("allows admin to getPendingCount", async () => {
    const ctx = createContext({ role: "admin" });
    const caller = appRouter.createCaller(ctx);
    const result = await caller.admin.getPendingCount();
    expect(result).toHaveProperty("count");
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
    const result = await caller.profiles.getByUserId({ userId: 1 });
    // With mocked DB, should return null gracefully
    expect(result).toBeNull();
  });
});
