# Dark Theme + Animated Map Background Notes

## Done so far:
1. ✅ App.tsx: ThemeProvider defaultTheme="dark"
2. ✅ index.css: Root vars now dark (deep charcoal oklch(0.13 0.01 180) bg, bright green primary oklch(0.65 0.14 155)). Light theme moved to `.light` class.
3. ✅ Home.tsx: Replaced bg-white decorative blobs with bg-jan-green/5 and bg-jan-teal/5
4. ✅ NotFound.tsx: Fixed text-slate-900/700/600 → text-foreground/foreground/90/muted-foreground, bg-white/80 → bg-card/80

## Remaining:
- Fix `jan-green` custom color — it's oklch(0.52 0.15 155) which is too dark for dark backgrounds. Need to create brighter accent colors for dark mode or use the primary variable.
- Fix `text-jan-green` usages — need brighter color (use primary or a new --jan-green-bright var)
- Create AnimatedMapBackground component for Home hero with:
  - Canvas-based animated map (draw grid lines + dots representing cities, pulse animation)
  - Scroll-reactive: parallax shift + zoom based on window.scrollY
  - Framer Motion for smooth transitions
- The MapPreview already exists (uses MapView component) — keep it but maybe place it in a different section
- Hero section should have the animated canvas map as background with content overlay

## Color palette for dark theme:
- Background: oklch(0.13 0.01 180) — deep charcoal with slight green tint
- Card: oklch(0.17 0.015 180)
- Primary: oklch(0.65 0.14 155) — bright green
- Muted: oklch(0.22 0.015 180)
- Border: oklch(0.26 0.02 180)

## Key file locations:
- Home.tsx: /home/ubuntu/janconnect/client/src/pages/Home.tsx
- index.css: /home/ubuntu/janconnect/client/src/index.css
- App.tsx: /home/ubuntu/janconnect/client/src/App.tsx
- MapView component: /home/ubuntu/janconnect/client/src/components/Map.tsx

## Home.tsx structure (hero section at line 167-240):
- Hero section has gradient background + decorative blobs
- Stats grid below
- MapPreview component is at the bottom (line ~370 area)

## InitiativeDetail green text issue:
- InitiativeDetail.tsx line 159: bg-jan-green/10 text-jan-green — need to check if it looks good in dark
