import { z } from "zod";
import { eq, and, or, sql, desc, asc, gt, gte, lt, lte, between } from "drizzle-orm";
import { router, publicProcedure, protectedProcedure, adminProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { initiatives, organizations, bookmarks, userProfiles, users } from "../../drizzle/schema";

const CATEGORIES = [
  "Environment", "Education", "Healthcare", "Blood Donation",
  "Animal Welfare", "Disaster Relief", "Community Service",
  "Awareness Campaigns", "Public Consultations",
] as const;

const STATUSES = ["upcoming", "ongoing", "completed", "cancelled"] as const;

export const initiativesRouter = router({
  // List initiatives with filters
  list: publicProcedure
    .input(z.object({
      category: z.enum(CATEGORIES).optional(),
      status: z.enum(STATUSES).optional(),
      verified: z.boolean().optional(),
      city: z.string().optional(),
      search: z.string().optional(),
      sortBy: z.enum(["newest", "oldest", "participants", "name"]).default("newest"),
      limit: z.number().min(1).max(100).default(20),
      offset: z.number().min(0).default(0),
      // Geo filter
      latitude: z.number().optional(),
      longitude: z.number().optional(),
      radiusKm: z.number().min(1).max(1000).optional(),
      // Date filter: "today", "this_week", "this_month", "future", "all"
      dateFilter: z.enum(["today", "this_week", "this_month", "future", "all"]).optional(),
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return { initiatives: [], total: 0 };

      const conditions = [];
      if (input.category) conditions.push(eq(initiatives.category, input.category));
      if (input.status) conditions.push(eq(initiatives.status, input.status));
      if (input.verified !== undefined) conditions.push(eq(initiatives.verified, input.verified));
      if (input.city) conditions.push(eq(initiatives.city, input.city));
      if (input.search) {
        conditions.push(
          or(
            sql`${initiatives.title} ILIKE ${`%${input.search}%`}`,
            sql`${initiatives.description} ILIKE ${`%${input.search}%`}`,
            sql`${initiatives.address} ILIKE ${`%${input.search}%`}`,
          )!
        );
      }

      // Date filter
      if (input.dateFilter && input.dateFilter !== "all" && input.dateFilter !== "future") {
        const now = new Date();
        let fromDate: Date | undefined;
        let toDate: Date | undefined;
        switch (input.dateFilter) {
          case "today":
            fromDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            toDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
            break;
          case "this_week": {
            const dayOfWeek = now.getDay();
            const startOfWeek = new Date(now);
            startOfWeek.setDate(now.getDate() - dayOfWeek);
            startOfWeek.setHours(0, 0, 0, 0);
            const endOfWeek = new Date(startOfWeek);
            endOfWeek.setDate(startOfWeek.getDate() + 7);
            fromDate = startOfWeek;
            toDate = endOfWeek;
            break;
          }
          case "this_month":
            fromDate = new Date(now.getFullYear(), now.getMonth(), 1);
            toDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
            break;
        }
        if (fromDate && toDate) {
          conditions.push(
            and(
              gte(initiatives.startDate, fromDate),
              lt(initiatives.startDate, toDate),
            )!
          );
        }
      } else if (input.dateFilter === "future") {
        conditions.push(gte(initiatives.startDate, new Date()));
      }

      // Geo filter
      if (input.latitude && input.longitude && input.radiusKm) {
        const lat = input.latitude;
        const lng = input.longitude;
        const r = input.radiusKm;
        // Haversine approximation
        conditions.push(sql`(
          6371 * acos(
            cos(radians(${lat})) * cos(radians(${initiatives.latitude})) *
            cos(radians(${initiatives.longitude}) - radians(${lng})) +
            sin(radians(${lat})) * sin(radians(${initiatives.latitude}))
          ) <= ${r}
        )`);
      }

      const where = conditions.length > 0 ? and(...conditions) : undefined;

      let orderBy;
      switch (input.sortBy) {
        case "oldest": orderBy = asc(initiatives.createdAt); break;
        case "participants": orderBy = desc(initiatives.participantCount); break;
        case "name": orderBy = asc(initiatives.title); break;
        default: orderBy = desc(initiatives.createdAt);
      }

      const [countResult] = await db.select({ count: sql<number>`count(*)` })
        .from(initiatives)
        .where(where);

      const rows = await db.select({
        id: initiatives.id,
        title: initiatives.title,
        description: initiatives.description,
        category: initiatives.category,
        status: initiatives.status,
        verified: initiatives.verified,
        address: initiatives.address,
        city: initiatives.city,
        state: initiatives.state,
        latitude: initiatives.latitude,
        longitude: initiatives.longitude,
        startDate: initiatives.startDate,
        endDate: initiatives.endDate,
        organizationId: initiatives.organizationId,
        imageUrl: initiatives.imageUrl,
        registrationLink: initiatives.registrationLink,
        contactInfo: initiatives.contactInfo,
        participantCount: initiatives.participantCount,
        bookmarkCount: initiatives.bookmarkCount,
        createdAt: initiatives.createdAt,
        organizationName: organizations.name,
        organizationVerified: organizations.verified,
      })
        .from(initiatives)
        .leftJoin(organizations, eq(initiatives.organizationId, organizations.id))
        .where(where)
        .orderBy(orderBy)
        .limit(input.limit)
        .offset(input.offset);

      return {
        initiatives: rows,
        total: Number(countResult?.count ?? 0),
      };
    }),

  // Get single initiative with full details
  getById: publicProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return null;

      const rows = await db.select({
        id: initiatives.id,
        title: initiatives.title,
        description: initiatives.description,
        category: initiatives.category,
        status: initiatives.status,
        verified: initiatives.verified,
        address: initiatives.address,
        city: initiatives.city,
        state: initiatives.state,
        latitude: initiatives.latitude,
        longitude: initiatives.longitude,
        startDate: initiatives.startDate,
        endDate: initiatives.endDate,
        organizationId: initiatives.organizationId,
        imageUrl: initiatives.imageUrl,
        registrationLink: initiatives.registrationLink,
        contactInfo: initiatives.contactInfo,
        participantCount: initiatives.participantCount,
        bookmarkCount: initiatives.bookmarkCount,
        createdBy: initiatives.createdBy,
        createdAt: initiatives.createdAt,
        updatedAt: initiatives.updatedAt,
        organizationName: organizations.name,
        organizationDescription: organizations.description,
        organizationLogoUrl: organizations.logoUrl,
        organizationVerified: organizations.verified,
        organizationWebsite: organizations.website,
        organizationContactEmail: organizations.contactEmail,
        organizationContactPhone: organizations.contactPhone,
      })
        .from(initiatives)
        .leftJoin(organizations, eq(initiatives.organizationId, organizations.id))
        .where(eq(initiatives.id, input.id))
        .limit(1);

      return rows[0] || null;
    }),

  // Get categories with counts
  getCategories: publicProcedure.query(async () => {
    const db = await getDb();
    if (!db) return [];

    const rows = await db.select({
      category: initiatives.category,
      count: sql<number>`count(*)`,
    })
      .from(initiatives)
      .groupBy(initiatives.category);

      return rows.map(row => ({ ...row, count: Number(row.count) }));
    }),

  // Get nearby initiatives
  getNearby: publicProcedure
    .input(z.object({
      latitude: z.number(),
      longitude: z.number(),
      radiusKm: z.number().min(1).max(100).default(25),
      limit: z.number().min(1).max(50).default(10),
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];

      const lat = input.latitude;
      const lng = input.longitude;
      const r = input.radiusKm;

      const rows = await db.select({
        id: initiatives.id,
        title: initiatives.title,
        category: initiatives.category,
        city: initiatives.city,
        latitude: initiatives.latitude,
        longitude: initiatives.longitude,
        startDate: initiatives.startDate,
        status: initiatives.status,
        verified: initiatives.verified,
        organizationName: organizations.name,
        distance: sql<number>`(
          6371 * acos(
            cos(radians(${lat})) * cos(radians(${initiatives.latitude})) *
            cos(radians(${initiatives.longitude}) - radians(${lng})) +
            sin(radians(${lat})) * sin(radians(${initiatives.latitude}))
          )
        )`.as("distance"),
      })
        .from(initiatives)
        .leftJoin(organizations, eq(initiatives.organizationId, organizations.id))
        .where(sql`(
          6371 * acos(
            cos(radians(${lat})) * cos(radians(${initiatives.latitude})) *
            cos(radians(${initiatives.longitude}) - radians(${lng})) +
            sin(radians(${lat})) * sin(radians(${initiatives.latitude}))
          ) <= ${r}
        )`)
        .orderBy(sql`distance`)
        .limit(input.limit);

      return rows;
    }),

  // Get related initiatives
  getRelated: publicProcedure
    .input(z.object({ id: z.number(), limit: z.number().default(4) }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];

      const init = await db.select().from(initiatives).where(eq(initiatives.id, input.id)).limit(1);
      if (!init[0]) return [];

      const rows = await db.select({
        id: initiatives.id,
        title: initiatives.title,
        category: initiatives.category,
        city: initiatives.city,
        startDate: initiatives.startDate,
        status: initiatives.status,
        verified: initiatives.verified,
      })
        .from(initiatives)
        .where(and(
          eq(initiatives.category, init[0].category),
          sql`${initiatives.id} != ${input.id}`,
        ))
        .orderBy(desc(initiatives.createdAt))
        .limit(input.limit);

      return rows;
    }),

  // Create initiative (protected)
  create: protectedProcedure
    .input(z.object({
      title: z.string().min(5).max(500),
      description: z.string().min(20),
      category: z.enum(CATEGORIES),
      status: z.enum(STATUSES).default("upcoming"),
      address: z.string().optional(),
      city: z.string().optional(),
      state: z.string().optional(),
      latitude: z.number().optional(),
      longitude: z.number().optional(),
      startDate: z.string(),
      endDate: z.string().optional(),
      organizationId: z.number().optional(),
      registrationLink: z.string().max(500).optional(),
      contactInfo: z.string().optional(),
      imageUrl: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");

      await db.insert(initiatives).values({
        ...input,
        startDate: new Date(input.startDate),
        endDate: input.endDate ? new Date(input.endDate) : null,
        createdBy: ctx.user.id,
      });

      // Update user contribution score
      try {
        await db.update(userProfiles)
          .set({ contributionScore: sql`${userProfiles.contributionScore} + 10` })
          .where(eq(userProfiles.userId, ctx.user.id));
      } catch {
        // Profile may not exist yet
      }

      return { success: true };
    }),

  // Update initiative (admin only)
  update: adminProcedure
    .input(z.object({
      id: z.number(),
      title: z.string().min(5).max(500).optional(),
      description: z.string().min(20).optional(),
      status: z.enum(STATUSES).optional(),
      verified: z.boolean().optional(),
      address: z.string().optional(),
      city: z.string().optional(),
      state: z.string().optional(),
      latitude: z.number().optional(),
      longitude: z.number().optional(),
      startDate: z.string().optional(),
      endDate: z.string().optional(),
      contactInfo: z.string().optional(),
      registrationLink: z.string().optional(),
      imageUrl: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");

      const updates: Record<string, unknown> = {};
      if (input.title !== undefined) updates.title = input.title;
      if (input.description !== undefined) updates.description = input.description;
      if (input.status !== undefined) updates.status = input.status;
      if (input.verified !== undefined) updates.verified = input.verified;
      if (input.address !== undefined) updates.address = input.address;
      if (input.city !== undefined) updates.city = input.city;
      if (input.state !== undefined) updates.state = input.state;
      if (input.latitude !== undefined) updates.latitude = input.latitude;
      if (input.longitude !== undefined) updates.longitude = input.longitude;
      if (input.startDate !== undefined) updates.startDate = new Date(input.startDate);
      if (input.endDate !== undefined) updates.endDate = new Date(input.endDate);
      if (input.contactInfo !== undefined) updates.contactInfo = input.contactInfo;
      if (input.registrationLink !== undefined) updates.registrationLink = input.registrationLink;
      if (input.imageUrl !== undefined) updates.imageUrl = input.imageUrl;

      await db.update(initiatives).set(updates).where(eq(initiatives.id, input.id));
      return { success: true };
    }),

  // Bookmark toggle
  toggleBookmark: protectedProcedure
    .input(z.object({ initiativeId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");

      const existing = await db.select()
        .from(bookmarks)
        .where(and(
          eq(bookmarks.userId, ctx.user.id),
          eq(bookmarks.initiativeId, input.initiativeId),
        ))
        .limit(1);

      if (existing.length > 0) {
        await db.delete(bookmarks).where(and(
          eq(bookmarks.userId, ctx.user.id),
          eq(bookmarks.initiativeId, input.initiativeId),
        ));
        await db.update(initiatives)
          .set({ bookmarkCount: sql`${initiatives.bookmarkCount} - 1` })
          .where(eq(initiatives.id, input.initiativeId));
        return { bookmarked: false };
      } else {
        await db.insert(bookmarks).values({
          userId: ctx.user.id,
          initiativeId: input.initiativeId,
        });
        await db.update(initiatives)
          .set({ bookmarkCount: sql`${initiatives.bookmarkCount} + 1` })
          .where(eq(initiatives.id, input.initiativeId));
        return { bookmarked: true };
      }
    }),

  // Check if user has bookmarked
  getBookmarkStatus: protectedProcedure
    .input(z.object({ initiativeId: z.number() }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) return { bookmarked: false };

      const existing = await db.select()
        .from(bookmarks)
        .where(and(
          eq(bookmarks.userId, ctx.user.id),
          eq(bookmarks.initiativeId, input.initiativeId),
        ))
        .limit(1);

      return { bookmarked: existing.length > 0 };
    }),

  // Get user's bookmarks
  getUserBookmarks: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) return [];

    const rows = await db.select({
      id: initiatives.id,
      title: initiatives.title,
      category: initiatives.category,
      status: initiatives.status,
      city: initiatives.city,
      startDate: initiatives.startDate,
      verified: initiatives.verified,
      bookmarkedAt: bookmarks.createdAt,
    })
      .from(bookmarks)
      .innerJoin(initiatives, eq(bookmarks.initiativeId, initiatives.id))
      .where(eq(bookmarks.userId, ctx.user.id))
      .orderBy(desc(bookmarks.createdAt));

    return rows;
  }),
});
