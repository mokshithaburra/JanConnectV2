export type CivicVisual = {
  src: string;
  alt: string;
  accent: string;
  tint: string;
};

const VISUALS: Record<string, CivicVisual> = {
  Environment: {
    src: "/media/tree-planting_bcf46eee.jpg",
    alt: "Volunteers planting trees together",
    accent: "#54d99b",
    tint: "from-emerald-500/35 via-emerald-900/10 to-transparent",
  },
  Education: {
    src: "/media/community-cleanup_713c313f.jpg",
    alt: "A community group gathered for a local civic drive",
    accent: "#72b7ff",
    tint: "from-sky-500/35 via-sky-900/10 to-transparent",
  },
  Healthcare: {
    src: "/media/community-response_073bea00.jpg",
    alt: "Community health response volunteers near a bus",
    accent: "#ff7e9f",
    tint: "from-rose-500/35 via-rose-900/10 to-transparent",
  },
  "Blood Donation": {
    src: "/media/blood-donation_1347c69e.jpg",
    alt: "Blood donation awareness visual",
    accent: "#ff6f74",
    tint: "from-red-500/35 via-red-900/10 to-transparent",
  },
  "Animal Welfare": {
    src: "/media/community-response_073bea00.jpg",
    alt: "Volunteers supporting a community response effort",
    accent: "#ffc764",
    tint: "from-amber-500/35 via-amber-900/10 to-transparent",
  },
  "Disaster Relief": {
    src: "/media/disaster-relief_7502ce0b.jpg",
    alt: "Relief volunteers supporting families after a disaster",
    accent: "#ff9d5c",
    tint: "from-orange-500/35 via-orange-900/10 to-transparent",
  },
  "Community Service": {
    src: "/media/public-action_c1407b2e.jpg",
    alt: "Citizens taking part in a public civic action",
    accent: "#c391ff",
    tint: "from-purple-500/35 via-purple-900/10 to-transparent",
  },
  "Awareness Campaigns": {
    src: "/media/relief-response_f57f47c4.jpg",
    alt: "People collaborating during a public awareness response",
    accent: "#9c8cff",
    tint: "from-indigo-500/35 via-indigo-900/10 to-transparent",
  },
  "Public Consultations": {
    src: "/media/community-cleanup_713c313f.jpg",
    alt: "Residents gathered for a local public discussion",
    accent: "#63d7dc",
    tint: "from-cyan-500/35 via-cyan-900/10 to-transparent",
  },
};

const VISUAL_FALLBACKS = Object.values(VISUALS);

export function getCivicVisual(category: string, id = 0): CivicVisual {
  return VISUALS[category] || VISUAL_FALLBACKS[Math.abs(id) % VISUAL_FALLBACKS.length];
}

export type ParticipationPoint = {
  latitude?: number | null;
  longitude?: number | null;
};

function toRadians(value: number) {
  return (value * Math.PI) / 180;
}

export function calculateImpactRadius(points: ParticipationPoint[]): number {
  const coordinates = points.filter(
    (point): point is { latitude: number; longitude: number } =>
      typeof point.latitude === "number" && typeof point.longitude === "number",
  );

  if (coordinates.length < 2) return 0;

  let maxDistance = 0;
  for (let index = 0; index < coordinates.length; index += 1) {
    for (let compareIndex = index + 1; compareIndex < coordinates.length; compareIndex += 1) {
      const first = coordinates[index];
      const second = coordinates[compareIndex];
      const latitudeDelta = toRadians(second.latitude - first.latitude);
      const longitudeDelta = toRadians(second.longitude - first.longitude);
      const haversine =
        Math.sin(latitudeDelta / 2) ** 2 +
        Math.cos(toRadians(first.latitude)) *
          Math.cos(toRadians(second.latitude)) *
          Math.sin(longitudeDelta / 2) ** 2;
      const centralAngle = 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
      maxDistance = Math.max(maxDistance, 6371 * centralAngle);
    }
  }

  return Math.round(maxDistance);
}

export type BadgeProgressInput = {
  score: number;
  bookmarks: number;
  initiatives: number;
  posts: number;
};

export type CivicBadge = {
  id: string;
  label: string;
  description: string;
  icon: "seedling" | "compass" | "voice" | "spark";
  unlocked: boolean;
  progress: number;
};

export function getCivicBadges({ score, bookmarks, initiatives, posts }: BadgeProgressInput): CivicBadge[] {
  return [
    {
      id: "first-signal",
      label: "First Signal",
      description: "Save your first initiative",
      icon: "seedling",
      unlocked: bookmarks >= 1,
      progress: Math.min(bookmarks, 1),
    },
    {
      id: "map-reader",
      label: "Map Reader",
      description: "Track five civic opportunities",
      icon: "compass",
      unlocked: bookmarks >= 5,
      progress: Math.min(bookmarks / 5, 1),
    },
    {
      id: "civic-voice",
      label: "Civic Voice",
      description: "Share your first community post",
      icon: "voice",
      unlocked: posts >= 1,
      progress: Math.min(posts, 1),
    },
    {
      id: "momentum",
      label: "Civic Momentum",
      description: "Reach 100 contribution points",
      icon: "spark",
      unlocked: score >= 100,
      progress: Math.min(score / 100, 1),
    },
    {
      id: "field-builder",
      label: "Field Builder",
      description: "Track three civic initiatives",
      icon: "seedling",
      unlocked: initiatives >= 3,
      progress: Math.min(initiatives / 3, 1),
    },
  ];
}

export function getNextBadge(badges: CivicBadge[]): CivicBadge | null {
  return badges.find((badge) => !badge.unlocked) || null;
}
