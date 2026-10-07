import { useState, useCallback, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  MapPin, List, Search, Filter, Calendar, Users, ChevronRight,
  TreePine, GraduationCap, Heart, Droplets, PawPrint, AlertTriangle,
  HandHeart, Megaphone, MessageCircle, Map as MapGlobe, X,
  Loader2, Crosshair, ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";
import { MapView } from "@/components/Map";
import { getCivicVisual } from "@/lib/civicVisuals";

const CATEGORIES = [
  "Environment", "Education", "Healthcare", "Blood Donation",
  "Animal Welfare", "Disaster Relief", "Community Service",
  "Awareness Campaigns", "Public Consultations",
] as const;

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

const categoryDotColors: Record<string, string> = {
  Environment: "#54d99b",
  Education: "#72b7ff",
  Healthcare: "#ff7e9f",
  "Blood Donation": "#ff6f74",
  "Animal Welfare": "#ffc764",
  "Disaster Relief": "#ff9d5c",
  "Community Service": "#c391ff",
  "Awareness Campaigns": "#9c8cff",
  "Public Consultations": "#63d7dc",
};

export default function Explore() {
  const [, navigate] = useLocation();

  // View state
  const [viewMode, setViewMode] = useState<"map" | "list">("list");

  // Filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [status, setStatus] = useState("all");
  const [sortBy, setSortBy] = useState("newest");
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [radiusKm, setRadiusKm] = useState("25");
  const [dateFilter, setDateFilter] = useState("all");

  // Nearby discovery
  const [useNearby, setUseNearby] = useState(false);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [locationError, setLocationError] = useState("");
  const [isLocating, setIsLocating] = useState(false);

  // Map state
  const [selectedInitiative, setSelectedInitiative] = useState<number | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const mapInstanceRef = useRef<google.maps.Map | null>(null);
  const markersRef = useRef<any[]>([]);

  const searchParams = {
    search: searchQuery || undefined,
    category: (category !== "all" ? category : undefined) as any,
    status: (status !== "all" ? status : undefined) as any,
    verified: verifiedOnly || undefined,
    sortBy: sortBy as "newest" | "oldest" | "participants" | "name",
    limit: 50,
    offset: 0,
    latitude: useNearby && userLocation ? userLocation.lat : undefined,
    longitude: useNearby && userLocation ? userLocation.lng : undefined,
    radiusKm: useNearby && userLocation ? Number(radiusKm) : undefined,
    dateFilter: (dateFilter !== "all" ? dateFilter : undefined) as "today" | "this_week" | "this_month" | "future" | undefined,
  };

  const { data, isLoading } = trpc.initiatives.list.useQuery(searchParams);

  const nearbyData = trpc.initiatives.getNearby.useQuery(
    { latitude: userLocation?.lat || 0, longitude: userLocation?.lng || 0, radiusKm: Number(radiusKm), limit: 20 },
    { enabled: !!userLocation }
  );

  const requestLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setLocationError("Geolocation is not supported by your browser");
      return;
    }
    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setUseNearby(true);
        setLocationError("");
        setIsLocating(false);
        toast.success("Location detected! Showing nearby initiatives.");
      },
      () => {
        setLocationError("Unable to get your location. Please enable location access.");
        setIsLocating(false);
        toast.error("Location access denied");
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }, []);

  const markers = (data?.initiatives || [])
    .filter((i) => i.latitude != null && i.longitude != null)
    .map((i) => ({
      id: i.id,
      lat: i.latitude as number,
      lng: i.longitude as number,
      title: i.title,
      category: i.category,
      status: i.status,
    }));

  const clustererRef = useRef<any>(null);

  useEffect(() => {
    if (!mapReady || !mapInstanceRef.current) return;
    const map = mapInstanceRef.current;
    markersRef.current.forEach((m: any) => { m.map = null; });
    markersRef.current = [];

    if (clustererRef.current) {
      clustererRef.current.clearMarkers();
    }

    const mapMarkers = markers.map((m) => {
      const color = categoryDotColors[m.category] || "#15803d";
      const pin = new window.google.maps.marker.PinElement({
        background: color,
        borderColor: color,
        glyphColor: "white",
        scale: 1.1,
      });
      const marker = new window.google.maps.marker.AdvancedMarkerElement({
        map: null,
        position: { lat: m.lat, lng: m.lng },
        title: m.title,
        content: pin.element,
      });
      marker.addListener("click", () => setSelectedInitiative(m.id));
      return marker;
    });

    if (typeof google !== "undefined" && (google as any).maps?.marker?.Clusterer) {
      clustererRef.current = new (google as any).maps.marker.Clusterer({
        map,
        markers: mapMarkers,
        renderer: {
          renderCluster: (context: any) => {
            const count = context.markers.length;
            const clusterContent = document.createElement("div");
            clusterContent.style.cssText = `
              width: 40px; height: 40px; border-radius: 50%;
              background: #15803d; color: white; display: flex;
              align-items: center; justify-content: center;
              font-weight: 700; font-size: 14px;
              box-shadow: 0 2px 8px rgba(0,0,0,0.3);
            `;
            clusterContent.textContent = String(count);
            return new google.maps.marker.AdvancedMarkerElement({
              position: context.center,
              map,
              content: clusterContent,
              zIndex: 5,
            });
          },
          renderMarker: (context: any) => {
            return context.marker;
          },
        },
      });
      markersRef.current = mapMarkers;
    } else {
      mapMarkers.forEach((m) => { m.map = map; });
      markersRef.current = mapMarkers;
    }

    return () => {
      mapMarkers.forEach((m) => { m.map = null; });
      if (clustererRef.current) {
        clustererRef.current.clearMarkers();
      }
    };
  }, [mapReady, markers]);

  // User location marker
  useEffect(() => {
    if (!mapReady || !mapInstanceRef.current || !userLocation) return;
    const map = mapInstanceRef.current;
    const pin = new window.google.maps.marker.PinElement({
      background: "#3b82f6",
      borderColor: "#1d4ed8",
      glyphColor: "white",
      scale: 0.9,
    });
    const userMarker = new window.google.maps.marker.AdvancedMarkerElement({
      map,
      position: { lat: userLocation.lat, lng: userLocation.lng },
      title: "Your location",
      content: pin.element,
      zIndex: 1000,
    });
    return () => { (userMarker as any).map = null; };
  }, [mapReady, userLocation]);

  const selectedData = data?.initiatives?.find((i) => i.id === selectedInitiative);

  const handleMapReady = useCallback((map: google.maps.Map) => {
    mapInstanceRef.current = map;
    setMapReady(true);
  }, []);

  return (
    <div className="h-[calc(100vh-3.5rem)] flex flex-col">
      {/* Filter Bar */}
      <div className="bg-background/95 backdrop-blur-sm border-b border-border/50 px-4 py-3 flex items-center gap-2 flex-wrap" role="search" aria-label="Search and filter initiatives">
        {/* Search with geocoding */}
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search initiatives, locations..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && mapInstanceRef.current && typeof google !== "undefined" && google.maps?.Geocoder) {
                const geocoder = new google.maps.Geocoder();
                geocoder.geocode({ address: searchQuery }, (results, status) => {
                  if (status === "OK" && results?.[0]) {
                    const loc = results[0].geometry.location;
                    mapInstanceRef.current?.panTo(loc);
                    mapInstanceRef.current?.setZoom(12);
                    setUserLocation({ lat: loc.lat(), lng: loc.lng() });
                    setUseNearby(true);
                    setViewMode("map");
                    toast.success(`Located: ${results[0].formatted_address}`);
                  } else {
                    toast.error("Could not find that location. Try a different search term.");
                  }
                });
              }
            }}
            className="pl-9 h-10 border-border/50"
            aria-label="Search initiatives by name or location"
          />
        </div>

        <div className="flex items-center gap-2">
          {/* Category filter */}
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger className="w-36 h-10 border-border/50" aria-label="Filter by category">
              <Filter className="w-4 h-4 mr-2 text-muted-foreground" />
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {CATEGORIES.map((cat) => (
                <SelectItem key={cat} value={cat}>{cat}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Status filter */}
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="w-28 h-10 border-border/50" aria-label="Filter by status">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="upcoming">Upcoming</SelectItem>
              <SelectItem value="ongoing">Ongoing</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
            </SelectContent>
          </Select>

          {/* Date filter */}
          <Select value={dateFilter} onValueChange={setDateFilter}>
            <SelectTrigger className="w-32 h-10 border-border/50" aria-label="Filter by date">
              <Calendar className="w-4 h-4 mr-2 text-muted-foreground" />
              <SelectValue placeholder="Date" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Dates</SelectItem>
              <SelectItem value="today">Today</SelectItem>
              <SelectItem value="this_week">This Week</SelectItem>
              <SelectItem value="this_month">This Month</SelectItem>
              <SelectItem value="future">Future Only</SelectItem>
            </SelectContent>
          </Select>

          {/* Verified filter */}
          <button
            onClick={() => setVerifiedOnly(!verifiedOnly)}
            className={`h-10 px-3 rounded-lg border text-sm font-medium flex items-center gap-1.5 transition-colors ${
              verifiedOnly
                ? "bg-blue-50 border-blue-200 text-blue-700"
                : "border-border/50 text-muted-foreground hover:bg-muted"
            }`}
            aria-pressed={verifiedOnly}
            aria-label="Show verified initiatives only"
          >
            <ShieldCheck className="w-4 h-4" />
            Verified
          </button>

          {/* Sort */}
          <Select value={sortBy} onValueChange={setSortBy}>
            <SelectTrigger className="w-28 h-10 border-border/50" aria-label="Sort initiatives">
              <SelectValue placeholder="Sort" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="newest">Newest</SelectItem>
              <SelectItem value="oldest">Oldest</SelectItem>
              <SelectItem value="participants">Participants</SelectItem>
              <SelectItem value="name">Name</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Nearby toggle */}
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="sm"
            className={`h-9 text-xs ${useNearby ? "bg-blue-50 border-blue-200 text-blue-700" : ""}`}
            onClick={requestLocation}
            disabled={isLocating}
            aria-label="Find nearby initiatives"
          >
            {isLocating ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" />
            ) : (
              <Crosshair className="w-3.5 h-3.5 mr-1" />
            )}
            {useNearby ? "Nearby" : "Near Me"}
          </Button>
          {useNearby && userLocation && (
            <Select value={radiusKm} onValueChange={setRadiusKm}>
              <SelectTrigger className="w-20 h-9 text-xs" aria-label="Search radius">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="5">5 km</SelectItem>
                <SelectItem value="10">10 km</SelectItem>
                <SelectItem value="25">25 km</SelectItem>
                <SelectItem value="50">50 km</SelectItem>
                <SelectItem value="100">100 km</SelectItem>
              </SelectContent>
            </Select>
          )}
        </div>

        {/* View Toggle */}
        <div className="flex items-center border border-border/50 rounded-lg overflow-hidden" role="radiogroup" aria-label="View mode">
          <button
            onClick={() => setViewMode("map")}
            role="radio"
            aria-checked={viewMode === "map"}
            className={`px-3 py-2 flex items-center gap-1.5 text-sm transition-colors ${
              viewMode === "map" ? "bg-jan-green text-white" : "text-muted-foreground hover:bg-muted"
            }`}
          >
            <MapGlobe className="w-4 h-4" /> Map
          </button>
          <button
            onClick={() => setViewMode("list")}
            role="radio"
            aria-checked={viewMode === "list"}
            className={`px-3 py-2 flex items-center gap-1.5 text-sm transition-colors ${
              viewMode === "list" ? "bg-jan-green text-white" : "text-muted-foreground hover:bg-muted"
            }`}
          >
            <List className="w-4 h-4" /> List
          </button>
        </div>

        <span className="text-xs text-muted-foreground whitespace-nowrap" aria-live="polite">
          {data?.total || 0} initiatives
        </span>
      </div>

      {/* Location error */}
      {locationError && (
        <div className="bg-amber-50 border-b border-amber-200 px-4 py-2 text-sm text-amber-700" role="alert">
          {locationError}
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 relative overflow-hidden">
        <AnimatePresence mode="wait">
          {viewMode === "map" ? (
            <motion.div
              key="map"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="h-full"
            >
              <MapView
                initialCenter={useNearby && userLocation ? userLocation : { lat: 20.5937, lng: 78.9629 }}
                initialZoom={useNearby && userLocation ? 12 : 5}
                onMapReady={handleMapReady}
                className="h-full"
              />

              {/* Floating Initiative Preview */}
              <AnimatePresence>
                {selectedData && (
                  <motion.div
                    initial={{ opacity: 0, y: 20, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 20, scale: 0.95 }}
                    transition={{ duration: 0.25, ease: [0.23, 1, 0.32, 1] as any }}
                    className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20 w-full max-w-md px-4"
                  >
                    <Card className="shadow-xl border-border/50">
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-2 mb-2">
                            <span className={`text-xs px-2 py-0.5 rounded-full ${categoryColors[selectedData.category]}`}>
                              {selectedData.category}
                            </span>
                            <Badge variant="outline" className="text-[10px]">{selectedData.status}</Badge>
                          </div>
                          <button
                            onClick={() => setSelectedInitiative(null)}
                            className="text-muted-foreground hover:text-foreground"
                            aria-label="Close preview"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                        <h3 className="font-semibold text-foreground mb-1">{selectedData.title}</h3>
                        <p className="text-xs text-muted-foreground mb-3 line-clamp-2">{selectedData.description}</p>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground">
                          {selectedData.city && (
                            <span className="flex items-center gap-1">
                              <MapPin className="w-3 h-3" /> {selectedData.city}
                            </span>
                          )}
                          {selectedData.startDate && (
                            <span className="flex items-center gap-1">
                              <Calendar className="w-3 h-3" />
                              {new Date(selectedData.startDate).toLocaleDateString("en-IN", { month: "short", day: "numeric" })}
                            </span>
                          )}
                          {selectedData.participantCount > 0 && (
                            <span className="flex items-center gap-1">
                              <Users className="w-3 h-3" /> {selectedData.participantCount}
                            </span>
                          )}
                        </div>
                        <div className="mt-3">
                          <Button
                            size="sm"
                            className="w-full bg-jan-green hover:bg-jan-green-dark text-white btn-press"
                            onClick={() => navigate(`/initiative/${selectedData.id}`)}
                          >
                            View Details <ChevronRight className="w-4 h-4 ml-1" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Nearby list sidebar */}
              {useNearby && userLocation && nearbyData.data && (
                <div className="absolute top-4 right-4 z-10 max-h-80 overflow-y-auto hidden lg:block">
                  <Card className="shadow-lg w-64">
                    <CardContent className="p-3">
                      <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1">
                        <Crosshair className="w-3 h-3" /> Nearby ({radiusKm} km)
                      </p>
                      <div className="space-y-2">
                        {nearbyData.data.slice(0, 8).map((m) => (
                          <button
                            key={m.id}
                            onClick={() => {
                              setSelectedInitiative(m.id);
                              if (mapInstanceRef.current && m.latitude && m.longitude) {
                                mapInstanceRef.current.panTo({ lat: m.latitude as number, lng: m.longitude as number });
                                mapInstanceRef.current.setZoom(14);
                              }
                            }}
                            className={`w-full text-left p-2 rounded-lg transition-colors ${
                              selectedInitiative === m.id ? "bg-jan-green/10 border border-jan-green/30" : "hover:bg-muted"
                            }`}
                          >
                            <p className="text-xs font-medium text-foreground truncate">{m.title}</p>
                            <div className="flex items-center gap-2 text-[10px] text-muted-foreground mt-0.5">
                              <span>{m.category}</span>
                              <span>&middot; {m.distance?.toFixed(1)} km</span>
                            </div>
                          </button>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </div>
              )}
            </motion.div>
          ) : (
            <motion.div
              key="list"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="h-full overflow-y-auto"
            >
              <div className="max-w-4xl mx-auto py-6 px-4">
                {isLoading ? (
                  <div className="space-y-4" role="status" aria-label="Loading initiatives">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <div key={i} className="h-32 bg-muted animate-pulse rounded-xl" />
                    ))}
                    <span className="sr-only">Loading...</span>
                  </div>
                ) : data?.initiatives?.length === 0 ? (
                  <div className="text-center py-16">
                    <MapPin className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
                    <h3 className="font-display text-lg font-bold text-foreground mb-2">No initiatives found</h3>
                    <p className="text-muted-foreground">Try adjusting your filters or search query.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {data?.initiatives?.map((init, i) => {
                      const Icon = categoryIcons[init.category] || MapPin;
                      return (
                        <motion.div
                          key={init.id}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: i * 0.03 }}
                        >
                          <Card
                            className="group overflow-hidden border-border/50 bg-card/80 transition-all duration-300 hover:border-jan-green/35 hover:shadow-xl hover:shadow-jan-green/5 cursor-pointer"
                            onClick={() => navigate(`/initiative/${init.id}`)}
                            role="article"
                            aria-label={`${init.title} - ${init.category}`}
                          >
                            {(() => {
                              const visual = getCivicVisual(init.category, init.id);
                              return (
                                <>
                                  <div className="relative h-36 overflow-hidden">
                                    <img src={init.imageUrl || visual.src} alt={init.imageUrl ? init.title : visual.alt} className="h-full w-full object-cover opacity-80 transition duration-500 group-hover:scale-105 group-hover:opacity-100" />
                                    <div className={`absolute inset-0 bg-gradient-to-t ${visual.tint} from-card via-card/20 to-transparent`} />
                                    <div className="absolute inset-x-4 bottom-3 flex items-center justify-between gap-2">
                                      <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-medium backdrop-blur ${categoryColors[init.category] || "bg-white/10 text-white"}`}>
                                        <Icon className="h-3 w-3" /> {init.category}
                                      </span>
                                      {init.verified && <Badge variant="secondary" className="border-white/10 bg-black/30 text-[10px] text-white backdrop-blur">Verified</Badge>}
                                    </div>
                                  </div>
                                  <CardContent className="p-5">
                                    <div className="mb-2 flex items-start justify-between gap-3">
                                      <h3 className="font-subheading text-lg font-semibold leading-tight text-foreground transition-colors group-hover:text-jan-green line-clamp-2">{init.title}</h3>
                                      <Badge variant="outline" className={`shrink-0 text-[10px] ${init.status === "ongoing" ? "border-jan-green/30 bg-jan-green/10 text-jan-green" : init.status === "upcoming" ? "border-sky-400/30 bg-sky-400/10 text-sky-300" : "text-muted-foreground"}`}>{init.status}</Badge>
                                    </div>
                                    <p className="mb-4 line-clamp-2 text-sm text-muted-foreground">{init.description}</p>
                                    <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                                      {init.city && <span className="flex items-center gap-1"><MapPin className="h-3 w-3 text-jan-green" /> {init.city}{init.state && `, ${init.state}`}</span>}
                                      {init.startDate && <span className="flex items-center gap-1"><Calendar className="h-3 w-3 text-jan-teal" />{new Date(init.startDate).toLocaleDateString("en-IN", { month: "short", day: "numeric" })}</span>}
                                      {init.participantCount > 0 && <span className="flex items-center gap-1"><Users className="h-3 w-3 text-jan-amber" /> {init.participantCount}</span>}
                                    </div>
                                    <div className="mt-4 flex items-center justify-between border-t border-border/30 pt-3">
                                      <span className="flex items-center gap-1.5 text-xs text-muted-foreground"><span className="h-1.5 w-1.5 rounded-full bg-jan-green" />{init.organizationName || "Community-led"}</span>
                                      <button type="button" onClick={(event) => { event.stopPropagation(); navigate(`/community?initiativeId=${init.id}`); }} className="flex items-center gap-1.5 text-xs font-medium text-jan-teal transition-colors hover:text-jan-green" aria-label={`Open community posts for ${init.title}`}><MessageCircle className="h-3.5 w-3.5" /> Community</button>
                                    </div>
                                  </CardContent>
                                </>
                              );
                            })()}
                          </Card>
                        </motion.div>
                      );
                    })}
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
