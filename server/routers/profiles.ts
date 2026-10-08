import { z } from "zod";
import { eq, desc, sql } from "drizzle-orm";
import { router, publicProcedure, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { id, imageUrl } from "./inputs";
import { userProfiles, users, initiatives, bookmarks, posts } from "../../drizzle/schema";

export const profilesRouter = router({
  getByUserId: publicProcedure
    .input(z.object({ userId: id }))
    .query(async ({ input }) => {
      const db = await getDb();

      const userRows = await db.select({
        id: users.id,
        name: users.name,
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

  me: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();

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

  getStats: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();

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

  update: protectedProcedure
    .input(z.object({
      bio: z.string().max(500).optional(),
      location: z.string().max(255).optional(),
      avatarUrl: imageUrl.optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();

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

  getParticipation: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();

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
