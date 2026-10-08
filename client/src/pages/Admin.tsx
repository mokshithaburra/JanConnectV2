import { useState, type ReactNode } from "react";
import { motion } from "framer-motion";
import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "../../../server/routers";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ConfirmDialog, type ConfirmState } from "@/components/ConfirmDialog";
import { toast } from "sonner";
import {
  Shield, AlertTriangle, CheckCircle, XCircle,
  Users, FileText, Building2, MessageCircle,
  ShieldCheck, Search, MapPin, Calendar, Pencil, Trash2, Activity,
} from "lucide-react";

type RouterOutputs = inferRouterOutputs<AppRouter>;
type InitiativeRow = RouterOutputs["initiatives"]["list"]["initiatives"][number];
type OrganizationRow = RouterOutputs["organizations"]["list"]["organizations"][number];

const CATEGORIES = [
  "Environment", "Education", "Healthcare", "Blood Donation",
  "Animal Welfare", "Disaster Relief", "Community Service",
  "Awareness Campaigns", "Public Consultations",
];
const STATUSES = ["upcoming", "ongoing", "completed", "cancelled"] as const;
const ROLES = ["user", "moderator", "admin"] as const;
const PAGE_SIZE = 20;

const formatDate = (value: Date | string | null | undefined) =>
  value ? new Date(value).toLocaleDateString("en-IN", { month: "short", day: "numeric", year: "numeric" }) : "N/A";

// Validation failures come back as zod issue lists; everything else carries a readable message.
const errorMessage = (error: { message: string; data?: { code?: string } | null }, fallback: string) =>
  error.data?.code === "BAD_REQUEST" ? `${fallback}: some fields are invalid` : error.message || fallback;

function Pager({ page, total, onPage }: { page: number; total: number; onPage: (page: number) => void }) {
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  if (pages <= 1) return null;
  return (
    <div className="flex items-center justify-between pt-4 text-xs text-muted-foreground">
      <span>Page {page + 1} of {pages} &middot; {total} total</span>
      <div className="flex gap-2">
        <Button size="sm" variant="outline" disabled={page === 0} onClick={() => onPage(page - 1)}>Previous</Button>
        <Button size="sm" variant="outline" disabled={page + 1 >= pages} onClick={() => onPage(page + 1)}>Next</Button>
      </div>
    </div>
  );
}

function LoadingRows() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="h-16 bg-muted animate-pulse rounded-lg" />
      ))}
    </div>
  );
}

function EmptyRows({ children }: { children: ReactNode }) {
  return <p className="text-sm text-muted-foreground text-center py-8">{children}</p>;
}

function SearchBox({ value, onChange, placeholder }: { value: string; onChange: (value: string) => void; placeholder: string }) {
  return (
    <div className="relative flex-1 max-w-xs">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
      <Input placeholder={placeholder} value={value} maxLength={200} onChange={(e) => onChange(e.target.value)} className="pl-9 h-9" />
    </div>
  );
}

