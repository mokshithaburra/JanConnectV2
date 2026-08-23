import { useEffect } from "react";
import { motion } from "framer-motion";
import { useRoute, Link, useRouter } from "wouter";
import { trpc } from "@/lib/trpc";
import { getCivicVisual } from "@/lib/civicVisuals";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import {
  MapPin, Calendar, Users, Clock, Phone, ExternalLink,
  ArrowLeft, Bookmark, CheckCircle, TreePine, GraduationCap,
  Heart, Droplets, PawPrint, AlertTriangle, HandHeart,
  Megaphone, MessageCircle, Share2, Building2,
} from "lucide-react";

const categoryIcons: Record<string, React.ElementType> = {
  Environment: TreePine, Education: GraduationCap, Healthcare: Heart,
  "Blood Donation": Droplets, "Animal Welfare": PawPrint,
  "Disaster Relief": AlertTriangle, "Community Service": HandHeart,
  "Awareness Campaigns": Megaphone, "Public Consultations": MessageCircle,
};

const categoryColors: Record<string, string> = {
  Environment: "bg-jan-green/10 text-jan-green border border-jan-green/20",
  Education: "bg-sky-400/10 text-sky-300 border border-sky-400/20",
  Healthcare: "bg-rose-400/10 text-rose-300 border border-rose-400/20",
  "Blood Donation": "bg-red-400/10 text-red-300 border border-red-400/20",
  "Animal Welfare": "bg-amber-400/10 text-amber-300 border border-amber-400/20",
  "Disaster Relief": "bg-orange-400/10 text-orange-300 border border-orange-400/20",
  "Community Service": "bg-purple-400/10 text-purple-300 border border-purple-400/20",
  "Awareness Campaigns": "bg-indigo-400/10 text-indigo-300 border border-indigo-400/20",
  "Public Consultations": "bg-cyan-400/10 text-cyan-300 border border-cyan-400/20",
};

