import { useMemo } from "react";
import { motion } from "framer-motion";
import { Link } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { startLogin } from "@/const";
import { trpc } from "@/lib/trpc";
import { getCivicBadges, getCivicVisual, getNextBadge, calculateImpactRadius } from "@/lib/civicVisuals";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  User, MapPin, Award, Settings, LogOut, Bookmark, TrendingUp, Loader2,
  Compass, MessageCircle, Sparkles, Sprout, Radio, ArrowUpRight, LockKeyhole,
} from "lucide-react";

const badgeIcons = {
  seedling: Sprout,
  compass: Compass,
  voice: Radio,
  spark: Sparkles,
} as const;

function ImpactRadiusGraphic({ radiusKm, places }: { radiusKm: number; places: number }) {
  const displayRadius = radiusKm > 0 ? `${radiusKm} km` : "—";
  return (
    <div
      className="relative aspect-square min-h-[260px] overflow-hidden rounded-2xl border border-jan-green/20 bg-[#0d2422]"
      aria-label={`Impact radius ${displayRadius} calculated from ${places} saved initiatives`}
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(84,217,155,0.14),transparent_45%)]" />
      <div className="absolute inset-5 rounded-full border border-jan-green/10" />
      <div className="absolute inset-12 rounded-full border border-jan-teal/20" />
      <div className="absolute inset-[28%] rounded-full border border-jan-green/30 bg-jan-green/5" />
      <div className="absolute left-[17%] top-[26%] h-2 w-2 rounded-full bg-jan-green shadow-[0_0_16px_rgba(84,217,155,0.9)]" />
      <div className="absolute right-[20%] top-[38%] h-2 w-2 rounded-full bg-jan-teal shadow-[0_0_16px_rgba(99,215,220,0.9)]" />
      <div className="absolute left-[34%] bottom-[22%] h-2 w-2 rounded-full bg-jan-amber shadow-[0_0_16px_rgba(255,199,100,0.85)]" />
      <svg className="absolute inset-0 h-full w-full" viewBox="0 0 300 300" aria-hidden="true">
        <circle cx="150" cy="150" r="112" fill="none" stroke="rgba(84,217,155,0.08)" strokeDasharray="2 9" />
        <circle cx="150" cy="150" r="77" fill="none" stroke="rgba(99,215,220,0.14)" strokeDasharray="1 8" />
        <path d="M32 186C76 134 105 168 140 122S212 90 268 121" fill="none" stroke="rgba(84,217,155,0.2)" strokeWidth="1.5" />
        <path d="M42 82C91 103 101 81 132 96S205 168 258 204" fill="none" stroke="rgba(99,215,220,0.16)" strokeWidth="1" />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        <MapPin className="mb-2 h-5 w-5 text-jan-green" />
        <span className="font-display text-4xl font-semibold text-white">{displayRadius}</span>
        <span className="mt-1 font-subheading text-xs text-white/55">impact radius</span>
      </div>
      <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-[10px] text-white/60 backdrop-blur">
        <span>{places} saved place{places === 1 ? "" : "s"}</span>
        <span className="text-jan-green">live activity map</span>
      </div>
    </div>
  );
}

