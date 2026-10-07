import { z } from "zod";
import { eq, desc, sql } from "drizzle-orm";
import { router, publicProcedure, adminProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { organizations, initiatives } from "../../drizzle/schema";

export const organizationsRouter = router({
  list: publicProcedure
    .input(z.object({
      limit: z.number().min(1).max(50).default(20),
      offset: z.number().min(0).default(0),
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return { organizations: [], total: 0 };

      const rows = await db.select({
        id: organizations.id,
        name: organizations.name,
        description: organizations.description,
        logoUrl: organizations.logoUrl,
        contactEmail: organizations.contactEmail,
        website: organizations.website,
        verified: organizations.verified,
        createdAt: organizations.createdAt,
        initiativeCount: sql<number>`count(${initiatives.id})`,
      })
        .from(organizations)
        .leftJoin(initiatives, eq(organizations.id, initiatives.organizationId))
        .groupBy(organizations.id)
        .orderBy(desc(organizations.createdAt))
        .limit(input.limit)
        .offset(input.offset);

      const [countResult] = await db.select({ count: sql<number>`count(*)` }).from(organizations);

      return {
        organizations: rows.map(row => ({ ...row, initiativeCount: Number(row.initiativeCount ?? 0) })),
        total: Number(countResult?.count ?? 0),
      };
    }),

  getById: publicProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return null;

      const orgs = await db.select({
        id: organizations.id,
        name: organizations.name,
        description: organizations.description,
        logoUrl: organizations.logoUrl,
        contactEmail: organizations.contactEmail,
        contactPhone: organizations.contactPhone,
        website: organizations.website,
        verified: organizations.verified,
        createdAt: organizations.createdAt,
      })
        .from(organizations)
        .where(eq(organizations.id, input.id))
        .limit(1);

      if (!orgs[0]) return null;

      const orgInitiatives = await db.select({
        id: initiatives.id,
        title: initiatives.title,
        category: initiatives.category,
        status: initiatives.status,
        city: initiatives.city,
        startDate: initiatives.startDate,
      })
        .from(initiatives)
        .where(eq(initiatives.organizationId, input.id))
        .orderBy(desc(initiatives.createdAt))
        .limit(20);

      return { ...orgs[0], initiatives: orgInitiatives };
    }),

  update: adminProcedure
    .input(z.object({
      id: z.number(),
      name: z.string().min(2).max(255).optional(),
      description: z.string().optional(),
      logoUrl: z.string().optional(),
      contactEmail: z.string().max(320).optional(),
      contactPhone: z.string().max(64).optional(),
      website: z.string().max(500).optional(),
      verified: z.boolean().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");

      const updates: Record<string, unknown> = {};
      if (input.name !== undefined) updates.name = input.name;
      if (input.description !== undefined) updates.description = input.description;
      if (input.logoUrl !== undefined) updates.logoUrl = input.logoUrl;
      if (input.contactEmail !== undefined) updates.contactEmail = input.contactEmail;
      if (input.contactPhone !== undefined) updates.contactPhone = input.contactPhone;
      if (input.website !== undefined) updates.website = input.website;
      if (input.verified !== undefined) updates.verified = input.verified;

      await db.update(organizations).set(updates).where(eq(organizations.id, input.id));
      return { success: true };
    }),
});
