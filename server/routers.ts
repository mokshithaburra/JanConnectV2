import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";
import { initiativesRouter } from "./routers/initiatives";
import { postsRouter } from "./routers/posts";
import { organizationsRouter } from "./routers/organizations";
import { profilesRouter } from "./routers/profiles";
import { adminRouter } from "./routers/admin";

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
  }),

  initiatives: initiativesRouter,
  posts: postsRouter,
  organizations: organizationsRouter,
  profiles: profilesRouter,
  admin: adminRouter,
});

export type AppRouter = typeof appRouter;
