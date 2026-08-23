import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Compass, MapPin, Calendar, Users, ArrowRight, SlidersHorizontal } from "lucide-react";
import { Link } from "wouter";

const discoverySignals = [
  {
    icon: MapPin,
    title: "Near you",
    desc: "Browse initiatives by city, neighbourhood, or a custom radius.",
  },
  {
    icon: Calendar,
    title: "Fits your time",
    desc: "Use date and status filters to find opportunities you can actually join.",
  },
  {
    icon: Users,
    title: "Community-led",
    desc: "See participation counts and conversations before you commit.",
  },
];

export default function AIDiscovery() {
  return (
    <div className="container py-12">
      <div className="mx-auto max-w-3xl text-center">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45 }}>
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-jan-green to-jan-teal">
            <Compass className="h-8 w-8 text-white" />
          </div>
          <Badge className="mb-4 border-jan-green/20 bg-jan-green/10 text-jan-green">Guided discovery</Badge>
          <h1 className="mb-4 font-display text-3xl font-bold text-foreground md:text-4xl">Find your next civic signal.</h1>
          <p className="mx-auto mb-8 max-w-2xl text-lg leading-relaxed text-muted-foreground">
            JanConnect keeps discovery transparent and community-led. Start with the map, narrow the signals that matter to you, and evaluate each opportunity with real context before participating.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.12, duration: 0.4 }}
          className="mb-10 grid grid-cols-1 gap-4 md:grid-cols-3"
        >
          {discoverySignals.map(({ icon: Icon, title, desc }) => (
            <Card key={title} className="border-border/50 bg-card/50">
              <CardContent className="p-5 text-center">
                <Icon className="mx-auto mb-3 h-6 w-6 text-jan-green" />
                <h3 className="mb-1 text-sm font-semibold text-foreground">{title}</h3>
                <p className="text-xs text-muted-foreground">{desc}</p>
              </CardContent>
            </Card>
          ))}
        </motion.div>

        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.24 }}>
          <div className="relative rounded-2xl border border-border/50 bg-muted/50 p-8 text-left">
            <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-jan-green/5 to-transparent" />
            <div className="relative">
              <div className="mb-5 flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-jan-green/10">
                  <SlidersHorizontal className="h-4 w-4 text-jan-green" />
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">Your discovery workspace</p>
                  <p className="text-xs text-muted-foreground">Transparent filters, no black-box recommendations.</p>
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-xl border border-border/40 bg-background/40 p-4"><p className="text-xs text-muted-foreground">Explore by</p><p className="mt-1 text-sm font-medium text-foreground">Category & city</p></div>
                <div className="rounded-xl border border-border/40 bg-background/40 p-4"><p className="text-xs text-muted-foreground">Evaluate with</p><p className="mt-1 text-sm font-medium text-foreground">Posts & signals</p></div>
                <div className="rounded-xl border border-border/40 bg-background/40 p-4"><p className="text-xs text-muted-foreground">Stay connected</p><p className="mt-1 text-sm font-medium text-foreground">Bookmarks</p></div>
              </div>
              <Button asChild className="mt-6 bg-jan-green text-white hover:bg-jan-green-dark btn-press">
                <Link href="/explore">Open the civic map <ArrowRight className="ml-2 h-4 w-4" /></Link>
              </Button>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
