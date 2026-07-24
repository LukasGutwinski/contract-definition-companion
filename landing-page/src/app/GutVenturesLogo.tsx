"use client";

import { useEffect, useRef, useState } from "react";

type GutVenturesLogoProps = {
  className?: string;
};

export function GutVenturesLogo({ className }: GutVenturesLogoProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const container = containerRef.current;

    if (!container || !("IntersectionObserver" in window)) {
      setIsVisible(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.35 },
    );

    observer.observe(container);

    return () => observer.disconnect();
  }, []);

  return (
    <div className={className} ref={containerRef}>
      {isVisible ? (
        // The SVG contains the original GUT Ventures draw-and-fill animation.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src="/brand/gut-ventures.svg"
          alt="GUT Ventures"
          width={602}
          height={602}
        />
      ) : null}
    </div>
  );
}
