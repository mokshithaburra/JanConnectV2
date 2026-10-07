import { useState } from "react";
import { motion } from "framer-motion";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import {
  Shield, AlertTriangle, CheckCircle, XCircle,
  Users, FileText, Building2,
  ShieldCheck, Search, MapPin, Calendar,
} from "lucide-react";

export default function Admin() {
  const { user, isAuthenticated } = useAuth();

  const reports = trpc.admin.listReports.useQuery({ limit: 20 });
  const pendingCount = trpc.admin.getPendingCount.useQuery();
  const stats = trpc.admin.getStats.useQuery();

  const resolveReport = trpc.admin.resolveReport.useMutation({
    onSuccess: () => {
      reports.refetch();
      pendingCount.refetch();
      toast.success("Report resolved");
    },
  });

  // Verification management
  const [verifySearch, setVerifySearch] = useState("");
  const [verifyCategory, setVerifyCategory] = useState("all");
  const [verifyFilter, setVerifyFilter] = useState<"all" | "verified" | "unverified">("all");

  const initiatives = trpc.initiatives.list.useQuery({
    search: verifySearch || undefined,
    category: (verifyCategory !== "all" ? verifyCategory : undefined) as any,
    verified: verifyFilter === "verified" ? true : verifyFilter === "unverified" ? false : undefined,
    limit: 20,
  });

  const updateInitiative = trpc.initiatives.update.useMutation({
    onSuccess: () => {
      initiatives.refetch();
      toast.success("Initiative updated");
    },
    onError: () => toast.error("Failed to update initiative"),
  });

  if (!isAuthenticated || user?.role !== "admin") {
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

  const CATEGORIES = [
    "Environment", "Education", "Healthcare", "Blood Donation",
    "Animal Welfare", "Disaster Relief", "Community Service",
    "Awareness Campaigns", "Public Consultations",
  ];

  return (
    <div className="container py-8 max-w-5xl">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-jan-green/10 flex items-center justify-center">
            <Shield className="w-5 h-5 text-jan-green" />
          </div>
          <div>
            <h1 className="font-display text-xl font-bold text-foreground">Admin Panel</h1>
            <p className="text-sm text-muted-foreground">Platform governance and moderation</p>
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

        {/* Tabs */}
        <Tabs defaultValue="reports">
          <TabsList>
            <TabsTrigger value="reports">Reports</TabsTrigger>
            <TabsTrigger value="verification">Verification</TabsTrigger>
          </TabsList>

          {/* Reports Management */}
          <TabsContent value="reports">
            <Card className="border-border/50 mt-4">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-500" />
                  Pending Reports ({pendingCount.data?.count || 0})
                </CardTitle>
              </CardHeader>
              <CardContent>
                {reports.isLoading ? (
                  <div className="space-y-3">
                    {Array.from({ length: 3 }).map((_, i) => (
                      <div key={i} className="h-16 bg-muted animate-pulse rounded-lg" />
                    ))}
                  </div>
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
                            <p className="text-xs text-muted-foreground">
                              Reported by {report.reporterName || "Anonymous"} &middot; {new Date(report.createdAt).toLocaleDateString()}
                            </p>
                          </div>
                          <div className="flex gap-1">
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
                          </div>
                        </div>
                      ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Verification Management */}
          <TabsContent value="verification">
            <Card className="border-border/50 mt-4">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-blue-500" />
                  Initiative Verification
                </CardTitle>
              </CardHeader>
              <CardContent>
                {/* Filters */}
                <div className="flex items-center gap-3 mb-4 flex-wrap">
                  <div className="relative flex-1 max-w-xs">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      placeholder="Search initiatives..."
                      value={verifySearch}
                      onChange={(e) => setVerifySearch(e.target.value)}
                      className="pl-9 h-9"
                    />
                  </div>
                  <Select value={verifyCategory} onValueChange={setVerifyCategory}>
                    <SelectTrigger className="w-36 h-9">
                      <SelectValue placeholder="Category" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Categories</SelectItem>
                      {CATEGORIES.map((cat) => (
                        <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={verifyFilter} onValueChange={(v: any) => setVerifyFilter(v)}>
                    <SelectTrigger className="w-32 h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Status</SelectItem>
                      <SelectItem value="verified">Verified</SelectItem>
                      <SelectItem value="unverified">Unverified</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {initiatives.isLoading ? (
                  <div className="space-y-3">
                    {Array.from({ length: 3 }).map((_, i) => (
                      <div key={i} className="h-16 bg-muted animate-pulse rounded-lg" />
                    ))}
                  </div>
                ) : (
                  <div className="space-y-3">
                    {initiatives.data?.initiatives?.map((init) => (
                      <div key={init.id} className="flex items-center gap-4 p-4 rounded-lg border border-border/50">
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
                        <Button
                          size="sm"
                          variant={init.verified ? "outline" : "default"}
                          className={init.verified ? "text-muted-foreground border-border" : "bg-jan-green hover:bg-jan-green-dark text-white"}
                          onClick={() => updateInitiative.mutate({ id: init.id, verified: !init.verified })}
                          disabled={updateInitiative.isPending}
                        >
                          {init.verified ? "Unverify" : "Verify"}
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </motion.div>
    </div>
  );
}
