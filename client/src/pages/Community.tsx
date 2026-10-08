import { useState, useRef } from "react";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { startLogin } from "@/const";
import { MAX_UPLOAD_BYTES, MAX_UPLOAD_MB } from "@shared/const";
import { prepareImageForUpload } from "@/lib/prepareImage";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PostCard } from "@/components/PostCard";
import { ConfirmDialog, type ConfirmState } from "@/components/ConfirmDialog";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import {
  Heart, MessageCircle, Send, Image, Loader2,
  Flag, Trash2, X,
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatDistanceToNow } from "date-fns";

export default function Community() {
  const { isAuthenticated, user } = useAuth();
  const utils = trpc.useUtils();
  const [location] = useLocation();
  const queryString = typeof window !== "undefined" ? window.location.search : location.split("?")[1] || "";
  const initiativeIdParam = new URLSearchParams(queryString).get("initiativeId");
  const initiativeId = initiativeIdParam ? Number(initiativeIdParam) : undefined;
  const [newPost, setNewPost] = useState("");
  const [activePostId, setActivePostId] = useState<number | null>(null);
  const [commentText, setCommentText] = useState("");
  const [reportDialog, setReportDialog] = useState<{ open: boolean; type: "post" | "comment"; id: number }>({ open: false, type: "post", id: 0 });
  const [reportReason, setReportReason] = useState("");
  const [mediaPreview, setMediaPreview] = useState<string | null>(null);
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [processingImage, setProcessingImage] = useState(false);
  const [confirm, setConfirm] = useState<ConfirmState>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const generalFeed = trpc.posts.list.useQuery({ limit: 20 }, { enabled: !initiativeId });
  const initiativeFeed = trpc.posts.listByInitiative.useQuery({ initiativeId: initiativeId || 0, limit: 20 }, { enabled: !!initiativeId });
  const data = initiativeId ? initiativeFeed.data : generalFeed.data;
  const isLoading = initiativeId ? initiativeFeed.isLoading : generalFeed.isLoading;
  const refetch = initiativeId ? initiativeFeed.refetch : generalFeed.refetch;
  const createPost = trpc.posts.create.useMutation({
    onSuccess: () => { refetch(); setNewPost(""); setMediaFile(null); setMediaPreview(null); toast.success("Post shared!"); },
    onError: () => toast.error("Failed to create post"),
  });
  const addComment = trpc.posts.addComment.useMutation({
    onSuccess: () => { refetch(); setCommentText(""); toast.success("Comment added!"); },
  });
  const toggleLike = trpc.posts.toggleLike.useMutation({
    onSuccess: () => refetch(),
  });
  const reportContent = trpc.posts.reportContent.useMutation({
    onSuccess: () => {
      setReportDialog({ open: false, type: "post", id: 0 });
      setReportReason("");
      // The feeds now exclude the reported item for this user.
      utils.posts.invalidate();
      toast.success("Reported. You won't see this anymore.");
    },
    onError: () => toast.error("Failed to submit report"),
  });

  const getLikeStatus = trpc.posts.getLikeStatus.useQuery(
    { postId: activePostId || 0 },
    { enabled: !!activePostId && isAuthenticated }
  );

  const deletePost = trpc.posts.delete.useMutation({
    onSuccess: () => {
      utils.posts.invalidate();
      utils.profiles.getStats.invalidate();
      toast.success("Post deleted");
    },
    onError: (error) => toast.error(error.message || "Failed to delete post"),
  });
  const deleteComment = trpc.posts.deleteComment.useMutation({
    onSuccess: () => {
      utils.posts.invalidate();
      toast.success("Comment deleted");
    },
    onError: (error) => toast.error(error.message || "Failed to delete comment"),
  });

  const confirmDeletePost = (postId: number) =>
    setConfirm({
      title: "Delete this post?",
      description: "Your post, its comments, likes and image will be removed. This can't be undone.",
      actionLabel: "Delete post",
      onConfirm: () => deletePost.mutate({ id: postId }),
    });
  const confirmDeleteComment = (commentId: number) =>
    setConfirm({
      title: "Delete this comment?",
      description: "Your comment will be removed. This can't be undone.",
      actionLabel: "Delete comment",
      onConfirm: () => deleteComment.mutate({ id: commentId }),
    });

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (!selected) return;

    // Resize and re-encode before the size check: only the processed bytes are uploaded.
    let file: File;
    setProcessingImage(true);
    try {
      file = await prepareImageForUpload(selected);
    } catch {
      toast.error("Couldn't process this image. Try a JPEG or PNG.");
      return;
    } finally {
      setProcessingImage(false);
    }

    if (file.size > MAX_UPLOAD_BYTES) {
      toast.error(`File size must be under ${MAX_UPLOAD_MB} MB`);
      return;
    }
    setMediaFile(file);
    const reader = new FileReader();
    reader.onload = (ev) => {
      setMediaPreview(ev.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleCreatePost = async () => {
    if (!newPost.trim()) return;

    if (mediaFile) {
      try {
        // The upload endpoint takes base64 JSON, not multipart.
        const base64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve((reader.result as string).split(",")[1]);
          reader.onerror = reject;
          reader.readAsDataURL(mediaFile);
        });
        const uploadResp = await fetch("/api/upload-media", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            file: base64,
            filename: mediaFile.name,
            contentType: mediaFile.type || "image/png",
          }),
        });
        if (uploadResp.ok) {
          const { url } = await uploadResp.json();
          createPost.mutate({ content: newPost, mediaUrl: url, initiativeId });
        } else {
          createPost.mutate({ content: newPost, initiativeId });
          toast.warning("Image upload failed, post shared without image");
        }
      } catch {
        // Still publish the text if the upload request itself fails.
        createPost.mutate({ content: newPost, initiativeId });
      }
    } else {
      createPost.mutate({ content: newPost, initiativeId });
    }
  };

  const handleSubmitReport = () => {
    if (reportReason.trim().length < 10) {
      toast.error("Please provide a reason with at least 10 characters");
      return;
    }
    reportContent.mutate({
      reportableType: reportDialog.type,
      reportableId: reportDialog.id,
      reason: reportReason,
    });
  };

  return (
    <div className="container py-8 max-w-2xl">
      <div className="mb-8">
        {initiativeId && (
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-jan-teal/25 bg-jan-teal/10 px-3 py-1.5 text-[10px] uppercase tracking-[0.16em] text-jan-teal">
            <span className="h-1.5 w-1.5 rounded-full bg-jan-teal" /> Initiative discussion
          </div>
        )}
        <h1 className="font-display text-2xl font-bold text-foreground md:text-3xl">
          {initiativeId ? "Local context, in one place." : "Community Feed"}
        </h1>
        <p className="font-subheading text-muted-foreground">{initiativeId ? "Read updates and citizen context connected to this initiative." : "Share your civic experiences and connect with others"}</p>
      </div>

      {initiativeId && (
        <Card className="mb-6 border-jan-teal/20 bg-jan-teal/5">
          <CardContent className="flex items-center justify-between gap-4 p-4">
            <div className="flex items-center gap-3"><div className="flex h-9 w-9 items-center justify-center rounded-xl bg-jan-teal/15 text-jan-teal"><MessageCircle className="h-4 w-4" /></div><p className="text-xs text-muted-foreground">This view keeps the conversation anchored to the initiative you were exploring.</p></div>
            <a href="/community" className="shrink-0 text-xs font-medium text-jan-teal hover:text-jan-green">All posts</a>
          </CardContent>
        </Card>
      )}

      {/* Create Post */}
      {isAuthenticated ? (
        <Card className="mb-6 border-border/50">
          <CardContent className="p-5">
            <div className="flex gap-3">
              <Avatar className="h-10 w-10 flex-shrink-0">
                <AvatarFallback className="bg-jan-green/10 text-jan-green text-sm">
                  {user?.name?.charAt(0).toUpperCase() || "U"}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <Textarea
                  placeholder="Share your civic experience..."
                  value={newPost}
                  onChange={(e) => setNewPost(e.target.value)}
                  className="min-h-[80px] resize-none border-border/50 focus:border-jan-green/50"
                  aria-label="Write a community post"
                />
                {/* Media preview */}
                {mediaPreview && (
                  <div className="relative mt-3 rounded-lg overflow-hidden border border-border/50">
                    <img src={mediaPreview} alt="Upload preview" className="w-full h-48 object-cover" />
                    <button
                      onClick={() => { setMediaFile(null); setMediaPreview(null); }}
                      className="absolute top-2 right-2 w-6 h-6 bg-black/60 rounded-full flex items-center justify-center"
                      aria-label="Remove media"
                    >
                      <X className="w-3 h-3 text-white" />
                    </button>
                  </div>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  className="hidden"
                  onChange={handleFileSelect}
                  aria-label="Upload media"
                />
                <div className="flex items-center justify-between mt-3">
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-muted-foreground"
                      onClick={() => fileInputRef.current?.click()}
                      aria-label="Attach photo or video"
                    >
                      <Image className="w-4 h-4 mr-1" /> Photo
                    </Button>
                  </div>
                    <Button
                      size="sm"
                      className="bg-jan-green hover:bg-jan-green-dark text-white btn-press"
                      disabled={!newPost.trim() || createPost.isPending || processingImage}
                      onClick={handleCreatePost}
                    >
                    {createPost.isPending ? (
                      <Loader2 className="w-4 h-4 animate-spin mr-1" />
                    ) : (
                      <Send className="w-4 h-4 mr-1" />
                    )}
                    Post
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="mb-6 border-border/50 bg-jan-green/5">
          <CardContent className="p-6 text-center">
            <p className="font-subheading text-muted-foreground mb-3">Sign in to share your civic experiences</p>
            <Button onClick={() => startLogin()} className="bg-jan-green hover:bg-jan-green-dark text-white">
              Sign In
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Posts Feed */}
      {isLoading ? (
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i} className="border-border/50">
              <CardContent className="p-5">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-full bg-muted animate-pulse" />
                  <div className="h-4 bg-muted animate-pulse rounded w-32" />
                </div>
                <div className="h-3 bg-muted animate-pulse rounded w-full mb-2" />
                <div className="h-3 bg-muted animate-pulse rounded w-3/4" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="space-y-4">
          {(data?.posts || []).map((post, i) => (
            <motion.div
              key={post.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.06 }}
            >
              <PostCard
                post={post}
                onDelete={user?.id === post.userId ? () => confirmDeletePost(post.id) : undefined}
                onReport={isAuthenticated ? () => setReportDialog({ open: true, type: "post", id: post.id }) : undefined}
              >
                  {/* Post Actions */}
                  <div className="flex items-center gap-4 pt-3 border-t border-border/30">
                    <button
                      onClick={() => {
                        if (!isAuthenticated) { toast.error("Sign in to like"); return; }
                        setActivePostId(post.id);
                        toggleLike.mutate({ postId: post.id });
                      }}
                      className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-rose-500 transition-colors"
                      aria-label={`Like this post. ${post.likeCount} likes`}
                    >
                      <Heart className="w-4 h-4" />
                      {post.likeCount}
                    </button>
                    <button
                      onClick={() => setActivePostId(activePostId === post.id ? null : post.id)}
                      className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-jan-green transition-colors"
                      aria-label={`View ${post.commentCount} comments`}
                    >
                      <MessageCircle className="w-4 h-4" />
                      {post.commentCount}
                    </button>
                  </div>

                  {/* Comments Section */}
                  {activePostId === post.id && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      className="mt-4 pt-4 border-t border-border/30"
                    >
                      <CommentsSection
                        postId={post.id}
                        currentUserId={user?.id}
                        onReport={isAuthenticated ? (commentId) => setReportDialog({ open: true, type: "comment", id: commentId }) : undefined}
                        onDelete={confirmDeleteComment}
                      />
                      {isAuthenticated && (
                        <div className="flex gap-2 mt-3">
                          <Input
                            placeholder="Write a comment..."
                            value={commentText}
                            onChange={(e) => setCommentText(e.target.value)}
                            className="h-9 text-sm"
                            onKeyDown={(e) => {
                              if (e.key === "Enter" && commentText.trim()) {
                                addComment.mutate({ postId: post.id, content: commentText });
                              }
                            }}
                            aria-label="Write a comment"
                          />
                          <Button
                            size="sm"
                            disabled={!commentText.trim() || addComment.isPending}
                            onClick={() => addComment.mutate({ postId: post.id, content: commentText })}
                          >
                            <Send className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      )}
                    </motion.div>
                  )}
              </PostCard>
            </motion.div>
          ))}
        </div>
      )}

      <ConfirmDialog state={confirm} onClose={() => setConfirm(null)} />

      {/* Report Dialog */}
      <Dialog open={reportDialog.open} onOpenChange={(open) => !open && setReportDialog({ open: false, type: "post", id: 0 })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Flag className="w-4 h-4 text-red-500" /> Report Content
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Why are you reporting this {reportDialog.type}? Please provide a reason (minimum 10 characters).
            </p>
            <Textarea
              placeholder="Describe the issue..."
              value={reportReason}
              onChange={(e) => setReportReason(e.target.value)}
              className="min-h-[100px]"
            />
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setReportDialog({ open: false, type: "post", id: 0 })}>
                Cancel
              </Button>
              <Button
                className="bg-red-500 hover:bg-red-600 text-white"
                onClick={handleSubmitReport}
                disabled={reportReason.trim().length < 10 || reportContent.isPending}
              >
                {reportContent.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-1" />
                ) : null}
                Submit Report
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function CommentsSection({ postId, currentUserId, onReport, onDelete }: {
  postId: number;
  currentUserId?: number;
  onReport?: (commentId: number) => void;
  onDelete?: (commentId: number) => void;
}) {
  const { data: comments, isLoading } = trpc.posts.getComments.useQuery({ postId });

  if (isLoading) return <div className="text-sm text-muted-foreground">Loading comments...</div>;
  if (!comments?.length) return <p className="text-sm text-muted-foreground">No comments yet</p>;

  return (
    <div className="space-y-3">
      {comments.map((comment) => (
        <div key={comment.id} className="flex gap-2.5">
          <Avatar className="h-7 w-7 flex-shrink-0">
            <AvatarFallback className="bg-muted text-xs">
              {comment.userName?.charAt(0).toUpperCase() || "?"}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1">
            <div className="bg-muted/50 rounded-xl px-3 py-2">
              <p className="text-xs font-medium text-foreground">{comment.userName || "Anonymous"}</p>
              <p className="text-xs text-foreground mt-0.5">{comment.content}</p>
            </div>
            <div className="flex items-center gap-2 mt-1 ml-2 text-[10px] text-muted-foreground">
              <span>{formatDistanceToNow(new Date(comment.createdAt), { addSuffix: true })}</span>
              {comment.userId === currentUserId && onDelete ? (
                <button
                  type="button"
                  onClick={() => onDelete(comment.id)}
                  className="flex items-center gap-0.5 hover:text-red-500 transition-colors"
                  aria-label="Delete comment"
                >
                  <Trash2 className="w-2.5 h-2.5" /> Delete
                </button>
              ) : onReport ? (
                <button
                  type="button"
                  onClick={() => onReport(comment.id)}
                  className="flex items-center gap-0.5 hover:text-red-500 transition-colors"
                  aria-label="Report comment"
                >
                  <Flag className="w-2.5 h-2.5" /> Report
                </button>
              ) : null}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
