import { relations } from "drizzle-orm";
import {
  bookmarks,
  comments,
  initiatives,
  organizations,
  postLikes,
  posts,
  reports,
  userProfiles,
  users,
} from "./schema";

export const usersRelations = relations(users, ({ one, many }) => ({
  profile: one(userProfiles),
  createdInitiatives: many(initiatives, { relationName: "initiativeCreator" }),
  posts: many(posts),
  comments: many(comments),
  postLikes: many(postLikes),
  bookmarks: many(bookmarks),
  submittedReports: many(reports, { relationName: "reporter" }),
  resolvedReports: many(reports, { relationName: "resolver" }),
}));

export const userProfilesRelations = relations(userProfiles, ({ one }) => ({
  user: one(users, {
    fields: [userProfiles.userId],
    references: [users.id],
  }),
}));

export const organizationsRelations = relations(organizations, ({ many }) => ({
  initiatives: many(initiatives),
}));

export const initiativesRelations = relations(initiatives, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [initiatives.organizationId],
    references: [organizations.id],
  }),
  creator: one(users, {
    fields: [initiatives.createdBy],
    references: [users.id],
    relationName: "initiativeCreator",
  }),
  posts: many(posts),
  bookmarks: many(bookmarks),
}));

export const postsRelations = relations(posts, ({ one, many }) => ({
  author: one(users, {
    fields: [posts.userId],
    references: [users.id],
  }),
  initiative: one(initiatives, {
    fields: [posts.initiativeId],
    references: [initiatives.id],
  }),
  comments: many(comments),
  likes: many(postLikes),
}));

export const commentsRelations = relations(comments, ({ one }) => ({
  post: one(posts, {
    fields: [comments.postId],
    references: [posts.id],
  }),
  author: one(users, {
    fields: [comments.userId],
    references: [users.id],
  }),
}));

export const postLikesRelations = relations(postLikes, ({ one }) => ({
  post: one(posts, {
    fields: [postLikes.postId],
    references: [posts.id],
  }),
  user: one(users, {
    fields: [postLikes.userId],
    references: [users.id],
  }),
}));

export const bookmarksRelations = relations(bookmarks, ({ one }) => ({
  initiative: one(initiatives, {
    fields: [bookmarks.initiativeId],
    references: [initiatives.id],
  }),
  user: one(users, {
    fields: [bookmarks.userId],
    references: [users.id],
  }),
}));

export const reportsRelations = relations(reports, ({ one }) => ({
  reporter: one(users, {
    fields: [reports.reporterId],
    references: [users.id],
    relationName: "reporter",
  }),
  resolver: one(users, {
    fields: [reports.resolvedBy],
    references: [users.id],
    relationName: "resolver",
  }),
}));
