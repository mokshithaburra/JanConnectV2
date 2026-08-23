import { z } from "zod";
import { eq, desc, sql } from "drizzle-orm";
import { router, publicProcedure, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { userProfiles, users, initiatives, bookmarks, posts } from "../../drizzle/schema";

export const profilesRouter = router({
  // Get user profile
  getByUserId: publicProcedure
    .input(z.object({ userId: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return null;

      const userRows = await db.select({
        id: users.id,
        name: users.name,
        email: users.email,
        createdAt: users.createdAt,
      })
        .from(users)
        .where(eq(users.id, input.userId))
        .limit(1);

      if (!userRows[0]) return null;

      const profileRows = await db.select({
        bio: userProfiles.bio,
        location: userProfiles.location,
        avatarUrl: userProfiles.avatarUrl,
        contributionScore: userProfiles.contributionScore,
      })
        .from(userProfiles)
        .where(eq(userProfiles.userId, input.userId))
        .limit(1);

      const profile = profileRows[0] || {
        bio: null,
        location: null,
        avatarUrl: null,
        contributionScore: 0,
      };

      return { ...userRows[0], ...profile };
    }),

  // Get current user's profile
  me: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) return null;

    const profileRows = await db.select({
      id: userProfiles.id,
      bio: userProfiles.bio,
      location: userProfiles.location,
      avatarUrl: userProfiles.avatarUrl,
      contributionScore: userProfiles.contributionScore,
    })
      .from(userProfiles)
      .where(eq(userProfiles.userId, ctx.user.id))
      .limit(1);

    const profile = profileRows[0] || null;

    return {
      user: ctx.user,
      profile,
    };
  }),

  // Activity counts for the profile gamification surface
  getStats: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) return { postCount: 0, initiativeCount: 0 };

    const [postResult, initiativeResult] = await Promise.all([
      db.select({ count: sql<number>`count(*)` })
        .from(posts)
        .where(eq(posts.userId, ctx.user.id)),
      db.select({ count: sql<number>`count(*)` })
        .from(bookmarks)
        .where(eq(bookmarks.userId, ctx.user.id)),
    ]);

    return {
      postCount: Number(postResult[0]?.count || 0),
      initiativeCount: Number(initiativeResult[0]?.count || 0),
    };
  }),

  // Update profile
  update: protectedProcedure
    .input(z.object({
      bio: z.string().max(500).optional(),
      location: z.string().max(255).optional(),
      avatarUrl: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");

      // Check if profile exists
      const existing = await db.select()
        .from(userProfiles)
        .where(eq(userProfiles.userId, ctx.user.id))
        .limit(1);

      if (existing.length > 0) {
        const updates: Record<string, unknown> = {};
        if (input.bio !== undefined) updates.bio = input.bio;
        if (input.location !== undefined) updates.location = input.location;
        if (input.avatarUrl !== undefined) updates.avatarUrl = input.avatarUrl;
        updates.updatedAt = new Date();

        await db.update(userProfiles).set(updates).where(eq(userProfiles.userId, ctx.user.id));
      } else {
        await db.insert(userProfiles).values({
          userId: ctx.user.id,
          bio: input.bio || null,
          location: input.location || null,
          avatarUrl: input.avatarUrl || null,
        });
      }

      return { success: true };
    }),

  // Get user's participation history
  getParticipation: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) return [];

    const rows = await db.select({
      id: initiatives.id,
      title: initiatives.title,
      category: initiatives.category,
      status: initiatives.status,
      city: initiatives.city,
      startDate: initiatives.startDate,
      latitude: initiatives.latitude,
      longitude: initiatives.longitude,
      createdAt: bookmarks.createdAt,
    })
      .from(bookmarks)
      .innerJoin(initiatives, eq(bookmarks.initiativeId, initiatives.id))
      .where(eq(bookmarks.userId, ctx.user.id))
      .orderBy(desc(bookmarks.createdAt))
      .limit(50);

    return rows;
  }),
});
