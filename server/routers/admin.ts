import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { and, desc, eq, inArray, or, sql } from "drizzle-orm";
import { router, adminProcedure, moderatorProcedure } from "../_core/trpc";
import { ENV } from "../_core/env";
import { getDb } from "../db";
import { storageDelete } from "../storage";
import { escapeLike, id, offset } from "./inputs";
import { comments, initiatives, organizations, posts, reports, users } from "../../drizzle/schema";

const ROLES = ["user", "moderator", "admin"] as const;
type Role = (typeof ROLES)[number];

const pageLimit = z.number().int().min(1).max(100).default(20);
const searchText = z.string().trim().max(200).optional();

const count = sql<number>`count(*)`;

// Pure so the role rules can be unit-tested without a database.
export function checkRoleChange(change: {
  actorId: number;
  target: { id: number; role: Role; openId: string };
  newRole: Role;
  adminCount: number;
  ownerOpenId: string;
}): TRPCError | null {
  const { actorId, target, newRole, adminCount, ownerOpenId } = change;
  if (newRole === "admin" || target.role !== "admin") return null;

  if (target.id === actorId) {
    return new TRPCError({ code: "FORBIDDEN", message: "You can't remove your own admin role." });
  }
  if (adminCount <= 1) {
    return new TRPCError({ code: "PRECONDITION_FAILED", message: "At least one admin must remain." });
  }
  // upsertUser re-promotes OWNER_OPEN_ID on every login, so a demotion would silently revert.
  if (ownerOpenId && target.openId === ownerOpenId) {
    return new TRPCError({
      code: "PRECONDITION_FAILED",
      message: "This account is the configured owner (OWNER_OPEN_ID) and becomes admin again on login.",
    });
  }
  return null;
}

// Removes a post's uploaded image unless another post still points at it.
async function deleteOrphanedMedia(mediaUrl: string | null) {
  if (!mediaUrl?.startsWith("/media/community-posts/")) return;
  try {
    const db = await getDb();
    const [stillUsed] = await db.select({ id: posts.id }).from(posts).where(eq(posts.mediaUrl, mediaUrl)).limit(1);
    if (!stillUsed) await storageDelete(mediaUrl.slice("/media/".length));
  } catch (error) {
    console.error("[Admin] Failed to delete post media:", error);
  }
}

