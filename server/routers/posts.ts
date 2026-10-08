import { z } from "zod";
import { eq, and, desc, sql } from "drizzle-orm";
import { router, publicProcedure, protectedProcedure, adminProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { id, mediaPath, offset } from "./inputs";
import { posts, comments, postLikes, reports, users, initiatives, userProfiles } from "../../drizzle/schema";

export const postsRouter = router({
  // List posts
  list: publicProcedure
    .input(z.object({
      limit: z.number().min(1).max(50).default(20),
      offset,
    }))
    .query(async ({ input }) => {
      const db = await getDb();

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
        .orderBy(desc(posts.createdAt))
        .limit(input.limit)
        .offset(input.offset);

      return { posts: rows, total: rows.length };
    }),

  // List posts for a specific initiative so detail pages can preserve context
  listByInitiative: publicProcedure
    .input(z.object({
      initiativeId: id,
      limit: z.number().min(1).max(50).default(20),
    }))
    .query(async ({ input }) => {
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
        .where(eq(posts.initiativeId, input.initiativeId))
        .orderBy(desc(posts.createdAt))
        .limit(input.limit);

      return { posts: rows, total: rows.length };
    }),

  // Create post
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

      // Update contribution score through the PostgreSQL Drizzle schema.
      try {
        await db.update(userProfiles)
          .set({ contributionScore: sql`${userProfiles.contributionScore} + 5` })
          .where(eq(userProfiles.userId, ctx.user.id));
      } catch {
        // Ignore if profile doesn't exist yet.
      }

      return { success: true };
    }),

  // Get comments for a post
  getComments: publicProcedure
    .input(z.object({ postId: id }))
    .query(async ({ input }) => {
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
        .where(eq(comments.postId, input.postId))
        .orderBy(desc(comments.createdAt));

      return rows;
    }),

  // Add comment
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

  // Toggle like
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

  // Check like status
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

  // Report content
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
