import { motion } from "framer-motion";
import { useEffect, useRef, useCallback, useState } from "react";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { startLogin } from "@/const";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MapView } from "@/components/Map";
import AnimatedMapBackground from "@/components/AnimatedMapBackground";
import { MapPin, Calendar, Users, ArrowRight, TreePine, GraduationCap, Heart, Droplets, PawPrint, AlertTriangle, HandHeart, Megaphone, MessageCircle, MessageSquare } from "lucide-react";

const categoryIcons: Record<string, React.ElementType> = {
  Environment: TreePine,
  Education: GraduationCap,
  Healthcare: Heart,
  "Blood Donation": Droplets,
  "Animal Welfare": PawPrint,
  "Disaster Relief": AlertTriangle,
  "Community Service": HandHeart,
  "Awareness Campaigns": Megaphone,
  "Public Consultations": MessageCircle,
};

const categoryColors: Record<string, string> = {
  Environment: "bg-jan-green/10 text-jan-green border-jan-green/20",
  Education: "bg-sky-400/10 text-sky-300 border-sky-400/20",
  Healthcare: "bg-rose-400/10 text-rose-300 border-rose-400/20",
  "Blood Donation": "bg-red-400/10 text-red-300 border-red-400/20",
  "Animal Welfare": "bg-amber-400/10 text-amber-300 border-amber-400/20",
  "Disaster Relief": "bg-orange-400/10 text-orange-300 border-orange-400/20",
  "Community Service": "bg-purple-400/10 text-purple-300 border-purple-400/20",
  "Awareness Campaigns": "bg-indigo-400/10 text-indigo-300 border-indigo-400/20",
  "Public Consultations": "bg-cyan-400/10 text-cyan-300 border-cyan-400/20",
};

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.08, duration: 0.4, ease: [0.23, 1, 0.32, 1] as any },
  }),
};

function MapPreview() {
  const { data } = trpc.initiatives.list.useQuery({ limit: 20 });
  const mapInstance = useRef<google.maps.Map | null>(null);
  const markersRef = useRef<any[]>([]);
  const [mapVersion, setMapVersion] = useState(0);

  const colors: Record<string, string> = {
    Environment: "#54d99b", Education: "#72b7ff", Healthcare: "#ff7e9f",
    "Blood Donation": "#ff6f74", "Animal Welfare": "#ffc764",
    "Disaster Relief": "#ff9d5c", "Community Service": "#c391ff",
    "Awareness Campaigns": "#9c8cff", "Public Consultations": "#63d7dc",
  };

  const handleMapReady = useCallback((map: google.maps.Map) => {
    mapInstance.current = map;
    setMapVersion((version) => version + 1);
  }, []);

  useEffect(() => {
    const map = mapInstance.current;
    if (!map || !window.google?.maps?.marker) return;
    markersRef.current.forEach((marker: any) => { marker.map = null; });
    markersRef.current = [];

    (data?.initiatives || []).forEach((init: any) => {
      if (init.latitude == null || init.longitude == null) return;
      const color = colors[init.category] || "#54d99b";
      const pin = new window.google.maps.marker.PinElement({ background: color, borderColor: color, glyphColor: "white", scale: 1.0 });
      const marker = new window.google.maps.marker.AdvancedMarkerElement({ map, position: { lat: init.latitude, lng: init.longitude }, title: init.title, content: pin, gmpClickable: true });
      marker.addEventListener("gmp-click", () => { window.location.href = `/initiative/${init.id}`; });
      markersRef.current.push(marker);
    });

    return () => { markersRef.current.forEach((marker: any) => { marker.map = null; }); };
  }, [data, mapVersion]);

  return (
    <MapView
      initialCenter={{ lat: 20.5937, lng: 78.9629 }}
      initialZoom={5}
      onMapReady={handleMapReady}
      className="h-[350px] rounded-xl overflow-hidden border border-border/50"
    />
  );
}