function OverviewTab() {
  const stats = trpc.admin.getStats.useQuery();
  const activity = trpc.admin.getRecentActivity.useQuery();

  const sections = [
    { title: "Recent posts", icon: FileText, rows: activity.data?.posts.map((p) => ({ id: `p${p.id}`, text: p.content, meta: `${p.userName || "Unknown"} · ${formatDate(p.createdAt)}` })) },
    { title: "Recent comments", icon: MessageCircle, rows: activity.data?.comments.map((c) => ({ id: `c${c.id}`, text: c.content, meta: `${c.userName || "Unknown"} on post #${c.postId} · ${formatDate(c.createdAt)}` })) },
    { title: "New users", icon: Users, rows: activity.data?.users.map((u) => ({ id: `u${u.id}`, text: u.name || "Unnamed user", meta: `${u.role} · joined ${formatDate(u.createdAt)}` })) },
    { title: "New initiatives", icon: Building2, rows: activity.data?.initiatives.map((i) => ({ id: `i${i.id}`, text: i.title, meta: `${i.verified ? "Verified" : "Unverified"} · ${formatDate(i.createdAt)}` })) },
  ];

  return (
    <div className="mt-4 space-y-4">
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Comments", value: stats.data?.comments || 0 },
          { label: "Organizations", value: stats.data?.organizations || 0 },
          { label: "Reports (all time)", value: stats.data?.reports || 0 },
        ].map((stat) => (
          <Card key={stat.label} className="border-border/50">
            <CardContent className="p-4">
              <div className="text-2xl font-display font-bold text-foreground">{stat.value}</div>
              <div className="text-xs text-muted-foreground">{stat.label}</div>
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="grid md:grid-cols-2 gap-4">
        {sections.map((section) => (
          <Card key={section.title} className="border-border/50">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <section.icon className="w-4 h-4 text-jan-green" /> {section.title}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {activity.isLoading ? <LoadingRows /> : !section.rows?.length ? <EmptyRows>Nothing yet</EmptyRows> : (
                <div className="space-y-3">
                  {section.rows.map((row) => (
                    <div key={row.id} className="min-w-0">
                      <p className="text-sm text-foreground truncate">{row.text}</p>
                      <p className="text-xs text-muted-foreground">{row.meta}</p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

function ReportsTab() {
  const utils = trpc.useUtils();
  const reports = trpc.admin.listReports.useQuery({ status: "pending", limit: 20 });
  const pendingCount = trpc.admin.getPendingCount.useQuery();

  const resolveReport = trpc.admin.resolveReport.useMutation({
    onSuccess: () => {
      utils.admin.invalidate();
      toast.success("Report resolved");
    },
    onError: (error) => toast.error(errorMessage(error, "Failed to update report")),
  });

  const [confirm, setConfirm] = useState<ConfirmState>(null);
  // Deleting the content also deletes its reports, so the row leaves the queue.
  const afterRemove = () => {
    utils.admin.invalidate();
    utils.posts.invalidate();
    toast.success("Content removed");
  };
  const deletePost = trpc.admin.deletePost.useMutation({
    onSuccess: afterRemove,
    onError: (error) => toast.error(errorMessage(error, "Failed to remove post")),
  });
  const deleteComment = trpc.admin.deleteComment.useMutation({
    onSuccess: afterRemove,
    onError: (error) => toast.error(errorMessage(error, "Failed to remove comment")),
  });

  return (
    <Card className="border-border/50 mt-4">
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-500" />
          Pending Reports ({pendingCount.data?.count || 0})
        </CardTitle>
      </CardHeader>
      <CardContent>
        {reports.isLoading ? (
          <LoadingRows />
        ) : reports.data?.reports?.filter((r) => r.status === "pending").length === 0 ? (
          <div className="text-center py-8">
            <CheckCircle className="w-8 h-8 text-green-500/30 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">No pending reports</p>
          </div>
        ) : (
          <div className="space-y-3">
            {reports.data?.reports
              ?.filter((r) => r.status === "pending")
              .map((report) => (
                <div key={report.id} className="flex items-start gap-4 p-4 rounded-lg border border-border/50">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant="outline" className="text-[10px]">{report.reportableType}</Badge>
                      <span className="text-xs text-muted-foreground">ID: {report.reportableId}</span>
                    </div>
                    <p className="text-sm text-foreground mb-1">{report.reason}</p>
                    <p className="text-xs text-muted-foreground line-clamp-2 mb-1 border-l-2 border-border/60 pl-2">
                      {report.contentPreview ?? "Content no longer exists"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Reported by {report.reporterName || "Anonymous"} &middot; {new Date(report.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex gap-1 flex-wrap justify-end">
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-green-600 border-green-200 hover:bg-green-50"
                      onClick={() => resolveReport.mutate({ reportId: report.id, status: "resolved" })}
                    >
                      <CheckCircle className="w-3.5 h-3.5 mr-1" /> Resolve
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-red-600 border-red-200 hover:bg-red-50"
                      onClick={() => resolveReport.mutate({ reportId: report.id, status: "dismissed" })}
                    >
                      <XCircle className="w-3.5 h-3.5 mr-1" /> Dismiss
                    </Button>
                    {(report.reportableType === "post" || report.reportableType === "comment") && report.contentPreview !== null && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-red-600 border-red-200 hover:bg-red-50"
                        disabled={deletePost.isPending || deleteComment.isPending}
                        onClick={() =>
                          setConfirm({
                            title: `Remove this ${report.reportableType}?`,
                            description: report.reportableType === "post"
                              ? "The post, its comments and likes, its uploaded image and every report about it will be deleted. This can't be undone."
                              : "The comment and every report about it will be deleted. This can't be undone.",
                            actionLabel: "Remove content",
                            onConfirm: () =>
                              report.reportableType === "post"
                                ? deletePost.mutate({ id: report.reportableId })
                                : deleteComment.mutate({ id: report.reportableId }),
                          })
                        }
                      >
                        <Trash2 className="w-3.5 h-3.5 mr-1" /> Remove content
                      </Button>
                    )}
                  </div>
                </div>
              ))}
          </div>
        )}
      </CardContent>
      <ConfirmDialog state={confirm} onClose={() => setConfirm(null)} />
    </Card>
  );
}

function UsersTab({ currentUserId }: { currentUserId: number }) {
  const utils = trpc.useUtils();
  const [search, setSearch] = useState("");
  const [role, setRole] = useState("all");
  const [page, setPage] = useState(0);
  const [confirm, setConfirm] = useState<ConfirmState>(null);

  const users = trpc.admin.listUsers.useQuery({
    search: search.trim() || undefined,
    role: role !== "all" ? (role as (typeof ROLES)[number]) : undefined,
    limit: PAGE_SIZE,
    offset: page * PAGE_SIZE,
  });

  const setUserRole = trpc.admin.setUserRole.useMutation({
    onSuccess: () => {
      utils.admin.invalidate();
      toast.success("Role updated");
    },
    onError: (error) => toast.error(errorMessage(error, "Failed to change role")),
  });

  return (
    <Card className="border-border/50 mt-4">
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Users className="w-4 h-4 text-purple-500" /> Users
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-3 mb-4 flex-wrap">
          <SearchBox value={search} onChange={(v) => { setSearch(v); setPage(0); }} placeholder="Search name or email..." />
          <Select value={role} onValueChange={(v) => { setRole(v); setPage(0); }}>
            <SelectTrigger className="w-36 h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Roles</SelectItem>
              {ROLES.map((r) => <SelectItem key={r} value={r} className="capitalize">{r}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        {users.isLoading ? <LoadingRows /> : !users.data?.users.length ? <EmptyRows>No users found</EmptyRows> : (
          <div className="space-y-3">
            {users.data.users.map((u) => {
              const isSelf = u.id === currentUserId;
              return (
                <div key={u.id} className="flex items-center gap-4 p-4 rounded-lg border border-border/50">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-medium text-foreground text-sm truncate">{u.name || "Unnamed user"}</h3>
                      {isSelf && <Badge variant="secondary" className="text-[10px]">You</Badge>}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                      <span className="truncate">{u.email || "No email"}</span>
                      <span>Joined {formatDate(u.createdAt)}</span>
                      <span>Last seen {formatDate(u.lastSignedIn)}</span>
                    </div>
                  </div>
                  <Select
                    value={u.role}
                    disabled={isSelf || setUserRole.isPending}
                    onValueChange={(next) =>
                      setConfirm({
                        title: `Make ${u.name || "this user"} ${next === "admin" ? "an" : "a"} ${next}?`,
                        description: next === "admin"
                          ? "Admins can manage users, initiatives and organizations."
                          : next === "moderator"
                            ? "Moderators can resolve reports and delete posts and comments."
                            : "This removes any moderation or admin access.",
                        actionLabel: "Change role",
                        onConfirm: () => setUserRole.mutate({ userId: u.id, role: next as (typeof ROLES)[number] }),
                      })
                    }
                  >
                    <SelectTrigger className="w-32 h-9 capitalize"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {ROLES.map((r) => <SelectItem key={r} value={r} className="capitalize">{r}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              );
            })}
          </div>
        )}
        <Pager page={page} total={users.data?.total ?? 0} onPage={setPage} />
      </CardContent>
      <ConfirmDialog state={confirm} onClose={() => setConfirm(null)} />
    </Card>
  );
}

function EditInitiativeDialog({ initiative, onClose }: { initiative: InitiativeRow | null; onClose: () => void }) {
  const utils = trpc.useUtils();
  const [form, setForm] = useState<Record<string, string>>({});
  const value = (field: keyof InitiativeRow) => form[field] ?? String(initiative?.[field] ?? "");
  const set = (field: string) => (e: { target: { value: string } }) => setForm((prev) => ({ ...prev, [field]: e.target.value }));

  const update = trpc.initiatives.update.useMutation({
    onSuccess: () => {
      utils.initiatives.invalidate();
      utils.admin.invalidate();
      toast.success("Initiative updated");
      setForm({});
      onClose();
    },
    onError: (error) => toast.error(errorMessage(error, "Failed to update initiative")),
  });

  const title = value("title").trim();
  const description = value("description").trim();
  const link = value("registrationLink").trim();
  const invalid =
    title.length < 5 || title.length > 500 ||
    description.length < 20 || description.length > 10_000 ||
    (link !== "" && !/^https?:\/\//i.test(link));

  // Only send what was edited so untouched empty columns stay null.
  const save = () => {
    if (!initiative) return;
    const changes = Object.fromEntries(Object.entries(form).map(([field, v]) => [field, v.trim()]));
    update.mutate({ id: initiative.id, ...changes });
  };

  return (
    <Dialog open={!!initiative} onOpenChange={(open) => { if (!open) { setForm({}); onClose(); } }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Pencil className="w-4 h-4" /> Edit initiative</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div><Label className="mb-1 block">Title</Label><Input value={value("title")} onChange={set("title")} maxLength={500} /></div>
          <div><Label className="mb-1 block">Description</Label><Textarea value={value("description")} onChange={set("description")} maxLength={10_000} className="min-h-[100px]" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label className="mb-1 block">City</Label><Input value={value("city")} onChange={set("city")} maxLength={255} /></div>
            <div><Label className="mb-1 block">State</Label><Input value={value("state")} onChange={set("state")} maxLength={255} /></div>
          </div>
          <div><Label className="mb-1 block">Address</Label><Input value={value("address")} onChange={set("address")} maxLength={500} /></div>
          <div><Label className="mb-1 block">Registration link</Label><Input value={value("registrationLink")} onChange={set("registrationLink")} maxLength={500} placeholder="https://..." /></div>
          <div><Label className="mb-1 block">Contact info</Label><Input value={value("contactInfo")} onChange={set("contactInfo")} maxLength={2000} /></div>
          {invalid && (
            <p className="text-xs text-muted-foreground">
              Title needs 5–500 characters, description 20–10,000, and the link must start with http(s)://.
            </p>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => { setForm({}); onClose(); }}>Cancel</Button>
          <Button className="bg-jan-green hover:bg-jan-green-dark text-white" disabled={invalid || update.isPending || Object.keys(form).length === 0} onClick={save}>
            Save changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function InitiativesTab() {
  const utils = trpc.useUtils();
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [status, setStatus] = useState("all");
  const [verifiedFilter, setVerifiedFilter] = useState<"all" | "verified" | "unverified">("all");
  const [page, setPage] = useState(0);
  const [editing, setEditing] = useState<InitiativeRow | null>(null);
  const [confirm, setConfirm] = useState<ConfirmState>(null);
  const resetPage = <T,>(setter: (v: T) => void) => (v: T) => { setter(v); setPage(0); };

  const initiatives = trpc.initiatives.list.useQuery({
    search: search.trim() || undefined,
    category: (category !== "all" ? category : undefined) as any,
    status: status !== "all" ? (status as (typeof STATUSES)[number]) : undefined,
    verified: verifiedFilter === "verified" ? true : verifiedFilter === "unverified" ? false : undefined,
    limit: PAGE_SIZE,
    offset: page * PAGE_SIZE,
  });

  const updateInitiative = trpc.initiatives.update.useMutation({
    onSuccess: () => {
      utils.initiatives.invalidate();
      utils.admin.invalidate();
      toast.success("Initiative updated");
    },
    onError: (error) => toast.error(errorMessage(error, "Failed to update initiative")),
  });

  const deleteInitiative = trpc.admin.deleteInitiative.useMutation({
    onSuccess: () => {
      utils.initiatives.invalidate();
      utils.posts.invalidate();
      utils.admin.invalidate();
      toast.success("Initiative deleted");
    },
    onError: (error) => toast.error(errorMessage(error, "Failed to delete initiative")),
  });

  return (
    <Card className="border-border/50 mt-4">
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-blue-500" />
          Initiatives
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-3 mb-4 flex-wrap">
          <SearchBox value={search} onChange={resetPage(setSearch)} placeholder="Search initiatives..." />
          <Select value={category} onValueChange={resetPage(setCategory)}>
            <SelectTrigger className="w-36 h-9"><SelectValue placeholder="Category" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {CATEGORIES.map((cat) => <SelectItem key={cat} value={cat}>{cat}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={status} onValueChange={resetPage(setStatus)}>
            <SelectTrigger className="w-32 h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Any Status</SelectItem>
              {STATUSES.map((s) => <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={verifiedFilter} onValueChange={resetPage((v: any) => setVerifiedFilter(v))}>
            <SelectTrigger className="w-32 h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="verified">Verified</SelectItem>
              <SelectItem value="unverified">Unverified</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {initiatives.isLoading ? <LoadingRows /> : !initiatives.data?.initiatives.length ? <EmptyRows>No initiatives match these filters</EmptyRows> : (
          <div className="space-y-3">
            {initiatives.data.initiatives.map((init) => (
              <div key={init.id} className="flex items-center gap-4 p-4 rounded-lg border border-border/50 flex-wrap">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-medium text-foreground text-sm truncate">{init.title}</h3>
                    {init.verified && (
                      <Badge variant="secondary" className="text-[10px] flex-shrink-0">
                        <ShieldCheck className="w-2.5 h-2.5 mr-0.5" /> Verified
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <MapPin className="w-3 h-3" /> {init.city || "N/A"}
                    </span>
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {init.startDate ? new Date(init.startDate).toLocaleDateString("en-IN", { month: "short", day: "numeric" }) : "N/A"}
                    </span>
                    <Badge variant="outline" className="text-[10px]">{init.category}</Badge>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Select
                    value={init.status}
                    disabled={updateInitiative.isPending}
                    onValueChange={(next) => updateInitiative.mutate({ id: init.id, status: next as (typeof STATUSES)[number] })}
                  >
                    <SelectTrigger className="w-32 h-9 capitalize"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {STATUSES.map((s) => <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Button
                    size="sm"
                    variant={init.verified ? "outline" : "default"}
                    className={init.verified ? "text-muted-foreground border-border" : "bg-jan-green hover:bg-jan-green-dark text-white"}
                    onClick={() => updateInitiative.mutate({ id: init.id, verified: !init.verified })}
                    disabled={updateInitiative.isPending}
                  >
                    {init.verified ? "Unverify" : "Verify"}
                  </Button>
                  <Button size="sm" variant="outline" aria-label={`Edit ${init.title}`} onClick={() => setEditing(init)}>
                    <Pencil className="w-3.5 h-3.5" />
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-red-600 border-red-200 hover:bg-red-50"
                    aria-label={`Delete ${init.title}`}
                    disabled={deleteInitiative.isPending}
                    onClick={() =>
                      setConfirm({
                        title: "Delete this initiative?",
                        description: `"${init.title}" will be removed with its bookmarks and reports. Community posts about it stay, without the link. This can't be undone.`,
                        actionLabel: "Delete initiative",
                        onConfirm: () => deleteInitiative.mutate({ id: init.id }),
                      })
                    }
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
        <Pager page={page} total={initiatives.data?.total ?? 0} onPage={setPage} />
      </CardContent>
      <EditInitiativeDialog initiative={editing} onClose={() => setEditing(null)} />
      <ConfirmDialog state={confirm} onClose={() => setConfirm(null)} />
    </Card>
  );
}

function ContentTab() {
  const utils = trpc.useUtils();
  const [view, setView] = useState<"posts" | "comments">("posts");
  const [postSearch, setPostSearch] = useState("");
  const [commentSearch, setCommentSearch] = useState("");
  const [postFilter, setPostFilter] = useState<number | null>(null);
  const [postPage, setPostPage] = useState(0);
  const [commentPage, setCommentPage] = useState(0);
  const [confirm, setConfirm] = useState<ConfirmState>(null);

  const postsQuery = trpc.admin.listPosts.useQuery(
    { search: postSearch.trim() || undefined, limit: PAGE_SIZE, offset: postPage * PAGE_SIZE },
    { enabled: view === "posts" }
  );
  const commentsQuery = trpc.admin.listComments.useQuery(
    { search: commentSearch.trim() || undefined, postId: postFilter ?? undefined, limit: PAGE_SIZE, offset: commentPage * PAGE_SIZE },
    { enabled: view === "comments" }
  );

  const afterDelete = (label: string) => () => {
    utils.admin.invalidate();
    utils.posts.invalidate();
    toast.success(`${label} deleted`);
  };
  const deletePost = trpc.admin.deletePost.useMutation({
    onSuccess: afterDelete("Post"),
    onError: (error) => toast.error(errorMessage(error, "Failed to delete post")),
  });
  const deleteComment = trpc.admin.deleteComment.useMutation({
    onSuccess: afterDelete("Comment"),
    onError: (error) => toast.error(errorMessage(error, "Failed to delete comment")),
  });

  return (
    <Card className="border-border/50 mt-4">
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <MessageCircle className="w-4 h-4 text-green-600" /> Posts and comments
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs value={view} onValueChange={(v) => setView(v as "posts" | "comments")}>
          <TabsList>
            <TabsTrigger value="posts">Posts</TabsTrigger>
            <TabsTrigger value="comments">Comments</TabsTrigger>
          </TabsList>

          <TabsContent value="posts" className="mt-4">
            <div className="flex items-center gap-3 mb-4">
              <SearchBox value={postSearch} onChange={(v) => { setPostSearch(v); setPostPage(0); }} placeholder="Search posts..." />
            </div>
            {postsQuery.isLoading ? <LoadingRows /> : !postsQuery.data?.posts.length ? <EmptyRows>No posts found</EmptyRows> : (
              <div className="space-y-3">
                {postsQuery.data.posts.map((post) => (
                  <div key={post.id} className="flex items-start gap-4 p-4 rounded-lg border border-border/50">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-foreground line-clamp-2 mb-1">{post.content}</p>
                      <p className="text-xs text-muted-foreground">
                        {post.userName || "Unknown"} &middot; {formatDate(post.createdAt)} &middot; {post.likeCount} likes &middot; {post.commentCount} comments
                        {post.initiativeTitle && <> &middot; on {post.initiativeTitle}</>}
                        {post.mediaUrl && <> &middot; has image</>}
                      </p>
                    </div>
                    <div className="flex gap-1">
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={post.commentCount === 0}
                        onClick={() => { setPostFilter(post.id); setCommentPage(0); setView("comments"); }}
                      >
                        Comments
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-red-600 border-red-200 hover:bg-red-50"
                        aria-label="Delete post"
                        disabled={deletePost.isPending}
                        onClick={() =>
                          setConfirm({
                            title: "Delete this post?",
                            description: `The post, its ${post.commentCount} comment(s), its likes, any reports about it${post.mediaUrl ? " and its uploaded image" : ""} will be removed. This can't be undone.`,
                            actionLabel: "Delete post",
                            onConfirm: () => deletePost.mutate({ id: post.id }),
                          })
                        }
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <Pager page={postPage} total={postsQuery.data?.total ?? 0} onPage={setPostPage} />
          </TabsContent>

          <TabsContent value="comments" className="mt-4">
            <div className="flex items-center gap-3 mb-4 flex-wrap">
              <SearchBox value={commentSearch} onChange={(v) => { setCommentSearch(v); setCommentPage(0); }} placeholder="Search comments..." />
              {postFilter && (
                <Button size="sm" variant="outline" onClick={() => { setPostFilter(null); setCommentPage(0); }}>
                  Post #{postFilter} <XCircle className="w-3.5 h-3.5 ml-1" />
                </Button>
              )}
            </div>
            {commentsQuery.isLoading ? <LoadingRows /> : !commentsQuery.data?.comments.length ? <EmptyRows>No comments found</EmptyRows> : (
              <div className="space-y-3">
                {commentsQuery.data.comments.map((comment) => (
                  <div key={comment.id} className="flex items-start gap-4 p-4 rounded-lg border border-border/50">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-foreground line-clamp-2 mb-1">{comment.content}</p>
                      <p className="text-xs text-muted-foreground">
                        {comment.userName || "Unknown"} &middot; on post #{comment.postId} &middot; {formatDate(comment.createdAt)}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-red-600 border-red-200 hover:bg-red-50"
                      aria-label="Delete comment"
                      disabled={deleteComment.isPending}
                      onClick={() =>
                        setConfirm({
                          title: "Delete this comment?",
                          description: "The comment and any reports about it will be removed. This can't be undone.",
                          actionLabel: "Delete comment",
                          onConfirm: () => deleteComment.mutate({ id: comment.id }),
                        })
                      }
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
            <Pager page={commentPage} total={commentsQuery.data?.total ?? 0} onPage={setCommentPage} />
          </TabsContent>
        </Tabs>
      </CardContent>
      <ConfirmDialog state={confirm} onClose={() => setConfirm(null)} />
    </Card>
  );
}

function EditOrganizationDialog({ organization, onClose }: { organization: OrganizationRow | null; onClose: () => void }) {
  const utils = trpc.useUtils();
  const [form, setForm] = useState<Record<string, string>>({});
  // The list omits the phone number, so load the full record for the form.
  const details = trpc.organizations.getById.useQuery({ id: organization?.id ?? 0 }, { enabled: !!organization });
  const source = (details.data ?? organization) as Record<string, unknown> | null;
  const value = (field: string) => form[field] ?? String(source?.[field] ?? "");
  const set = (field: string) => (e: { target: { value: string } }) => setForm((prev) => ({ ...prev, [field]: e.target.value }));

  const update = trpc.organizations.update.useMutation({
    onSuccess: () => {
      utils.organizations.invalidate();
      utils.admin.invalidate();
      toast.success("Organization updated");
      setForm({});
      onClose();
    },
    onError: (error) => toast.error(errorMessage(error, "Failed to update organization")),
  });

  const name = value("name").trim();
  const website = value("website").trim();
  const logoUrl = value("logoUrl").trim();
  const invalid =
    name.length < 2 || name.length > 255 ||
    (website !== "" && !/^https?:\/\//i.test(website)) ||
    (logoUrl !== "" && !/^(https?:\/\/|\/media\/)/i.test(logoUrl));

  const close = () => { setForm({}); onClose(); };

  return (
    <Dialog open={!!organization} onOpenChange={(open) => !open && close()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Pencil className="w-4 h-4" /> Edit organization</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div><Label className="mb-1 block">Name</Label><Input value={value("name")} onChange={set("name")} maxLength={255} /></div>
          <div><Label className="mb-1 block">Description</Label><Textarea value={value("description")} onChange={set("description")} maxLength={5000} className="min-h-[90px]" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label className="mb-1 block">Contact email</Label><Input value={value("contactEmail")} onChange={set("contactEmail")} maxLength={320} /></div>
            <div><Label className="mb-1 block">Contact phone</Label><Input value={value("contactPhone")} onChange={set("contactPhone")} maxLength={64} /></div>
          </div>
          <div><Label className="mb-1 block">Website</Label><Input value={value("website")} onChange={set("website")} maxLength={500} placeholder="https://..." /></div>
          <div><Label className="mb-1 block">Logo URL</Label><Input value={value("logoUrl")} onChange={set("logoUrl")} maxLength={2000} placeholder="https://..." /></div>
          {invalid && (
            <p className="text-xs text-muted-foreground">Name needs 2–255 characters; website and logo must start with http(s)://.</p>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={close}>Cancel</Button>
          <Button
            className="bg-jan-green hover:bg-jan-green-dark text-white"
            disabled={invalid || update.isPending || !organization || Object.keys(form).length === 0}
            onClick={() =>
              organization &&
              update.mutate({
                id: organization.id,
                // Only send what was edited so untouched empty columns stay null.
                ...Object.fromEntries(Object.entries(form).map(([field, v]) => [field, v.trim()])),
              })
            }
          >
            Save changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function OrganizationsTab() {
  const utils = trpc.useUtils();
  const [page, setPage] = useState(0);
  const [editing, setEditing] = useState<OrganizationRow | null>(null);
  const organizations = trpc.organizations.list.useQuery({ limit: PAGE_SIZE, offset: page * PAGE_SIZE });

  const update = trpc.organizations.update.useMutation({
    onSuccess: () => {
      utils.organizations.invalidate();
      utils.admin.invalidate();
      toast.success("Organization updated");
    },
    onError: (error) => toast.error(errorMessage(error, "Failed to update organization")),
  });

  return (
    <Card className="border-border/50 mt-4">
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Building2 className="w-4 h-4 text-blue-600" /> Organizations
        </CardTitle>
      </CardHeader>
      <CardContent>
        {organizations.isLoading ? <LoadingRows /> : !organizations.data?.organizations.length ? <EmptyRows>No organizations yet</EmptyRows> : (
          <div className="space-y-3">
            {organizations.data.organizations.map((org) => (
              <div key={org.id} className="flex items-center gap-4 p-4 rounded-lg border border-border/50">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-medium text-foreground text-sm truncate">{org.name}</h3>
                    {org.verified && (
                      <Badge variant="secondary" className="text-[10px] flex-shrink-0">
                        <ShieldCheck className="w-2.5 h-2.5 mr-0.5" /> Verified
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span>{org.initiativeCount} initiatives</span>
                    {org.contactEmail && <span className="truncate">{org.contactEmail}</span>}
                  </div>
                </div>
                <Button
                  size="sm"
                  variant={org.verified ? "outline" : "default"}
                  className={org.verified ? "text-muted-foreground border-border" : "bg-jan-green hover:bg-jan-green-dark text-white"}
                  onClick={() => update.mutate({ id: org.id, verified: !org.verified })}
                  disabled={update.isPending}
                >
                  {org.verified ? "Unverify" : "Verify"}
                </Button>
                <Button size="sm" variant="outline" aria-label={`Edit ${org.name}`} onClick={() => setEditing(org)}>
                  <Pencil className="w-3.5 h-3.5" />
                </Button>
              </div>
            ))}
          </div>
        )}
        <Pager page={page} total={organizations.data?.total ?? 0} onPage={setPage} />
      </CardContent>
      <EditOrganizationDialog organization={editing} onClose={() => setEditing(null)} />
    </Card>
  );
}

export default function Admin() {
  const { user, isAuthenticated } = useAuth();
  const isAdmin = user?.role === "admin";
  const isModerator = user?.role === "moderator";
  const canModerate = isAuthenticated && (isAdmin || isModerator);

  const pendingCount = trpc.admin.getPendingCount.useQuery(undefined, { enabled: canModerate });
  const stats = trpc.admin.getStats.useQuery(undefined, { enabled: canModerate });

  if (!canModerate || !user) {
    return (
      <div className="container py-20 text-center">
        <Shield className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
        <h1 className="font-display text-xl font-bold text-foreground mb-2">
          Admin Access Required
        </h1>
        <p className="text-muted-foreground">This page is only accessible to administrators.</p>
      </div>
    );
  }

  // Moderators only see the tabs whose procedures they are allowed to call.
  const tabs = [
    { value: "overview", label: "Overview", adminOnly: false },
    { value: "reports", label: "Reports", adminOnly: false },
    { value: "users", label: "Users", adminOnly: true },
    { value: "initiatives", label: "Initiatives", adminOnly: true },
    { value: "content", label: "Posts & Comments", adminOnly: false },
    { value: "organizations", label: "Organizations", adminOnly: true },
  ].filter((tab) => isAdmin || !tab.adminOnly);

  return (
    <div className="container py-8 max-w-5xl">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-jan-green/10 flex items-center justify-center">
            <Shield className="w-5 h-5 text-jan-green" />
          </div>
          <div>
            <h1 className="font-display text-xl font-bold text-foreground">{isAdmin ? "Admin Panel" : "Moderator Panel"}</h1>
            <p className="text-sm text-muted-foreground">
              {isAdmin ? "Platform governance and moderation" : "Community moderation"}
            </p>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {[
            { label: "Initiatives", value: stats.data?.initiatives || 0, icon: Building2, color: "text-blue-600" },
            { label: "Posts", value: stats.data?.posts || 0, icon: FileText, color: "text-green-600" },
            { label: "Users", value: stats.data?.users || 0, icon: Users, color: "text-purple-600" },
            { label: "Pending Reports", value: pendingCount.data?.count || 0, icon: AlertTriangle, color: "text-amber-600" },
          ].map((stat) => (
            <Card key={stat.label} className="border-border/50">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <stat.icon className={`w-5 h-5 ${stat.color}`} />
                  <div>
                    <div className="text-2xl font-display font-bold text-foreground">{stat.value}</div>
                    <div className="text-xs text-muted-foreground">{stat.label}</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <Tabs defaultValue="overview">
          <TabsList className="h-auto flex-wrap">
            {tabs.map((tab) => (
              <TabsTrigger key={tab.value} value={tab.value}>
                {tab.value === "overview" && <Activity className="w-3.5 h-3.5 mr-1" />}
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value="overview"><OverviewTab /></TabsContent>
          <TabsContent value="reports"><ReportsTab /></TabsContent>
          <TabsContent value="content"><ContentTab /></TabsContent>
          {isAdmin && (
            <>
              <TabsContent value="users"><UsersTab currentUserId={user.id} /></TabsContent>
              <TabsContent value="initiatives"><InitiativesTab /></TabsContent>
              <TabsContent value="organizations"><OrganizationsTab /></TabsContent>
            </>
          )}
        </Tabs>
      </motion.div>
    </div>
  );
}
