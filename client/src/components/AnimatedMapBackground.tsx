import { useEffect, useRef, useCallback } from "react";

interface CityPoint {
  x: number; // normalized 0-1
  y: number; // normalized 0-1
  radius: number;
  pulseSpeed: number;
  pulsePhase: number;
  name?: string;
}

// Simulated city coordinates (normalized) — approximate Indian cities on a canvas map
const CITY_POINTS: CityPoint[] = [
  { x: 0.30, y: 0.22, radius: 3.5, pulseSpeed: 0.02, pulsePhase: 0, name: "Delhi" },
  { x: 0.33, y: 0.25, radius: 2.5, pulseSpeed: 0.025, pulsePhase: 0.5 },
  { x: 0.38, y: 0.30, radius: 2.0, pulseSpeed: 0.018, pulsePhase: 1.0 },
  { x: 0.45, y: 0.28, radius: 2.0, pulseSpeed: 0.022, pulsePhase: 1.5 },
  { x: 0.52, y: 0.35, radius: 3.0, pulseSpeed: 0.015, pulsePhase: 2.0, name: "Mumbai" },
  { x: 0.58, y: 0.38, radius: 2.5, pulseSpeed: 0.02, pulsePhase: 0.3 },
  { x: 0.42, y: 0.42, radius: 2.0, pulseSpeed: 0.028, pulsePhase: 0.8 },
  { x: 0.50, y: 0.45, radius: 2.5, pulseSpeed: 0.019, pulsePhase: 1.2 },
  { x: 0.62, y: 0.42, radius: 2.0, pulseSpeed: 0.023, pulsePhase: 1.8 },
  { x: 0.68, y: 0.48, radius: 3.0, pulseSpeed: 0.016, pulsePhase: 2.2, name: "Chennai" },
  { x: 0.72, y: 0.40, radius: 2.5, pulseSpeed: 0.021, pulsePhase: 0.7 },
  { x: 0.55, y: 0.50, radius: 2.0, pulseSpeed: 0.024, pulsePhase: 1.4 },
  { x: 0.60, y: 0.52, radius: 2.5, pulseSpeed: 0.017, pulsePhase: 0.4 },
  { x: 0.65, y: 0.55, radius: 2.0, pulseSpeed: 0.026, pulsePhase: 1.9 },
  { x: 0.48, y: 0.55, radius: 2.0, pulseSpeed: 0.02, pulsePhase: 0.9 },
  { x: 0.35, y: 0.48, radius: 2.0, pulseSpeed: 0.022, pulsePhase: 1.6 },
  { x: 0.75, y: 0.35, radius: 2.5, pulseSpeed: 0.018, pulsePhase: 2.5 },
  { x: 0.78, y: 0.45, radius: 2.0, pulseSpeed: 0.025, pulsePhase: 0.2 },
  { x: 0.28, y: 0.35, radius: 2.0, pulseSpeed: 0.02, pulsePhase: 1.1 },
  { x: 0.25, y: 0.40, radius: 1.5, pulseSpeed: 0.03, pulsePhase: 2.8 },
  { x: 0.40, y: 0.55, radius: 2.5, pulseSpeed: 0.019, pulsePhase: 0.6 },
  { x: 0.55, y: 0.60, radius: 2.0, pulseSpeed: 0.023, pulsePhase: 1.3 },
  { x: 0.62, y: 0.62, radius: 2.0, pulseSpeed: 0.021, pulsePhase: 2.1 },
  { x: 0.70, y: 0.58, radius: 2.5, pulseSpeed: 0.017, pulsePhase: 0.1 },
  { x: 0.45, y: 0.35, radius: 3.5, pulseSpeed: 0.014, pulsePhase: 1.7, name: "Bangalore" },
  { x: 0.50, y: 0.30, radius: 2.5, pulseSpeed: 0.02, pulsePhase: 0.5 },
  { x: 0.58, y: 0.28, radius: 2.0, pulseSpeed: 0.024, pulsePhase: 1.0 },
  { x: 0.65, y: 0.32, radius: 2.5, pulseSpeed: 0.018, pulsePhase: 2.3 },
  { x: 0.72, y: 0.28, radius: 2.0, pulseSpeed: 0.022, pulsePhase: 0.8 },
  { x: 0.35, y: 0.55, radius: 2.0, pulseSpeed: 0.025, pulsePhase: 1.5 },
  { x: 0.30, y: 0.50, radius: 2.5, pulseSpeed: 0.016, pulsePhase: 2.6 },
  { x: 0.42, y: 0.35, radius: 2.0, pulseSpeed: 0.02, pulsePhase: 0.3 },
  { x: 0.68, y: 0.65, radius: 2.0, pulseSpeed: 0.023, pulsePhase: 1.8 },
  { x: 0.75, y: 0.52, radius: 2.5, pulseSpeed: 0.019, pulsePhase: 0.4 },
  { x: 0.22, y: 0.45, radius: 1.5, pulseSpeed: 0.028, pulsePhase: 2.4 },
  { x: 0.52, y: 0.42, radius: 2.0, pulseSpeed: 0.021, pulsePhase: 0.9 },
  { x: 0.47, y: 0.48, radius: 2.5, pulseSpeed: 0.017, pulsePhase: 1.2 },
  { x: 0.58, y: 0.45, radius: 2.0, pulseSpeed: 0.024, pulsePhase: 2.0 },
  { x: 0.63, y: 0.50, radius: 2.5, pulseSpeed: 0.018, pulsePhase: 0.7 },
  { x: 0.55, y: 0.55, radius: 2.0, pulseSpeed: 0.022, pulsePhase: 1.6 },
];