export const adminRouter = router({
  listReports: moderatorProcedure
    .input(z.object({
      status: z.enum(["pending", "reviewed", "resolved", "dismissed"]).optional(),
      limit: z.number().min(1).max(100).default(20),
      offset,
    }))
    .query(async ({ input }) => {
      const db = await getDb();

      const conditions = [];
      if (input.status) conditions.push(eq(reports.status, input.status));

      const rows = await db.select({
        id: reports.id,
        reportableType: reports.reportableType,
        reportableId: reports.reportableId,
        reason: reports.reason,
        status: reports.status,
        reporterId: reports.reporterId,
        reporterName: users.name,
        createdAt: reports.createdAt,
        // Null when the reported item no longer exists.
        contentPreview: sql<string | null>`left(coalesce(${posts.content}, ${comments.content}, ${initiatives.title}), 200)`,
      })
        .from(reports)
        .leftJoin(users, eq(reports.reporterId, users.id))
        .leftJoin(posts, and(eq(reports.reportableType, "post"), eq(posts.id, reports.reportableId)))
        .leftJoin(comments, and(eq(reports.reportableType, "comment"), eq(comments.id, reports.reportableId)))
        .leftJoin(initiatives, and(eq(reports.reportableType, "initiative"), eq(initiatives.id, reports.reportableId)))
        .where(conditions.length > 0 ? conditions[0] : undefined)
        .orderBy(desc(reports.createdAt))
        .limit(input.limit)
        .offset(input.offset);

      const [countResult] = await db.select({ count: sql<number>`count(*)` })
        .from(reports)
        .where(conditions.length > 0 ? conditions[0] : undefined);

      return { reports: rows, total: Number(countResult?.count ?? 0) };
    }),

  resolveReport: moderatorProcedure
    .input(z.object({
      reportId: id,
      status: z.enum(["reviewed", "resolved", "dismissed"]),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();

      await db.update(reports).set({
        status: input.status,
        resolvedBy: ctx.user.id,
        updatedAt: new Date(),
      }).where(eq(reports.id, input.reportId));

      return { success: true };
    }),

  getPendingCount: moderatorProcedure.query(async () => {
    const db = await getDb();

    const [result] = await db.select({ count: sql<number>`count(*)` })
      .from(reports)
      .where(eq(reports.status, "pending"));

    return { count: Number(result?.count ?? 0) };
  }),

  getStats: moderatorProcedure.query(async () => {
    const db = await getDb();

    const [[initCount], [postCount], [userCount], [reportCount], [commentCount], [orgCount]] = await Promise.all([
      db.select({ count }).from(initiatives),
      db.select({ count }).from(posts),
      db.select({ count }).from(users),
      db.select({ count }).from(reports),
      db.select({ count }).from(comments),
      db.select({ count }).from(organizations),
    ]);

    return {
      initiatives: Number(initCount?.count ?? 0),
      posts: Number(postCount?.count ?? 0),
      users: Number(userCount?.count ?? 0),
      reports: Number(reportCount?.count ?? 0),
      comments: Number(commentCount?.count ?? 0),
      organizations: Number(orgCount?.count ?? 0),
    };
  }),

  getRecentActivity: moderatorProcedure.query(async () => {
    const db = await getDb();

    const [recentPosts, recentComments, recentUsers, recentInitiatives] = await Promise.all([
      db.select({ id: posts.id, content: posts.content, userName: users.name, createdAt: posts.createdAt })
        .from(posts)
        .leftJoin(users, eq(posts.userId, users.id))
        .orderBy(desc(posts.createdAt))
        .limit(5),
      db.select({ id: comments.id, postId: comments.postId, content: comments.content, userName: users.name, createdAt: comments.createdAt })
        .from(comments)
        .leftJoin(users, eq(comments.userId, users.id))
        .orderBy(desc(comments.createdAt))
        .limit(5),
      db.select({ id: users.id, name: users.name, role: users.role, createdAt: users.createdAt })
        .from(users)
        .orderBy(desc(users.createdAt))
        .limit(5),
      db.select({ id: initiatives.id, title: initiatives.title, verified: initiatives.verified, createdAt: initiatives.createdAt })
        .from(initiatives)
        .orderBy(desc(initiatives.createdAt))
        .limit(5),
    ]);

    return { posts: recentPosts, comments: recentComments, users: recentUsers, initiatives: recentInitiatives };
  }),

  listUsers: adminProcedure
    .input(z.object({
      search: searchText,
      role: z.enum(ROLES).optional(),
      limit: pageLimit,
      offset,
    }))
    .query(async ({ input }) => {
      const db = await getDb();

      const conditions = [];
      if (input.role) conditions.push(eq(users.role, input.role));
      if (input.search) {
        const pattern = `%${escapeLike(input.search)}%`;
        conditions.push(or(sql`${users.name} ILIKE ${pattern}`, sql`${users.email} ILIKE ${pattern}`)!);
      }
      const where = conditions.length > 0 ? and(...conditions) : undefined;

      const [rows, [countResult]] = await Promise.all([
        db.select({
          id: users.id,
          name: users.name,
          email: users.email,
          role: users.role,
          loginMethod: users.loginMethod,
          createdAt: users.createdAt,
          lastSignedIn: users.lastSignedIn,
        })
          .from(users)
          .where(where)
          .orderBy(desc(users.createdAt))
          .limit(input.limit)
          .offset(input.offset),
        db.select({ count }).from(users).where(where),
      ]);

      return { users: rows, total: Number(countResult?.count ?? 0) };
    }),

  setUserRole: adminProcedure
    .input(z.object({ userId: id, role: z.enum(ROLES) }))
    .mutation(async ({ ctx, input }) => {
      // Self-demotion is decidable without the database.
      if (input.userId === ctx.user.id) {
        const error = checkRoleChange({
          actorId: ctx.user.id,
          target: ctx.user,
          newRole: input.role,
          adminCount: Number.POSITIVE_INFINITY,
          ownerOpenId: "",
        });
        if (error) throw error;
      }

      const db = await getDb();
      await db.transaction(async tx => {
        // Lock admin rows first (in id order) so two concurrent demotions can't
        // both see "another admin remains".
        const admins = await tx.select({ id: users.id }).from(users)
          .where(eq(users.role, "admin"))
          .orderBy(users.id)
          .for("update");
        const [target] = await tx.select({ id: users.id, role: users.role, openId: users.openId })
          .from(users)
          .where(eq(users.id, input.userId))
          .for("update");
        if (!target) throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });

        const error = checkRoleChange({
          actorId: ctx.user.id,
          target,
          newRole: input.role,
          adminCount: admins.length,
          ownerOpenId: ENV.ownerOpenId,
        });
        if (error) throw error;

        if (target.role !== input.role) {
          await tx.update(users).set({ role: input.role, updatedAt: new Date() }).where(eq(users.id, target.id));
        }
      });

      return { success: true };
    }),

  deleteInitiative: adminProcedure
    .input(z.object({ id }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      await db.transaction(async tx => {
        // Bookmarks cascade with the initiative and linked posts keep existing
        // (initiativeId is set to null by the FK); reports have no FK, so remove them here.
        await tx.delete(reports).where(and(eq(reports.reportableType, "initiative"), eq(reports.reportableId, input.id)));
        const [deleted] = await tx.delete(initiatives).where(eq(initiatives.id, input.id)).returning({ id: initiatives.id });
        if (!deleted) throw new TRPCError({ code: "NOT_FOUND", message: "Initiative not found" });
      });
      return { success: true };
    }),

  listPosts: moderatorProcedure
    .input(z.object({ search: searchText, limit: pageLimit, offset }))
    .query(async ({ input }) => {
      const db = await getDb();
      const where = input.search ? sql`${posts.content} ILIKE ${`%${escapeLike(input.search)}%`}` : undefined;

      const [rows, [countResult]] = await Promise.all([
        db.select({
          id: posts.id,
          content: posts.content,
          mediaUrl: posts.mediaUrl,
          likeCount: posts.likeCount,
          commentCount: posts.commentCount,
          createdAt: posts.createdAt,
          userId: posts.userId,
          userName: users.name,
          initiativeId: posts.initiativeId,
          initiativeTitle: initiatives.title,
        })
          .from(posts)
          .leftJoin(users, eq(posts.userId, users.id))
          .leftJoin(initiatives, eq(posts.initiativeId, initiatives.id))
          .where(where)
          .orderBy(desc(posts.createdAt))
          .limit(input.limit)
          .offset(input.offset),
        db.select({ count }).from(posts).where(where),
      ]);

      return { posts: rows, total: Number(countResult?.count ?? 0) };
    }),

  listComments: moderatorProcedure
    .input(z.object({ search: searchText, postId: id.optional(), limit: pageLimit, offset }))
    .query(async ({ input }) => {
      const db = await getDb();

      const conditions = [];
      if (input.postId) conditions.push(eq(comments.postId, input.postId));
      if (input.search) conditions.push(sql`${comments.content} ILIKE ${`%${escapeLike(input.search)}%`}`);
      const where = conditions.length > 0 ? and(...conditions) : undefined;

      const [rows, [countResult]] = await Promise.all([
        db.select({
          id: comments.id,
          postId: comments.postId,
          content: comments.content,
          createdAt: comments.createdAt,
          userId: comments.userId,
          userName: users.name,
        })
          .from(comments)
          .leftJoin(users, eq(comments.userId, users.id))
          .where(where)
          .orderBy(desc(comments.createdAt))
          .limit(input.limit)
          .offset(input.offset),
        db.select({ count }).from(comments).where(where),
      ]);

      return { comments: rows, total: Number(countResult?.count ?? 0) };
    }),

  deletePost: moderatorProcedure
    .input(z.object({ id }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      const deleted = await db.transaction(async tx => {
        // Locking the post blocks new comments/likes (their FKs need a key-share lock) until we're done.
        const [post] = await tx.select({ id: posts.id, mediaUrl: posts.mediaUrl }).from(posts)
          .where(eq(posts.id, input.id))
          .for("update");
        if (!post) throw new TRPCError({ code: "NOT_FOUND", message: "Post not found" });

        const commentIds = (await tx.select({ id: comments.id }).from(comments).where(eq(comments.postId, post.id))).map(row => row.id);
        await tx.delete(reports).where(or(
          and(eq(reports.reportableType, "post"), eq(reports.reportableId, post.id)),
          commentIds.length > 0 ? and(eq(reports.reportableType, "comment"), inArray(reports.reportableId, commentIds)) : undefined,
        ));
        // Comments and likes are removed by ON DELETE CASCADE.
        await tx.delete(posts).where(eq(posts.id, post.id));
        return post;
      });

      await deleteOrphanedMedia(deleted.mediaUrl);
      return { success: true };
    }),

  deleteComment: moderatorProcedure
    .input(z.object({ id }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      await db.transaction(async tx => {
        const [deleted] = await tx.delete(comments).where(eq(comments.id, input.id)).returning({ postId: comments.postId });
        if (!deleted) throw new TRPCError({ code: "NOT_FOUND", message: "Comment not found" });

        await tx.delete(reports).where(and(eq(reports.reportableType, "comment"), eq(reports.reportableId, input.id)));
        await tx.update(posts)
          .set({ commentCount: sql`greatest(${posts.commentCount} - 1, 0)` })
          .where(eq(posts.id, deleted.postId));
      });
      return { success: true };
    }),
});
