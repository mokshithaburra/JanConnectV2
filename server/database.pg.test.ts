import { describe, expect, it } from "vitest";
import { initiatives, users, userRoleEnum } from "../drizzle/schema";
import {
  bookmarksRelations,
  commentsRelations,
  initiativesRelations,
  organizationsRelations,
  postLikesRelations,
  postsRelations,
  reportsRelations,
  userProfilesRelations,
  usersRelations,
} from "../drizzle/relations";

describe("PostgreSQL database schema", () => {
  it("uses the converted core table definitions", () => {
    expect(users).toBeDefined();
    expect(initiatives).toBeDefined();
    expect(users[Symbol.for("drizzle:Name") as keyof typeof users]).toBe("users");
    expect(initiatives[Symbol.for("drizzle:Name") as keyof typeof initiatives]).toBe("initiatives");
  });

  it("declares all expected relationship groups", () => {
    expect(usersRelations).toBeDefined();
    expect(userProfilesRelations).toBeDefined();
    expect(organizationsRelations).toBeDefined();
    expect(initiativesRelations).toBeDefined();
    expect(postsRelations).toBeDefined();
    expect(commentsRelations).toBeDefined();
    expect(postLikesRelations).toBeDefined();
    expect(bookmarksRelations).toBeDefined();
    expect(reportsRelations).toBeDefined();
  });

  it("retains the supported user roles for auth compatibility", () => {
    expect(userRoleEnum.enumValues).toEqual(["user", "admin", "moderator"]);
  });
});