function CommunityActivity() {
  const { data: posts } = trpc.posts.list.useQuery({ limit: 3 });

  if (!posts || posts.posts.length === 0) {
    return (
      <div className="grid md:grid-cols-3 gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <Card key={i} className="border-border/50 p-5">
            <div className="h-3 bg-muted animate-pulse rounded w-1/4 mb-3" />
            <div className="h-3 bg-muted animate-pulse rounded w-full mb-2" />
            <div className="h-3 bg-muted animate-pulse rounded w-3/4" />
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="grid md:grid-cols-3 gap-4">
      {posts.posts.slice(0, 3).map((post: any, i: number) => (
        <motion.div
          key={post.id}
          custom={i}
          variants={fadeUp}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
        >
          <Card className="border-border/50 hover:border-jan-green/30 transition-all duration-200">
            <CardContent className="p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-8 h-8 rounded-full bg-jan-green/10 flex items-center justify-center text-xs font-bold text-jan-green">
                  {(post.userName || post.userName || "A")[0]?.toUpperCase()}
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">{post.userName || "Anonymous"}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(post.createdAt).toLocaleDateString("en-IN", { month: "short", day: "numeric" })}
                  </p>
                </div>
              </div>
              <p className="text-sm text-foreground line-clamp-3 mb-3">{post.content}</p>
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Heart className="w-3 h-3" /> {post.likeCount || 0}
                </span>
                <span className="flex items-center gap-1">
                  <MessageSquare className="w-3 h-3" /> {post.commentCount || 0}
                </span>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      ))}
    </div>
  );
}

export default function Home() {
  const { loading, isAuthenticated } = useAuth();
  const { data: initiativesData, isLoading } = trpc.initiatives.list.useQuery({
    limit: 6,
    sortBy: "newest",
  });
  const { data: categoriesData } = trpc.initiatives.getCategories.useQuery();

  const totalInitiatives = initiativesData?.total || initiativesData?.initiatives.length || 0;
  const totalParticipants = initiativesData?.initiatives.reduce((sum, i) => sum + (i.participantCount || 0), 0) || 0;

  return (
    <div className="min-h-[calc(100vh-4rem)]">
      {/* Map-first Hero */}
      <section className="relative min-h-[92vh] overflow-hidden border-b border-border/40">
        <AnimatedMapBackground />
        <div className="pointer-events-none absolute inset-0 z-[1] bg-[radial-gradient(circle_at_70%_30%,rgba(84,217,155,0.14),transparent_34%),linear-gradient(135deg,rgba(5,15,15,0.95),rgba(5,15,15,0.55),rgba(5,15,15,0.9))]" />
        <div className="container relative z-10 py-10 md:py-16 hero-content-overlay">
          <div className="grid items-center gap-10 lg:grid-cols-[0.78fr_1.22fr] lg:gap-14">
            <motion.div initial={{ opacity: 0, x: -24 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.55 }} className="max-w-xl">
              <Badge className="mb-5 border-jan-green/25 bg-jan-green/10 text-jan-green hover:bg-jan-green/10"><span className="mr-2 h-1.5 w-1.5 rounded-full bg-jan-green shadow-[0_0_9px_rgba(84,217,155,0.9)]" /> Civic layer / India</Badge>
              <h1 className="font-display text-4xl font-semibold leading-[1.04] tracking-tight text-white md:text-6xl">The map for people who <span className="text-jan-green">care.</span></h1>
              <p className="mt-6 max-w-lg font-subheading text-base leading-relaxed text-white/60 md:text-lg">Discover where your time, voice, and care can move the neighbourhood forward — from one living civic map.</p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link href="/explore"><Button size="lg" className="bg-jan-green text-[#08201e] shadow-lg shadow-jan-green/20 hover:bg-jan-green/90 btn-press"><MapPin className="mr-2 h-5 w-5" /> Explore the map</Button></Link>
                {!isAuthenticated && !loading && <Button size="lg" variant="outline" onClick={() => startLogin()} className="border-white/15 bg-white/5 text-white hover:bg-white/10 btn-press">Join the network <ArrowRight className="ml-2 h-4 w-4" /></Button>}
              </div>
              <div className="mt-8 flex flex-wrap items-center gap-x-5 gap-y-2 text-[10px] uppercase tracking-[0.16em] text-white/40"><span className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-jan-green" /> live initiatives</span><span>9 civic categories</span><span>map-first discovery</span></div>
            </motion.div>

            <motion.div initial={{ opacity: 0, scale: 0.96, y: 18 }} animate={{ opacity: 1, scale: 1, y: 0 }} transition={{ delay: 0.12, duration: 0.6 }} className="relative">
              <div className="absolute -inset-4 rounded-[2.5rem] bg-jan-green/10 blur-3xl" />
              <div className="relative overflow-hidden rounded-[2rem] border border-white/15 bg-[#0b1716]/80 p-2 shadow-2xl shadow-black/40 backdrop-blur-xl">
                <div className="flex items-center justify-between px-4 py-3"><div className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-jan-green shadow-[0_0_10px_rgba(84,217,155,0.9)]" /><span className="font-subheading text-xs text-white/70">JanConnect / live civic layer</span></div><span className="rounded-full border border-white/10 px-2.5 py-1 text-[9px] uppercase tracking-[0.15em] text-white/45">India · all signals</span></div>
                <div className="relative overflow-hidden rounded-[1.5rem] border border-white/10"><MapPreview /><div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#061211]/75 via-transparent to-transparent" /><div className="pointer-events-none absolute left-4 top-4 rounded-xl border border-white/10 bg-black/25 px-3 py-2 text-[10px] text-white/65 backdrop-blur"><span className="block uppercase tracking-[0.16em] text-jan-green">Map surface</span><span className="mt-1 block">Find your next civic signal</span></div><div className="pointer-events-none absolute bottom-4 left-4 right-4 flex items-end justify-between gap-4"><div><p className="font-display text-lg font-semibold text-white">Zoom into action.</p><p className="text-xs text-white/55">Tap a marker to evaluate the opportunity.</p></div><div className="rounded-xl border border-jan-green/30 bg-jan-green/15 px-3 py-2 text-right text-[10px] text-jan-green backdrop-blur"><span className="block font-display text-lg text-white">{totalInitiatives || "30+"}</span><span>signals nearby</span></div></div></div>
              </div>
            </motion.div>
          </div>

          <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35, duration: 0.5 }} className="mt-10 grid grid-cols-2 gap-3 md:grid-cols-4">
            {[
              { label: "Initiatives", value: "30+", icon: MapPin },
              { label: "Cities", value: "15+", icon: Users },
              { label: "Categories", value: "9", icon: Calendar },
              { label: "Volunteers", value: `${totalParticipants.toLocaleString()}+`, icon: Users },
            ].map((stat) => <div key={stat.label} className="flex items-center gap-3 rounded-2xl border border-white/10 bg-black/20 p-3 backdrop-blur"><stat.icon className="h-4 w-4 text-jan-green" /><div><div className="font-display text-xl font-semibold text-white">{stat.value}</div><div className="text-[10px] uppercase tracking-[0.14em] text-white/40">{stat.label}</div></div></div>)}
          </motion.div>
        </div>
      </section>

      {/* Categories Section */}
      <section className="container py-12">
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="mb-8"
        >
          <h2 className="font-display text-2xl md:text-3xl font-bold text-foreground mb-2">
            Browse by Category
          </h2>
          <p className="font-subheading text-muted-foreground">Explore civic initiatives across India</p>
        </motion.div>

        <div className="grid grid-cols-3 md:grid-cols-5 gap-3">
          {Object.entries(categoryIcons).map(([name, Icon], i) => {
            const count = categoriesData?.find(c => c.category === name)?.count || 0;
            return (
              <Link key={name} href={`/explore?category=${encodeURIComponent(name)}`}>
                <motion.div
                  custom={i}
                  variants={fadeUp}
                  initial="hidden"
                  whileInView="visible"
                  viewport={{ once: true }}
                  whileHover={{ scale: 1.03, y: -2 }}
                  whileTap={{ scale: 0.97 }}
                  className="group relative p-4 rounded-2xl bg-card border border-border/50 hover:border-jan-green/30 hover:shadow-lg hover:shadow-jan-green/5 transition-all duration-200 cursor-pointer"
                >
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 ${categoryColors[name]?.split(" ")[0]}`}>
                    <Icon className={`w-5 h-5 ${categoryColors[name]?.split(" ")[1]}`} />
                  </div>
                  <div className="text-sm font-medium text-foreground group-hover:text-jan-green transition-colors">
                    {name}
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">{count} active</div>
                </motion.div>
              </Link>
            );
          })}
        </div>
      </section>

      {/* Featured Initiatives */}
      <section className="container py-12">
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="flex items-center justify-between mb-8"
        >
          <div>
            <h2 className="font-display text-2xl md:text-3xl font-bold text-foreground mb-1">
              Latest Initiatives
            </h2>
            <p className="font-subheading text-muted-foreground">Recently added civic opportunities</p>
          </div>
          <Link href="/explore">
            <Button variant="ghost" size="sm" className="text-jan-green hover:text-jan-green-dark btn-press">
              View All
              <ArrowRight className="w-4 h-4 ml-1" />
            </Button>
          </Link>
        </motion.div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
          {isLoading
            ? Array.from({ length: 6 }).map((_, i) => (
                <Card key={i} className="overflow-hidden border-border/50">
                  <div className="h-40 bg-muted animate-pulse" />
                  <CardContent className="p-5">
                    <div className="h-4 bg-muted animate-pulse rounded w-3/4 mb-3" />
                    <div className="h-3 bg-muted animate-pulse rounded w-full mb-2" />
                    <div className="h-3 bg-muted animate-pulse rounded w-1/2" />
                  </CardContent>
                </Card>
              ))
            : initiativesData?.initiatives.map((initiative, i) => {
                const Icon = categoryIcons[initiative.category] || MapPin;
                return (
                  <motion.div
                    key={initiative.id}
                    custom={i}
                    variants={fadeUp}
                    initial="hidden"
                    whileInView="visible"
                    viewport={{ once: true }}
                  >
                    <Link href={`/initiative/${initiative.id}`}>
                      <Card className="group overflow-hidden border-border/50 hover:border-jan-green/30 hover:shadow-lg hover:shadow-jan-green/5 transition-all duration-300 cursor-pointer">
                        {/* Category header */}
                        <div className={`px-5 pt-5 pb-3 ${categoryColors[initiative.category]?.split(" ")[0]} border-b border-border/30`}>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <Icon className={`w-4 h-4 ${categoryColors[initiative.category]?.split(" ")[1]}`} />
                              <span className={`text-xs font-semibold ${categoryColors[initiative.category]?.split(" ")[1]}`}>
                                {initiative.category}
                              </span>
                            </div>
                            {initiative.verified && (
                              <Badge variant="secondary" className="text-[10px]">Verified</Badge>
                            )}
                          </div>
                        </div>
                        <CardContent className="p-5">
                          <h3 className="font-semibold text-foreground text-base leading-snug mb-2 group-hover:text-jan-green transition-colors">
                            {initiative.title}
                          </h3>
                          <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
                            {initiative.description}
                          </p>
                          <div className="flex items-center gap-4 text-xs text-muted-foreground">
                            {initiative.city && (
                              <span className="flex items-center gap-1">
                                <MapPin className="w-3 h-3" />
                                {initiative.city}
                              </span>
                            )}
                            {initiative.participantCount > 0 && (
                              <span className="flex items-center gap-1">
                                <Users className="w-3 h-3" />
                                {initiative.participantCount}
                              </span>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    </Link>
                  </motion.div>
                );
              })
          }
        </div>
      </section>

      {/* Map Preview Section */}
      <section className="container py-12">
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="mb-8"
        >
          <h2 className="font-display text-2xl md:text-3xl font-bold text-foreground mb-2">
            Explore Near You
          </h2>
          <p className="font-subheading text-muted-foreground">Discover civic initiatives on an interactive map</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
        >
          <div className="relative rounded-2xl overflow-hidden border border-border/50 hover:border-jan-green/30 transition-all duration-300">
            <div className="relative">
              <MapPreview />
              <div className="absolute inset-0 bg-gradient-to-t from-background/80 via-transparent to-transparent pointer-events-none" />
              <div className="absolute bottom-0 left-0 right-0 p-6 flex flex-col md:flex-row items-end md:items-center justify-between gap-4">
                <div>
                  <h3 className="font-display text-xl font-bold text-foreground mb-1">
                    Interactive Map Discovery
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    Find initiatives closest to you with real-time filtering
                  </p>
                </div>
                <Link href="/explore">
                  <Button className="bg-jan-green hover:bg-jan-green-dark text-white btn-press">
                    Open Map
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </motion.div>
      </section>

      {/* Community Activity Section */}
      <section className="container py-12">
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="flex items-center justify-between mb-8"
        >
          <div>
            <h2 className="font-display text-2xl md:text-3xl font-bold text-foreground mb-1">
              Community Voices
            </h2>
            <p className="font-subheading text-muted-foreground">Hear from citizens making a difference</p>
          </div>
          <Link href="/community">
            <Button variant="ghost" size="sm" className="text-jan-green hover:text-jan-green-dark btn-press">
              View Community
              <ArrowRight className="w-4 h-4 ml-1" />
            </Button>
          </Link>
        </motion.div>

        <CommunityActivity />
      </section>

      {/* CTA Section */}
      <section className="container py-16">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="relative rounded-3xl overflow-hidden bg-gradient-to-br from-jan-green via-jan-green-dark to-jan-teal p-8 md:p-12"
        >
          <div className="absolute inset-0 opacity-10">
            <div className="absolute top-0 right-0 w-64 h-64 bg-jan-green/5 rounded-full blur-3xl" />
            <div className="absolute bottom-0 left-0 w-96 h-96 bg-jan-teal/5 rounded-full blur-3xl" />
          </div>
          <div className="relative text-center">
            <h2 className="font-display text-2xl md:text-4xl font-bold text-white mb-4">
              Ready to Make a Difference?
            </h2>
            <p className="text-white/80 text-lg max-w-xl mx-auto mb-8">
              Join thousands of citizens actively participating in civic initiatives across India. Every action counts.
            </p>
            <Link href="/explore">
              <Button size="lg" className="bg-white text-jan-green hover:bg-white/90 btn-press shadow-xl">
                Start Exploring
                <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
            </Link>
          </div>
        </motion.div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/50 py-8">
        <div className="container flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-jan-green flex items-center justify-center">
              <MapPin className="w-4 h-4 text-white" />
            </div>
            <span className="font-display font-bold text-foreground">JanConnect</span>
          </div>
          <p className="text-sm text-muted-foreground">
            Empowering citizens to discover, evaluate, and participate in civic initiatives.
          </p>
        </div>
      </footer>
    </div>
  );
}
