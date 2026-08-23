import {
  boolean,
  integer,
  pgEnum,
  pgTable,
  real,
  serial,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core";

const timestampColumn = (name: string) => timestamp(name, { mode: "date" });

export const userRoleEnum = pgEnum("user_role", ["user", "admin", "moderator"]);
export const initiativeCategoryEnum = pgEnum("initiative_category", [
  "Environment",
  "Education",
  "Healthcare",
  "Blood Donation",
  "Animal Welfare",
  "Disaster Relief",
  "Community Service",
  "Awareness Campaigns",
  "Public Consultations",
]);
export const initiativeStatusEnum = pgEnum("initiative_status", ["upcoming", "ongoing", "completed", "cancelled"]);
export const reportableTypeEnum = pgEnum("reportable_type", ["post", "comment", "initiative"]);
export const reportStatusEnum = pgEnum("report_status", ["pending", "reviewed", "resolved", "dismissed"]);

/** Core user table backing the Manus OAuth session flow. */
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: userRoleEnum("role").default("user").notNull(),
  createdAt: timestampColumn("createdAt").defaultNow().notNull(),
  updatedAt: timestampColumn("updatedAt").defaultNow().notNull(),
  lastSignedIn: timestampColumn("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/** Extended user profile for civic participation data. */
export const userProfiles = pgTable("user_profiles", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull().unique().references(() => users.id, { onDelete: "cascade" }),
  bio: text("bio"),
  location: varchar("location", { length: 255 }),
  avatarUrl: text("avatarUrl"),
  contributionScore: integer("contributionScore").default(0).notNull(),
  createdAt: timestampColumn("createdAt").defaultNow().notNull(),
  updatedAt: timestampColumn("updatedAt").defaultNow().notNull(),
});

export type UserProfile = typeof userProfiles.$inferSelect;
export type InsertUserProfile = typeof userProfiles.$inferInsert;

/** Organizations that create civic initiatives. */
export const organizations = pgTable("organizations", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  logoUrl: text("logoUrl"),
  contactEmail: varchar("contactEmail", { length: 320 }),
  contactPhone: varchar("contactPhone", { length: 64 }),
  website: varchar("website", { length: 500 }),
  verified: boolean("verified").default(false).notNull(),
  createdAt: timestampColumn("createdAt").defaultNow().notNull(),
  updatedAt: timestampColumn("updatedAt").defaultNow().notNull(),
});

export type Organization = typeof organizations.$inferSelect;
export type InsertOrganization = typeof organizations.$inferInsert;

/** Civic initiatives — the core entity of JanConnect. */
export const initiatives = pgTable("initiatives", {
  id: serial("id").primaryKey(),
  title: varchar("title", { length: 500 }).notNull(),
  description: text("description").notNull(),
  category: initiativeCategoryEnum("category").notNull(),
  status: initiativeStatusEnum("status").default("upcoming").notNull(),
  verified: boolean("verified").default(false).notNull(),
  address: varchar("address", { length: 500 }),
  city: varchar("city", { length: 255 }),
  state: varchar("state", { length: 255 }),
  latitude: real("latitude"),
  longitude: real("longitude"),
  startDate: timestampColumn("startDate").notNull(),
  endDate: timestampColumn("endDate"),
  organizationId: integer("organizationId").references(() => organizations.id, { onDelete: "set null" }),
  imageUrl: text("imageUrl"),
  registrationLink: varchar("registrationLink", { length: 500 }),
  contactInfo: text("contactInfo"),
  participantCount: integer("participantCount").default(0).notNull(),
  bookmarkCount: integer("bookmarkCount").default(0).notNull(),
  createdBy: integer("createdBy").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestampColumn("createdAt").defaultNow().notNull(),
  updatedAt: timestampColumn("updatedAt").defaultNow().notNull(),
});

export type Initiative = typeof initiatives.$inferSelect;
export type InsertInitiative = typeof initiatives.$inferInsert;

/** Community posts — user-generated civic content. */
export const posts = pgTable("posts", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  content: text("content").notNull(),
  mediaUrl: text("mediaUrl"),
  initiativeId: integer("initiativeId").references(() => initiatives.id, { onDelete: "set null" }),
  likeCount: integer("likeCount").default(0).notNull(),
  commentCount: integer("commentCount").default(0).notNull(),
  createdAt: timestampColumn("createdAt").defaultNow().notNull(),
  updatedAt: timestampColumn("updatedAt").defaultNow().notNull(),
});

export type Post = typeof posts.$inferSelect;
export type InsertPost = typeof posts.$inferInsert;

/** Comments on posts. */
export const comments = pgTable("comments", {
  id: serial("id").primaryKey(),
  postId: integer("postId").notNull().references(() => posts.id, { onDelete: "cascade" }),
  userId: integer("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  content: text("content").notNull(),
  createdAt: timestampColumn("createdAt").defaultNow().notNull(),
  updatedAt: timestampColumn("updatedAt").defaultNow().notNull(),
});

export type Comment = typeof comments.$inferSelect;
export type InsertComment = typeof comments.$inferInsert;

/** User likes on posts. */
export const postLikes = pgTable("post_likes", {

  id: serial("id").primaryKey(),
  postId: integer("postId").notNull().references(() => posts.id, { onDelete: "cascade" }),
  userId: integer("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  createdAt: timestampColumn("createdAt").defaultNow().notNull(),
}, table => ({
  userPostUnique: uniqueIndex("post_likes_user_post_unique").on(table.userId, table.postId),
}));

export type PostLike = typeof postLikes.$inferSelect;
export type InsertPostLike = typeof postLikes.$inferInsert;

/** User bookmarks on initiatives. */
export const bookmarks = pgTable("bookmarks", {

  id: serial("id").primaryKey(),
  userId: integer("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  initiativeId: integer("initiativeId").notNull().references(() => initiatives.id, { onDelete: "cascade" }),
  createdAt: timestampColumn("createdAt").defaultNow().notNull(),
}, table => ({
  userInitiativeUnique: uniqueIndex("bookmarks_user_initiative_unique").on(table.userId, table.initiativeId),
}));

export type Bookmark = typeof bookmarks.$inferSelect;
export type InsertBookmark = typeof bookmarks.$inferInsert;

/** Content reports for moderation. */
export const reports = pgTable("reports", {
  id: serial("id").primaryKey(),
  reportableType: reportableTypeEnum("reportableType").notNull(),
  reportableId: integer("reportableId").notNull(),
  reason: text("reason").notNull(),
  reporterId: integer("reporterId").notNull().references(() => users.id, { onDelete: "cascade" }),
  status: reportStatusEnum("status").default("pending").notNull(),
  resolvedBy: integer("resolvedBy").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestampColumn("createdAt").defaultNow().notNull(),
  updatedAt: timestampColumn("updatedAt").defaultNow().notNull(),
});

export type Report = typeof reports.$inferSelect;
export type InsertReport = typeof reports.$inferInsert;
