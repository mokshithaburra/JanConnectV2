import type { ReactNode } from "react";
import { formatDistanceToNow } from "date-fns";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { Flag, MoreHorizontal, Share2, Trash2 } from "lucide-react";

type PostCardPost = {
  content: string;
  mediaUrl: string | null;
  userName: string | null;
  createdAt: Date | string;
};

// Header, menu, text and image of a community post; callers add their own footer as children.
// Pass onDelete for the author's own posts (Report is then hidden) and onReport for everyone else's.
export function PostCard({ post, onReport, onDelete, children }: {
  post: PostCardPost;
  onReport?: () => void;
  onDelete?: () => void;
  children?: ReactNode;
}) {
  return (
    <Card className="border-border/50 hover:border-border transition-colors">
      <CardContent className="p-5">
        {/* Post Header */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <Avatar className="h-10 w-10">
              <AvatarFallback className="bg-jan-green/10 text-jan-green text-sm font-medium">
                {post.userName?.charAt(0).toUpperCase() || "?"}
              </AvatarFallback>
            </Avatar>
            <div>
              <p className="text-sm font-medium text-foreground">{post.userName || "Anonymous"}</p>
              <p className="text-xs text-muted-foreground">
                {formatDistanceToNow(new Date(post.createdAt), { addSuffix: true })}
              </p>
            </div>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <MoreHorizontal className="w-4 h-4 text-muted-foreground" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => {
                navigator.clipboard.writeText(`${window.location.origin}/community`);
                toast.success("Link copied!");
              }}>
                <Share2 className="w-4 h-4 mr-2" /> Share
              </DropdownMenuItem>
              {onDelete ? (
                <DropdownMenuItem onClick={onDelete} className="text-red-500">
                  <Trash2 className="w-4 h-4 mr-2 text-red-500" /> Delete
                </DropdownMenuItem>
              ) : onReport ? (
                <DropdownMenuItem onClick={onReport}>
                  <Flag className="w-4 h-4 mr-2 text-red-500" /> Report
                </DropdownMenuItem>
              ) : null}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Post Content */}
        <p className="text-sm text-foreground leading-relaxed mb-4 whitespace-pre-wrap">
          {post.content}
        </p>

        {post.mediaUrl && (
          <img
            src={post.mediaUrl}
            alt={post.content.slice(0, 120)}
            loading="lazy"
            className="w-full max-h-[400px] object-cover rounded-xl border border-border/50 mb-4"
            // Hide instead of showing a broken-image icon (e.g. the object was removed).
            onError={(e) => { e.currentTarget.style.display = "none"; }}
          />
        )}

        {children}
      </CardContent>
    </Card>
  );
}