export default function Profile() {
  const { user, loading, isAuthenticated, logout } = useAuth();
  const profile = trpc.profiles.me.useQuery(undefined, { enabled: isAuthenticated });
  const profileStats = trpc.profiles.getStats.useQuery(undefined, { enabled: isAuthenticated });
  const participation = trpc.profiles.getParticipation.useQuery(undefined, { enabled: isAuthenticated });
  const bookmarks = trpc.initiatives.getUserBookmarks.useQuery(undefined, { enabled: isAuthenticated });
  const updateProfile = trpc.profiles.update.useMutation({
    onSuccess: () => {
      profile.refetch();
      toast.success("Profile updated!");
    },
    onError: () => toast.error("Failed to update profile"),
  });

  const score = Number(profile.data?.profile?.contributionScore || 0);
  const bookmarkCount = bookmarks.data?.length || 0;
  const postCount = profileStats.data?.postCount || 0;
  const initiativeCount = profileStats.data?.initiativeCount || participation.data?.length || 0;
  const impactRadius = useMemo(
    () => calculateImpactRadius(participation.data || []),
    [participation.data],
  );
  const badges = useMemo(
    () => getCivicBadges({ score, bookmarks: bookmarkCount, initiatives: initiativeCount, posts: postCount }),
    [score, bookmarkCount, initiativeCount, postCount],
  );
  const nextBadge = getNextBadge(badges);

  if (loading) {
    return (
      <div className="container flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-jan-green" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="container py-20 text-center">
        <div className="mx-auto max-w-md">
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-muted">
            <User className="h-8 w-8 text-muted-foreground" />
          </div>
          <h1 className="mb-3 font-display text-2xl font-bold text-foreground">Sign In to View Profile</h1>
          <p className="mb-6 font-subheading text-muted-foreground">Track your civic participation, manage bookmarks, and update your profile.</p>
          <Button onClick={() => startLogin()} className="bg-jan-green text-white hover:bg-jan-green-dark btn-press">Sign In</Button>
        </div>
      </div>
    );
  }

  const initials = user?.name?.split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase() || "U";

  return (
    <div className="container max-w-6xl py-8 md:py-12">
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
        <div className="relative overflow-hidden rounded-3xl border border-jan-green/25 bg-[#0b1d1c] p-6 md:p-8">
          <div className="absolute inset-0 opacity-70 [background-image:linear-gradient(rgba(84,217,155,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(84,217,155,0.08)_1px,transparent_1px)] [background-size:36px_36px] [mask-image:linear-gradient(to_bottom,black,transparent)]" />
          <div className="absolute -right-20 -top-28 h-72 w-72 rounded-full bg-jan-green/15 blur-3xl" />
          <div className="absolute bottom-0 left-1/3 h-32 w-72 rounded-full bg-jan-teal/10 blur-3xl" />
          <div className="relative flex flex-col gap-8 md:flex-row md:items-end md:justify-between">
            <div className="flex items-end gap-5">
              <div className="relative">
                <div className="absolute -inset-1 rounded-3xl bg-gradient-to-br from-jan-green to-jan-teal opacity-70 blur" />
                <Avatar className="relative h-24 w-24 rounded-3xl border-4 border-[#0b1d1c] shadow-xl">
                  <AvatarImage src={profile.data?.profile?.avatarUrl || undefined} alt={`${user?.name || "Citizen"} avatar`} />
                  <AvatarFallback className="rounded-3xl bg-jan-green/20 text-2xl font-bold text-jan-green">{initials}</AvatarFallback>
                </Avatar>
                <span className="absolute -bottom-2 -right-2 flex h-8 w-8 items-center justify-center rounded-xl border-2 border-[#0b1d1c] bg-jan-green text-[#09201b]" title="Citizen profile">
                  <Sprout className="h-4 w-4" />
                </span>
              </div>
              <div className="pb-1">
                <p className="mb-2 font-subheading text-xs uppercase tracking-[0.2em] text-jan-green">Citizen record / 01</p>
                <h1 className="font-display text-3xl font-semibold tracking-tight text-white md:text-5xl">{user?.name || "Civic Citizen"}</h1>
                <p className="mt-2 max-w-xl text-sm text-white/55">{profile.data?.profile?.bio || "Your civic map starts with one saved place."}</p>
                <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-white/55">
                  {profile.data?.profile?.location && <span className="flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5 text-jan-green" />{profile.data.profile.location}</span>}
                  <span className="rounded-full border border-white/10 px-2.5 py-1">{profile.data?.user?.role || "Citizen"}</span>
                  <span className="rounded-full border border-jan-green/20 bg-jan-green/5 px-2.5 py-1 text-jan-green">{score} impact points</span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 self-start md:self-end">
              <Badge variant="outline" className="border-jan-green/30 bg-jan-green/5 text-jan-green">Active citizen</Badge>
              <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-white/60"><ArrowUpRight className="h-4 w-4" /></span>
            </div>
          </div>
        </div>
      </motion.div>

      <div className="grid gap-6 lg:grid-cols-[1.25fr_0.75fr]">
        <div className="space-y-6">
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }}>
            <div className="mb-3 flex items-end justify-between">
              <div>
                <p className="font-subheading text-xs uppercase tracking-[0.18em] text-jan-green">Your civic signal</p>
                <h2 className="mt-1 font-display text-2xl font-semibold text-foreground">Participation, made visible.</h2>
              </div>
              <span className="hidden text-right text-[10px] uppercase tracking-[0.16em] text-muted-foreground sm:block">Activity-derived stats</span>
            </div>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              {[
                { label: "Tracked", value: initiativeCount, icon: MapPin, color: "text-jan-green" },
                { label: "Saved", value: bookmarkCount, icon: Bookmark, color: "text-jan-teal" },
                { label: "Posts", value: postCount, icon: MessageCircle, color: "text-jan-amber" },
                { label: "Points", value: score, icon: Award, color: "text-jan-rose" },
              ].map((stat) => (
                <Card key={stat.label} className="border-border/50 bg-card/70 transition-colors hover:border-jan-green/25">
                  <CardContent className="p-4">
                    <stat.icon className={`mb-5 h-4 w-4 ${stat.color}`} />
                    <div className="font-display text-2xl font-semibold text-foreground">{stat.value}</div>
                    <div className="mt-1 font-subheading text-xs text-muted-foreground">{stat.label}</div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.14 }}>
            <div className="mb-3 flex items-end justify-between">
              <div>
                <p className="font-subheading text-xs uppercase tracking-[0.18em] text-jan-green">Progress markers</p>
                <h2 className="mt-1 font-display text-2xl font-semibold text-foreground">Badges earned in the field.</h2>
              </div>
              <span className="text-xs text-muted-foreground">{badges.filter((badge) => badge.unlocked).length}/{badges.length} unlocked</span>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {badges.map((badge, index) => {
                const Icon = badgeIcons[badge.icon];
                return (
                  <motion.div key={badge.id} initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.18 + index * 0.05 }}>
                    <Card className={`h-full border-border/50 ${badge.unlocked ? "bg-gradient-to-br from-jan-green/10 to-card" : "bg-card/50"}`}>
                      <CardContent className="p-4">
                        <div className="mb-4 flex items-start justify-between">
                          <div className={`flex h-10 w-10 items-center justify-center rounded-2xl ${badge.unlocked ? "bg-jan-green text-[#09201b]" : "bg-muted text-muted-foreground"}`}>
                            <Icon className="h-5 w-5" />
                          </div>
                          {badge.unlocked ? <Badge className="bg-jan-green/15 text-[10px] text-jan-green hover:bg-jan-green/15">Unlocked</Badge> : <LockKeyhole className="h-4 w-4 text-muted-foreground/60" />}
                        </div>
                        <h3 className="font-subheading text-base font-semibold text-foreground">{badge.label}</h3>
                        <p className="mt-1 min-h-9 text-xs leading-relaxed text-muted-foreground">{badge.description}</p>
                        <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-muted">
                          <div className={`h-full rounded-full transition-all ${badge.unlocked ? "bg-jan-green" : "bg-jan-teal/60"}`} style={{ width: `${Math.max(badge.progress * 100, badge.unlocked ? 100 : 4)}%` }} />
                        </div>
                        <p className="mt-2 text-[10px] uppercase tracking-[0.14em] text-muted-foreground">{badge.unlocked ? "civic marker active" : "progress marker"}</p>
                      </CardContent>
                    </Card>
                  </motion.div>
                );
              })}
            </div>
          </motion.div>

          {nextBadge && (
            <Card className="overflow-hidden border-jan-teal/20 bg-gradient-to-r from-jan-teal/10 via-card to-card">
              <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-jan-teal/15 text-jan-teal"><TrendingUp className="h-5 w-5" /></div>
                  <div><p className="font-subheading text-xs uppercase tracking-[0.16em] text-jan-teal">Next marker</p><p className="font-display text-lg text-foreground">{nextBadge.label}</p></div>
                </div>
                <p className="max-w-xs text-right text-xs text-muted-foreground">{nextBadge.description}. Your progress is based on activity saved to this account.</p>
              </CardContent>
            </Card>
          )}
        </div>

        <div className="space-y-6">
          <motion.div initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 }}>
            <Card className="border-jan-green/20 bg-card/80">
              <CardHeader className="pb-3"><CardTitle className="flex items-center gap-2 text-lg"><Compass className="h-5 w-5 text-jan-green" />Impact radius</CardTitle><p className="font-subheading text-xs leading-relaxed text-muted-foreground">The distance between the civic places you have saved. It grows as your map gets more local and more connected.</p></CardHeader>
              <CardContent><ImpactRadiusGraphic radiusKm={impactRadius} places={bookmarkCount} /></CardContent>
            </Card>
          </motion.div>

          <motion.div initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.16 }}>
            <Card className="border-border/50">
              <CardHeader><CardTitle className="flex items-center gap-2 text-lg"><Settings className="h-5 w-5 text-jan-green" />Edit Profile</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
                  <div><label className="mb-1 block text-sm font-medium text-foreground">Display Name</label><Input defaultValue={user?.name || ""} disabled className="border-border/50 opacity-70" /><p className="mt-1 text-[10px] text-muted-foreground">Name set during sign-in</p></div>
                  <div><label className="mb-1 block text-sm font-medium text-foreground">Location</label><Input defaultValue={profile.data?.profile?.location || ""} onBlur={(event) => { if (event.target.value !== (profile.data?.profile?.location || "")) updateProfile.mutate({ location: event.target.value }); }} className="border-border/50" placeholder="City, State" /></div>
                </div>
                <div><label className="mb-1 block text-sm font-medium text-foreground">Bio</label><Textarea defaultValue={profile.data?.profile?.bio || ""} onBlur={(event) => { if (event.target.value !== (profile.data?.profile?.bio || "")) updateProfile.mutate({ bio: event.target.value }); }} className="min-h-[86px] border-border/50" placeholder="Tell us about your civic interests..." /></div>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </div>

      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="mt-6">
        <Card className="border-border/50">
          <CardHeader className="flex flex-row items-center justify-between"><CardTitle className="flex items-center gap-2 text-lg"><Bookmark className="h-5 w-5 text-jan-green" />Saved Initiatives</CardTitle><Link href="/explore"><Button variant="ghost" size="sm" className="text-jan-green">Find more <ArrowUpRight className="ml-1 h-4 w-4" /></Button></Link></CardHeader>
          <CardContent>
            {bookmarks.isLoading ? <div className="space-y-3">{Array.from({ length: 3 }).map((_, index) => <div key={index} className="h-16 animate-pulse rounded-lg bg-muted" />)}</div> : bookmarks.data?.length === 0 ? <div className="py-8 text-center"><Bookmark className="mx-auto mb-2 h-8 w-8 text-muted-foreground/30" /><p className="text-sm text-muted-foreground">No saved initiatives yet. Your first civic signal is one click away.</p></div> : <div className="grid gap-3 md:grid-cols-2">{bookmarks.data?.map((initiative: any) => { const visual = getCivicVisual(initiative.category, initiative.id); return <Link key={initiative.id} href={`/initiative/${initiative.id}`}><div className="group flex items-center gap-3 rounded-2xl border border-border/40 bg-muted/20 p-3 transition-colors hover:border-jan-green/30 hover:bg-muted/40"><img src={visual.src} alt={visual.alt} className="h-14 w-16 rounded-xl object-cover opacity-80 transition-opacity group-hover:opacity-100" /><div className="min-w-0 flex-1"><p className="truncate text-sm font-medium text-foreground">{initiative.title}</p><p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground"><MapPin className="h-3 w-3" />{initiative.city || initiative.address || "India"}</p></div><Badge variant="outline" className="hidden text-[10px] sm:flex">{initiative.category}</Badge></div></Link>; })}</div>}
          </CardContent>
        </Card>
      </motion.div>

      <div className="mt-6 text-center"><Button variant="outline" onClick={() => logout()} className="border-destructive/30 text-destructive hover:bg-destructive/5"><LogOut className="mr-2 h-4 w-4" />Sign Out</Button></div>
    </div>
  );
}
