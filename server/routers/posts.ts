import { z } from "zod";
import { eq, and, desc, sql, type AnyColumn } from "drizzle-orm";
import { router, publicProcedure, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { id, mediaPath, offset } from "./inputs";
import { posts, comments, postLikes, reports, users, initiatives, userProfiles } from "../../drizzle/schema";

// Content the viewer has a pending report on is hidden from them (signed-out visitors see everything).
function notReportedBy(userId: number | undefined, type: "post" | "comment", itemId: AnyColumn) {
  if (userId === undefined) return undefined;
  return sql`not exists (
    select 1 from ${reports}
    where ${reports.reportableType} = ${type}
      and ${reports.reportableId} = ${itemId}
      and ${reports.reporterId} = ${userId}
      and ${reports.status} = 'pending'
  )`;
}

export const postsRouter = router({
  list: publicProcedure
    .input(z.object({
      limit: z.number().min(1).max(50).default(20),
      offset,
    }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      const visible = notReportedBy(ctx.user?.id, "post", posts.id);

      const rows = await db.select({
        id: posts.id,
        content: posts.content,
        mediaUrl: posts.mediaUrl,
        initiativeId: posts.initiativeId,
        likeCount: posts.likeCount,
        commentCount: posts.commentCount,
        createdAt: posts.createdAt,
        userId: posts.userId,
        userName: users.name,
      })
        .from(posts)
        .leftJoin(users, eq(posts.userId, users.id))
        .where(visible)
        .orderBy(desc(posts.createdAt))
        .limit(input.limit)
        .offset(input.offset);

      const [countResult] = await db.select({ count: sql<number>`count(*)` }).from(posts).where(visible);

      return { posts: rows, total: Number(countResult?.count ?? 0) };
    }),

  listByInitiative: publicProcedure
    .input(z.object({
      initiativeId: id,
      limit: z.number().min(1).max(50).default(20),
    }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();

      const rows = await db.select({
        id: posts.id,
        content: posts.content,
        mediaUrl: posts.mediaUrl,
        initiativeId: posts.initiativeId,
        initiativeTitle: initiatives.title,
        likeCount: posts.likeCount,
        commentCount: posts.commentCount,
        createdAt: posts.createdAt,
        userId: posts.userId,
        userName: users.name,
      })
        .from(posts)
        .leftJoin(users, eq(posts.userId, users.id))
        .leftJoin(initiatives, eq(posts.initiativeId, initiatives.id))
        .where(and(eq(posts.initiativeId, input.initiativeId), notReportedBy(ctx.user?.id, "post", posts.id)))
        .orderBy(desc(posts.createdAt))
        .limit(input.limit);

      return { posts: rows, total: rows.length };
    }),

  create: protectedProcedure
    .input(z.object({
      content: z.string().min(5).max(5000),
      mediaUrl: mediaPath.optional(),
      initiativeId: id.optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();

      await db.insert(posts).values({
        userId: ctx.user.id,
        content: input.content,
        mediaUrl: input.mediaUrl || null,
        initiativeId: input.initiativeId || null,
      });

      try {
        await db.update(userProfiles)
          .set({ contributionScore: sql`${userProfiles.contributionScore} + 5` })
          .where(eq(userProfiles.userId, ctx.user.id));
      } catch {
        // Ignore if profile doesn't exist yet.
      }

      return { success: true };
    }),

  getComments: publicProcedure
    .input(z.object({ postId: id }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();

      const rows = await db.select({
        id: comments.id,
        content: comments.content,
        createdAt: comments.createdAt,
        userId: comments.userId,
        userName: users.name,
      })
        .from(comments)
        .leftJoin(users, eq(comments.userId, users.id))
        .where(and(eq(comments.postId, input.postId), notReportedBy(ctx.user?.id, "comment", comments.id)))
        .orderBy(desc(comments.createdAt));

      return rows;
    }),

  addComment: protectedProcedure
    .input(z.object({
      postId: id,
      content: z.string().min(1).max(1000),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();

      await db.insert(comments).values({
        postId: input.postId,
        userId: ctx.user.id,
        content: input.content,
      });

      await db.update(posts)
        .set({ commentCount: sql`${posts.commentCount} + 1` })
        .where(eq(posts.id, input.postId));

      return { success: true };
    }),

  toggleLike: protectedProcedure
    .input(z.object({ postId: id }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();

      const existing = await db.select()
        .from(postLikes)
        .where(and(
          eq(postLikes.postId, input.postId),
          eq(postLikes.userId, ctx.user.id),
        ))
        .limit(1);

      if (existing.length > 0) {
        await db.delete(postLikes).where(and(
          eq(postLikes.postId, input.postId),
          eq(postLikes.userId, ctx.user.id),
        ));
        await db.update(posts)
          .set({ likeCount: sql`${posts.likeCount} - 1` })
          .where(eq(posts.id, input.postId));
        return { liked: false };
      } else {
        await db.insert(postLikes).values({
          postId: input.postId,
          userId: ctx.user.id,
        });
        await db.update(posts)
          .set({ likeCount: sql`${posts.likeCount} + 1` })
          .where(eq(posts.id, input.postId));
        return { liked: true };
      }
    }),

  getLikeStatus: protectedProcedure
    .input(z.object({ postId: id }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();

      const existing = await db.select()
        .from(postLikes)
        .where(and(
          eq(postLikes.postId, input.postId),
          eq(postLikes.userId, ctx.user.id),
        ))
        .limit(1);

      return { liked: existing.length > 0 };
    }),

  reportContent: protectedProcedure
    .input(z.object({
      reportableType: z.enum(["post", "comment", "initiative"]),
      reportableId: id,
      reason: z.string().min(10).max(500),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();

      await db.insert(reports).values({
        reportableType: input.reportableType,
        reportableId: input.reportableId,
        reason: input.reason,
        reporterId: ctx.user.id,
      });

      return { success: true };
    }),
});