// Connection lines between nearby cities
const CONNECTIONS: [number, number][] = [];
for (let i = 0; i < CITY_POINTS.length; i++) {
  for (let j = i + 1; j < CITY_POINTS.length; j++) {
    const dx = CITY_POINTS[i].x - CITY_POINTS[j].x;
    const dy = CITY_POINTS[i].y - CITY_POINTS[j].y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < 0.15) {
      CONNECTIONS.push([i, j]);
    }
  }
}

export function AnimatedMapBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>(0);
  const scrollYRef = useRef(0);

  const drawMap = useCallback((ctx: CanvasRenderingContext2D, width: number, height: number, time: number) => {
    const scrollOffset = scrollYRef.current * 0.0005;
    const scale = 1 + scrollOffset * 0.3;

    ctx.clearRect(0, 0, width, height);
    ctx.save();

    // Apply scale and slight translation based on scroll
    const centerX = width / 2;
    const centerY = height / 2;
    ctx.translate(centerX, centerY);
    ctx.scale(scale, scale);
    ctx.translate(-centerX + scrollOffset * width * 0.1, -centerY);

    // Draw grid lines
    ctx.strokeStyle = "rgba(74, 222, 128, 0.08)";
    ctx.lineWidth = 0.5;
    const gridSpacing = 60;
    const gridOffsetX = (time * 2) % gridSpacing;
    const gridOffsetY = (time * 1.5) % gridSpacing;

    for (let x = gridOffsetX; x < width; x += gridSpacing) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
    for (let y = gridOffsetY; y < height; y += gridSpacing) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    // Draw connection lines
    ctx.strokeStyle = "rgba(74, 222, 128, 0.12)";
    ctx.lineWidth = 0.8;
    CONNECTIONS.forEach(([i, j]) => {
      const from = CITY_POINTS[i];
      const to = CITY_POINTS[j];
      ctx.beginPath();
      ctx.moveTo(from.x * width, from.y * height);
      // Curved line
      const cpX = (from.x + to.x) / 2 * width;
      const cpY = (from.y + to.y) / 2 * height - 20;
      ctx.quadraticCurveTo(cpX, cpY, to.x * width, to.y * height);
      ctx.stroke();

      // Animated dot along the line
      const dotT = ((time * 0.0003 + i * 0.1) % 1);
      const t2 = 1 - dotT;
      const dotX = t2 * t2 * from.x * width + 2 * t2 * dotT * cpX + dotT * dotT * to.x * width;
      const dotY = t2 * t2 * from.y * height + 2 * t2 * dotT * cpY + dotT * dotT * to.y * height;
      ctx.fillStyle = "rgba(74, 222, 128, 0.5)";
      ctx.beginPath();
      ctx.arc(dotX, dotY, 1.5, 0, Math.PI * 2);
      ctx.fill();
    });

    // Draw city points
    CITY_POINTS.forEach((city) => {
      const cx = city.x * width;
      const cy = city.y * height;
      const pulse = Math.sin(time * city.pulseSpeed + city.pulsePhase) * 0.5 + 0.5;
      const currentRadius = city.radius + pulse * 2;
      const alpha = 0.2 + pulse * 0.4;

      // Outer glow
      ctx.fillStyle = `rgba(74, 222, 128, ${alpha * 0.2})`;
      ctx.beginPath();
      ctx.arc(cx, cy, currentRadius * 2.5, 0, Math.PI * 2);
      ctx.fill();

      // Inner dot
      ctx.fillStyle = `rgba(74, 222, 128, ${alpha})`;
      ctx.beginPath();
      ctx.arc(cx, cy, currentRadius * 0.5, 0, Math.PI * 2);
      ctx.fill();

      // Center bright point
      ctx.fillStyle = `rgba(163, 255, 198, ${alpha * 0.8})`;
      ctx.beginPath();
      ctx.arc(cx, cy, currentRadius * 0.25, 0, Math.PI * 2);
      ctx.fill();
    });

    ctx.restore();
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
        canvas.width = width * pixelRatio;
        canvas.height = height * pixelRatio;
        ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
      }
    });

    resizeObserver.observe(canvas.parentElement || canvas);

    const handleScroll = () => {
      scrollYRef.current = window.scrollY;
    };
    window.addEventListener("scroll", handleScroll, { passive: true });

    const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
    const drawStatic = () => drawMap(ctx, canvas.width / pixelRatio, canvas.height / pixelRatio, 0);
    let startTime = performance.now();

    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      drawMap(ctx, canvas.width / pixelRatio, canvas.height / pixelRatio, elapsed);
      animationRef.current = requestAnimationFrame(animate);
    };

    if (motionQuery.matches) {
      drawStatic();
    } else {
      animationRef.current = requestAnimationFrame(animate);
    }

    const handleMotionPreference = (event: MediaQueryListEvent) => {
      cancelAnimationFrame(animationRef.current);
      if (event.matches) {
        drawStatic();
      } else {
        startTime = performance.now();
        animationRef.current = requestAnimationFrame(animate);
      }
    };
    motionQuery.addEventListener("change", handleMotionPreference);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener("scroll", handleScroll);
      motionQuery.removeEventListener("change", handleMotionPreference);
      cancelAnimationFrame(animationRef.current);
    };
  }, [drawMap]);

  return (
    <div className="animated-map-bg" aria-hidden="true">
      <canvas ref={canvasRef} />
    </div>
  );
}

export default AnimatedMapBackground;
