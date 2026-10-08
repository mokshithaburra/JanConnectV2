import { z } from "zod";
import { eq, desc, sql } from "drizzle-orm";
import { router, adminProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { id, offset } from "./inputs";
import { reports, initiatives, posts, users } from "../../drizzle/schema";

export const adminRouter = router({
  listReports: adminProcedure
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
      })
        .from(reports)
        .leftJoin(users, eq(reports.reporterId, users.id))
        .where(conditions.length > 0 ? conditions[0] : undefined)
        .orderBy(desc(reports.createdAt))
        .limit(input.limit)
        .offset(input.offset);

      const [countResult] = await db.select({ count: sql<number>`count(*)` })
        .from(reports)
        .where(conditions.length > 0 ? conditions[0] : undefined);

      return { reports: rows, total: Number(countResult?.count ?? 0) };
    }),

  resolveReport: adminProcedure
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

  getPendingCount: adminProcedure.query(async () => {
    const db = await getDb();

    const [result] = await db.select({ count: sql<number>`count(*)` })
      .from(reports)
      .where(eq(reports.status, "pending"));

    return { count: Number(result?.count ?? 0) };
  }),

  getStats: adminProcedure.query(async () => {
    const db = await getDb();

    const [initCount] = await db.select({ count: sql<number>`count(*)` }).from(initiatives);
    const [postCount] = await db.select({ count: sql<number>`count(*)` }).from(posts);
    const [userCount] = await db.select({ count: sql<number>`count(*)` }).from(users);
    const [reportCount] = await db.select({ count: sql<number>`count(*)` }).from(reports);

    return {
      initiatives: Number(initCount?.count ?? 0),
      posts: Number(postCount?.count ?? 0),
      users: Number(userCount?.count ?? 0),
      reports: Number(reportCount?.count ?? 0),
    };
  }),
});
