import { useParams } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Building2, Mail, Phone, Globe, Shield, MapPin, Calendar,
  Users, ArrowLeft, ExternalLink, Loader2,
} from "lucide-react";

export default function OrganizationProfile() {
  const params = useParams<{ id: string }>();
  const orgId = params?.id ? parseInt(params.id) : 0;

  const { data: org, isLoading } = trpc.organizations.getById.useQuery({ id: orgId }, {
    enabled: orgId > 0,
  });

  if (isLoading) {
    return (
      <div className="container py-12 max-w-4xl">
        <div className="h-48 bg-muted animate-pulse rounded-2xl mb-6" />
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-32 bg-muted animate-pulse rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  if (!org) {
    return (
      <div className="container py-20 text-center max-w-4xl">
        <Building2 className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
        <h1 className="font-display text-xl font-bold text-foreground mb-2">Organization not found</h1>
        <p className="text-muted-foreground mb-4">The organization you're looking for doesn't exist.</p>
        <Button onClick={() => window.history.back()}>Go Back</Button>
      </div>
    );
  }

  return (
    <div className="container py-8 max-w-4xl">
      {/* Back button */}
      <button
        onClick={() => window.history.back()}
        className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" /> Back
      </button>

      {/* Organization Header */}
      <Card className="border-border/50 mb-6 overflow-hidden">
        <div className="h-32 bg-gradient-to-r from-jan-green/20 to-blue-500/20" />
        <CardContent className="p-6 -mt-12">
          <div className="flex items-end gap-4 mb-4">
            <div className="w-20 h-20 rounded-2xl bg-background border-4 border-background shadow-lg flex items-center justify-center flex-shrink-0">
              {org.logoUrl ? (
                <img src={org.logoUrl} alt={org.name} className="w-full h-full rounded-xl object-cover" />
              ) : (
                <Building2 className="w-8 h-8 text-muted-foreground" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="font-display text-2xl font-bold text-foreground truncate">{org.name}</h1>
                {org.verified && (
                  <Badge variant="secondary" className="flex items-center gap-1">
                    <Shield className="w-3 h-3" /> Verified
                  </Badge>
                )}
              </div>
              <p className="text-sm text-muted-foreground line-clamp-1">{org.description}</p>
            </div>
          </div>

          {/* Contact Info */}
          <div className="flex flex-wrap gap-4 mt-4 pt-4 border-t border-border/50">
            {org.contactEmail && (
              <a href={`mailto:${org.contactEmail}`} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
                <Mail className="w-4 h-4" /> {org.contactEmail}
              </a>
            )}
            {org.contactPhone && (
              <a href={`tel:${org.contactPhone}`} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
                <Phone className="w-4 h-4" /> {org.contactPhone}
              </a>
            )}
            {org.website && (
              <a href={org.website} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
                <Globe className="w-4 h-4" /> Website <ExternalLink className="w-3 h-3" />
              </a>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Initiatives */}
      <h2 className="font-display text-lg font-bold text-foreground mb-4">
        Initiatives ({org.initiatives?.length || 0})
      </h2>

      {org.initiatives?.length === 0 ? (
        <Card className="border-border/50">
          <CardContent className="p-8 text-center">
            <Calendar className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">No initiatives yet</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {org.initiatives?.map((init) => (
            <Card
              key={init.id}
              className="border-border/50 hover:border-jan-green/30 transition-colors cursor-pointer"
              onClick={() => window.location.href = `/initiative/${init.id}`}
            >
              <CardContent className="p-4">
                <div className="flex items-center gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-medium text-foreground text-sm truncate">{init.title}</h3>
                      <Badge variant="outline" className="text-[10px] flex-shrink-0">{init.category}</Badge>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      {init.city && (
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3 h-3" /> {init.city}
                        </span>
                      )}
                      {init.startDate && (
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {new Date(init.startDate).toLocaleDateString("en-IN", { month: "short", day: "numeric", year: "numeric" })}
                        </span>
                      )}
                      <Badge variant="outline" className={`text-[10px] ${
                        init.status === "ongoing" ? "text-green-600 border-green-200" :
                        init.status === "upcoming" ? "text-blue-600 border-blue-200" :
                        "text-muted-foreground"
                      }`}>
                        {init.status}
                      </Badge>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
