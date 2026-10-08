import { describe, expect, it, vi } from "vitest";
import { appRouter } from "./routers";
import { checkRoleChange } from "./routers/admin";
import type { TrpcContext } from "./_core/context";

// No database in tests: getDb() fails the way it does when DATABASE_URL is unset.
vi.mock("./db", async () => {
  const { TRPCError } = await import("@trpc/server");
  return {
    getDb: vi.fn().mockRejectedValue(new TRPCError({ code: "SERVICE_UNAVAILABLE", message: "Database is not configured" })),
  };
});

// Reaching the database means the role guard let the call through.
const allowed = { code: "SERVICE_UNAVAILABLE" };
const forbidden = { code: "FORBIDDEN" };

type Role = "user" | "moderator" | "admin";

function callerAs(role: Role | null, id = 1) {
  const user = role
    ? {
        id,
        openId: `user-${id}`,
        email: `user${id}@example.com`,
        name: `User ${id}`,
        loginMethod: "google",
        role,
        createdAt: new Date(),
        updatedAt: new Date(),
        lastSignedIn: new Date(),
      }
    : null;
  return appRouter.createCaller({
    user: user as TrpcContext["user"],
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: () => {} } as unknown as TrpcContext["res"],
  });
}

describe("checkRoleChange", () => {
  const admin = { id: 2, role: "admin" as const, openId: "admin-2" };

  it("blocks an admin from demoting themselves", () => {
    const error = checkRoleChange({ actorId: 2, target: admin, newRole: "moderator", adminCount: 5, ownerOpenId: "" });
    expect(error?.code).toBe("FORBIDDEN");
  });

  it("blocks demoting the last remaining admin", () => {
    const error = checkRoleChange({ actorId: 1, target: admin, newRole: "user", adminCount: 1, ownerOpenId: "" });
    expect(error?.code).toBe("PRECONDITION_FAILED");
  });

  it("blocks demoting the configured owner, who would be re-promoted on login", () => {
    const error = checkRoleChange({ actorId: 1, target: admin, newRole: "user", adminCount: 3, ownerOpenId: "admin-2" });
    expect(error?.code).toBe("PRECONDITION_FAILED");
  });

  it("allows demoting an admin while another admin remains", () => {
    expect(checkRoleChange({ actorId: 1, target: admin, newRole: "moderator", adminCount: 2, ownerOpenId: "" })).toBeNull();
  });

  it("allows promotions and changes between non-admin roles", () => {
    const member = { id: 3, role: "user" as const, openId: "user-3" };
    expect(checkRoleChange({ actorId: 1, target: member, newRole: "admin", adminCount: 1, ownerOpenId: "" })).toBeNull();
    expect(checkRoleChange({ actorId: 1, target: member, newRole: "moderator", adminCount: 1, ownerOpenId: "" })).toBeNull();
    expect(checkRoleChange({ actorId: 1, target: { ...member, role: "moderator" }, newRole: "user", adminCount: 1, ownerOpenId: "" })).toBeNull();
  });

  it("lets an admin keep their own admin role", () => {
    expect(checkRoleChange({ actorId: 2, target: admin, newRole: "admin", adminCount: 1, ownerOpenId: "" })).toBeNull();
  });
});

describe("admin.setUserRole", () => {
  it("rejects self-demotion before touching the database", async () => {
    await expect(callerAs("admin", 7).admin.setUserRole({ userId: 7, role: "user" })).rejects.toMatchObject(forbidden);
  });

  it("is admin-only", async () => {
    await expect(callerAs("moderator").admin.setUserRole({ userId: 9, role: "admin" })).rejects.toMatchObject(forbidden);
    await expect(callerAs("user").admin.setUserRole({ userId: 9, role: "admin" })).rejects.toMatchObject(forbidden);
    await expect(callerAs("admin").admin.setUserRole({ userId: 9, role: "moderator" })).rejects.toMatchObject(allowed);
  });

  it("rejects unknown roles", async () => {
    await expect(callerAs("admin").admin.setUserRole({ userId: 9, role: "owner" as any })).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
});

describe("moderator access", () => {
  const moderator = () => callerAs("moderator");

  it("can work the report queue and community content", async () => {
    await expect(moderator().admin.listReports({ status: "pending" })).rejects.toMatchObject(allowed);
    await expect(moderator().admin.resolveReport({ reportId: 1, status: "resolved" })).rejects.toMatchObject(allowed);
    await expect(moderator().admin.getStats()).rejects.toMatchObject(allowed);
    await expect(moderator().admin.getRecentActivity()).rejects.toMatchObject(allowed);
    await expect(moderator().admin.listPosts({})).rejects.toMatchObject(allowed);
    await expect(moderator().admin.listComments({})).rejects.toMatchObject(allowed);
    await expect(moderator().admin.deletePost({ id: 1 })).rejects.toMatchObject(allowed);
    await expect(moderator().admin.deleteComment({ id: 1 })).rejects.toMatchObject(allowed);
  });

  it("cannot manage users, initiatives or organizations", async () => {
    await expect(moderator().admin.listUsers({})).rejects.toMatchObject(forbidden);
    await expect(moderator().admin.deleteInitiative({ id: 1 })).rejects.toMatchObject(forbidden);
    await expect(moderator().initiatives.update({ id: 1, verified: true })).rejects.toMatchObject(forbidden);
    await expect(moderator().organizations.update({ id: 1, verified: true })).rejects.toMatchObject(forbidden);
  });
});

describe("admin access", () => {
  it("can call every console procedure", async () => {
    const admin = callerAs("admin");
    await expect(admin.admin.listUsers({ search: "50%_off" })).rejects.toMatchObject(allowed);
    await expect(admin.admin.deleteInitiative({ id: 1 })).rejects.toMatchObject(allowed);
    await expect(admin.admin.deletePost({ id: 1 })).rejects.toMatchObject(allowed);
    await expect(admin.admin.listReports({})).rejects.toMatchObject(allowed);
  });
});

describe("regular users and visitors", () => {
  it("are kept out of moderation procedures", async () => {
    await expect(callerAs("user").admin.listReports({})).rejects.toMatchObject(forbidden);
    await expect(callerAs("user").admin.deletePost({ id: 1 })).rejects.toMatchObject(forbidden);
    await expect(callerAs("user").admin.deleteComment({ id: 1 })).rejects.toMatchObject(forbidden);
    await expect(callerAs(null).admin.getRecentActivity()).rejects.toMatchObject(forbidden);
  });
});

describe("input limits", () => {
  it("caps search length and page size", async () => {
    const admin = callerAs("admin");
    await expect(admin.admin.listUsers({ search: "x".repeat(201) })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(admin.admin.listPosts({ limit: 500 })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(admin.admin.deleteComment({ id: -1 })).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
});