export default function InitiativeDetail() {
  const [, params] = useRoute<{ id: string }>("/initiative/:id");
  const router = useRouter();
  const { isAuthenticated } = useAuth();
  const id = parseInt(params?.id || "0");

  const { data: initiative, isLoading, error } = trpc.initiatives.getById.useQuery(
    { id },
    { enabled: !!id }
  );
  const { data: related } = trpc.initiatives.getRelated.useQuery(
    { id, limit: 4 },
    { enabled: !!id }
  );
  const { data: communityPosts } = trpc.posts.listByInitiative.useQuery(
    { initiativeId: id, limit: 20 },
    { enabled: !!id }
  );
  const isBookmarked = trpc.initiatives.getBookmarkStatus.useQuery(
    { initiativeId: id },
    { enabled: !!id && isAuthenticated }
  );
  const toggleBookmark = trpc.initiatives.toggleBookmark.useMutation({
    onSuccess: (data) => {
      toast.success(data.bookmarked ? "Bookmarked!" : "Bookmark removed");
    },
  });

  if (!params?.id) {
    return (
      <div className="container py-12 text-center">
        <p className="text-muted-foreground">Initiative not found</p>
        <Link href="/explore">
          <Button variant="ghost" className="mt-4">
            <ArrowLeft className="w-4 h-4 mr-2" /> Back to Explore
          </Button>
        </Link>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="container py-12">
        <div className="h-6 bg-muted animate-pulse rounded w-1/3 mb-4" />
        <div className="h-4 bg-muted animate-pulse rounded w-full mb-2" />
        <div className="h-4 bg-muted animate-pulse rounded w-3/4 mb-2" />
        <div className="h-4 bg-muted animate-pulse rounded w-1/2" />
      </div>
    );
  }

  if (error || !initiative) {
    return (
      <div className="container py-12 text-center">
        <h2 className="font-display text-xl font-bold text-foreground mb-2">
          Initiative Not Found
        </h2>
        <p className="text-muted-foreground mb-4">This initiative may have been removed.</p>
        <Link href="/explore">
          <Button variant="ghost">
            <ArrowLeft className="w-4 h-4 mr-2" /> Back to Explore
          </Button>
        </Link>
      </div>
    );
  }

  const Icon = categoryIcons[initiative.category] || MapPin;
  const visual = getCivicVisual(initiative.category, initiative.id);

  return (
    <div className="container py-8 max-w-4xl">
      {/* Breadcrumb */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center gap-2 mb-6"
      >
        <Link href="/explore">
          <Button variant="ghost" size="sm" className="btn-press">
            <ArrowLeft className="w-4 h-4 mr-1" /> Explore
          </Button>
        </Link>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.35 }}
        className="relative mb-6 overflow-hidden rounded-3xl border border-border/50"
      >
        <img src={initiative.imageUrl || visual.src} alt={initiative.imageUrl ? initiative.title : visual.alt} className="h-48 w-full object-cover opacity-80 md:h-64" />
        <div className={`absolute inset-0 bg-gradient-to-t ${visual.tint} from-[#0b1716]/95 via-[#0b1716]/10 to-transparent`} />
        <div className="absolute bottom-4 left-4 flex items-center gap-2 rounded-full border border-white/10 bg-black/25 px-3 py-1.5 text-xs text-white/80 backdrop-blur">
          <span className="h-2 w-2 rounded-full bg-jan-green shadow-[0_0_10px_rgba(84,217,155,0.9)]" />
          {initiative.city || "India"} civic signal
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 mb-6">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-3">
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${categoryColors[initiative.category]}`}>
                <Icon className="w-6 h-6" />
              </div>
              <div>
                <span className="text-xs font-medium text-muted-foreground">{initiative.category}</span>
                <div className="flex items-center gap-2">
                  {initiative.verified && (
                    <Badge variant="secondary" className="text-[10px]">
                      <CheckCircle className="w-3 h-3 mr-1" /> Verified
                    </Badge>
                  )}
                  <Badge variant="outline" className={`text-[10px] ${
                    initiative.status === "ongoing" ? "text-green-600 border-green-200 bg-green-50" :
                    initiative.status === "upcoming" ? "text-blue-600 border-blue-200 bg-blue-50" :
                    "text-muted-foreground"
                  }`}>
                    {initiative.status}
                  </Badge>
                </div>
              </div>
            </div>
            <h1 className="font-display text-2xl md:text-3xl font-bold text-foreground leading-tight mb-2">
              {initiative.title}
            </h1>
          </div>

          {isAuthenticated && (
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="icon"
                onClick={() => toggleBookmark.mutate({ initiativeId: id })}
                className={isBookmarked.data?.bookmarked ? "bg-jan-green/10 text-jan-green border-jan-green/30" : ""}
              >
                <Bookmark className="w-4 h-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={() => {
                  navigator.clipboard.writeText(window.location.href);
                  toast.success("Link copied!");
                }}
              >
                <Share2 className="w-4 h-4" />
              </Button>
            </div>
          )}
        </div>

        {/* Description */}
        <p className="text-muted-foreground leading-relaxed mb-8 text-base">
          {initiative.description}
        </p>

        <div className="grid md:grid-cols-3 gap-6 mb-8">
          {/* Details Card */}
          <Card className="border-border/50 md:col-span-2">
            <CardContent className="p-6">
              <h2 className="font-display text-lg font-bold text-foreground mb-4">Details</h2>
              <div className="space-y-4">
                {initiative.startDate && (
                  <div className="flex items-start gap-3">
                    <Calendar className="w-5 h-5 text-jan-green mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-foreground">Date & Time</p>
                      <p className="text-sm text-muted-foreground">
                        {new Date(initiative.startDate).toLocaleDateString("en-IN", {
                          weekday: "long", year: "numeric", month: "long", day: "numeric",
                        })}
                        {initiative.endDate && initiative.endDate.getTime() !== initiative.startDate.getTime() && (
                          <span> — {new Date(initiative.endDate).toLocaleDateString("en-IN", {
                            month: "long", day: "numeric",
                          })}</span>
                        )}
                      </p>
                    </div>
                  </div>
                )}
                {(initiative.address || initiative.city) && (
                  <div className="flex items-start gap-3">
                    <MapPin className="w-5 h-5 text-jan-green mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-foreground">Location</p>
                      <p className="text-sm text-muted-foreground">
                        {initiative.address}{initiative.city && `, ${initiative.city}`}{initiative.state && `, ${initiative.state}`}
                      </p>
                    </div>
                  </div>
                )}
                {initiative.participantCount > 0 && (
                  <div className="flex items-start gap-3">
                    <Users className="w-5 h-5 text-jan-green mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-foreground">Participants</p>
                      <p className="text-sm text-muted-foreground">{initiative.participantCount} volunteers</p>
                    </div>
                  </div>
                )}
                {initiative.contactInfo && (
                  <div className="flex items-start gap-3">
                    <Phone className="w-5 h-5 text-jan-green mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-foreground">Contact</p>
                      <p className="text-sm text-muted-foreground">{initiative.contactInfo}</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Actions */}
              <Separator className="my-6" />
              <div className="flex flex-wrap gap-3">
                <Link href={`/community?initiativeId=${initiative.id}`}>
                  <Button variant="outline" className="btn-press border-jan-teal/30 text-jan-teal hover:bg-jan-teal/10">
                    <MessageCircle className="mr-2 h-4 w-4" />
                    {communityPosts?.total || 0} community posts
                  </Button>
                </Link>
                {initiative.registrationLink && (
                  <a href={initiative.registrationLink} target="_blank" rel="noopener noreferrer">
                    <Button className="bg-jan-green hover:bg-jan-green-dark text-white btn-press">
                      Register / Sign Up
                      <ExternalLink className="w-4 h-4 ml-2" />
                    </Button>
                  </a>
                )}
                {initiative.latitude && initiative.longitude && (
                  <a
                    href={`https://www.google.com/maps/dir/?api=1&destination=${initiative.latitude},${initiative.longitude}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <Button variant="outline" className="btn-press">
                      <MapPin className="w-4 h-4 mr-2" />
                      Get Directions
                    </Button>
                  </a>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Organizer Card */}
          <Card className="border-border/50">
            <CardContent className="p-6">
              <h2 className="font-display text-lg font-bold text-foreground mb-4">Organizer</h2>
                    {initiative.organizationId ? (
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center">
                          <Building2 className="w-6 h-6 text-muted-foreground" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-foreground">{initiative.organizationName || "Organization"}</p>
                          <p className="text-xs text-muted-foreground">{initiative.category} Initiatives</p>
                        </div>
                      </div>
                    ) : (
                <div className="text-sm text-muted-foreground">
                  <p>Organizer details not available</p>
                </div>
              )}
              {initiative.createdAt && (
                <div className="mt-4 pt-4 border-t border-border/30">
                  <p className="text-xs text-muted-foreground">
                    Listed {new Date(initiative.createdAt).toLocaleDateString("en-IN", { month: "long", day: "numeric", year: "numeric" })}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Community context */}
        <Card className="mt-8 border-jan-teal/20 bg-gradient-to-r from-jan-teal/10 via-card to-card">
          <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-jan-teal/15 text-jan-teal"><MessageCircle className="h-5 w-5" /></div>
              <div>
                <h2 className="font-display text-base font-semibold text-foreground">What is the community saying?</h2>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">Open posts connected to this initiative to read local context, updates, and citizen experiences.</p>
              </div>
            </div>
            <Link href={`/community?initiativeId=${initiative.id}`}>
              <Button className="w-full bg-jan-teal text-[#08201e] hover:bg-jan-teal/90 sm:w-auto btn-press">Open discussion <ExternalLink className="ml-2 h-4 w-4" /></Button>
            </Link>
          </CardContent>
        </Card>

        {/* Related Initiatives */}
        {related && related.length > 0 && (
          <div className="mt-8">
            <h2 className="font-display text-lg font-bold text-foreground mb-4">Related Initiatives</h2>
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
              {related.map((rel) => (
                <Link key={rel.id} href={`/initiative/${rel.id}`}>
                  <Card className="border-border/50 hover:border-jan-green/30 hover:shadow-md transition-all duration-200 cursor-pointer">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-xs font-medium text-muted-foreground">{rel.category}</span>
                      </div>
                      <h3 className="text-sm font-semibold text-foreground leading-snug line-clamp-2 mb-1">
                        {rel.title}
                      </h3>
                      <p className="text-xs text-muted-foreground">{rel.city}</p>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
}
