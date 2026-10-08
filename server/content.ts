// Deletion of community content, shared by the author-facing procedures
// (posts.delete / posts.deleteComment) and the moderator ones (admin.deletePost /
// admin.deleteComment). Pass authorId to restrict the delete to the item's author.

import { TRPCError } from "@trpc/server";
import { and, eq, inArray, or, sql } from "drizzle-orm";
import { comments, posts, reports } from "../drizzle/schema";
import { getDb } from "./db";
import { storageDelete } from "./storage";

const notYours = () => new TRPCError({ code: "FORBIDDEN", message: "You can only delete your own content." });

// Removes a post's uploaded image unless another post still points at it.
async function deleteOrphanedMedia(mediaUrl: string | null) {
  if (!mediaUrl?.startsWith("/media/community-posts/")) return;
  try {
    const db = await getDb();
    const [stillUsed] = await db.select({ id: posts.id }).from(posts).where(eq(posts.mediaUrl, mediaUrl)).limit(1);
    if (!stillUsed) await storageDelete(mediaUrl.slice("/media/".length));
  } catch (error) {
    console.error("[Content] Failed to delete post media:", error);
  }
}

export async function deletePost(postId: number, options: { authorId?: number } = {}) {
  const db = await getDb();
  const deleted = await db.transaction(async tx => {
    // Locking the post blocks new comments/likes (their FKs need a key-share lock) until we're done.
    const [post] = await tx.select({ id: posts.id, userId: posts.userId, mediaUrl: posts.mediaUrl }).from(posts)
      .where(eq(posts.id, postId))
      .for("update");
    if (!post) throw new TRPCError({ code: "NOT_FOUND", message: "Post not found" });
    if (options.authorId !== undefined && post.userId !== options.authorId) throw notYours();

    const commentIds = (await tx.select({ id: comments.id }).from(comments).where(eq(comments.postId, post.id))).map(row => row.id);
    await tx.delete(reports).where(or(
      and(eq(reports.reportableType, "post"), eq(reports.reportableId, post.id)),
      commentIds.length > 0 ? and(eq(reports.reportableType, "comment"), inArray(reports.reportableId, commentIds)) : undefined,
    ));
    // Comments and likes are removed by ON DELETE CASCADE.
    await tx.delete(posts).where(eq(posts.id, post.id));
    return post;
  });

  await deleteOrphanedMedia(deleted.mediaUrl);
}

export async function deleteComment(commentId: number, options: { authorId?: number } = {}) {
  const db = await getDb();
  await db.transaction(async tx => {
    const [comment] = await tx.select({ id: comments.id, postId: comments.postId, userId: comments.userId }).from(comments)
      .where(eq(comments.id, commentId))
      .for("update");
    if (!comment) throw new TRPCError({ code: "NOT_FOUND", message: "Comment not found" });
    if (options.authorId !== undefined && comment.userId !== options.authorId) throw notYours();

    await tx.delete(reports).where(and(eq(reports.reportableType, "comment"), eq(reports.reportableId, comment.id)));
    await tx.delete(comments).where(eq(comments.id, comment.id));
    await tx.update(posts)
      .set({ commentCount: sql`greatest(${posts.commentCount} - 1, 0)` })
      .where(eq(posts.id, comment.postId));
  });
}
