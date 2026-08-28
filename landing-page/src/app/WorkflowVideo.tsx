"use client";

import { useEffect, useRef } from "react";

type WorkflowVideoProps = {
  className?: string;
};

export function WorkflowVideo({ className }: WorkflowVideoProps) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;

    if (!video) {
      return;
    }

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let isVisible = false;

    const playVideo = () => {
      if (reducedMotion.matches) {
        video.pause();
        return;
      }

      void video.play().catch(() => {
        // The poster remains visible if the browser declines autoplay.
      });
    };

    const observer = new IntersectionObserver(
      ([entry]) => {
        isVisible = entry?.isIntersecting ?? false;

        if (isVisible) {
          playVideo();
        } else {
          video.pause();
        }
      },
      { rootMargin: "160px 0px", threshold: 0.2 },
    );

    const handleMotionPreference = () => {
      if (reducedMotion.matches) {
        video.pause();
      } else if (isVisible) {
        playVideo();
      }
    };

    observer.observe(video);
    reducedMotion.addEventListener("change", handleMotionPreference);

    return () => {
      observer.disconnect();
      reducedMotion.removeEventListener("change", handleMotionPreference);
    };
  }, []);

  return (
    <video
      ref={videoRef}
      className={className}
      width={1920}
      height={1248}
      loop
      muted
      playsInline
      preload="metadata"
      poster="/product/contract-definitions-workflow-poster.webp"
      aria-label="Walkthrough of Contract Definitions scanning an agreement, opening a definition, and navigating its occurrences in Microsoft Word"
    >
      <source src="/product/contract-definitions-workflow.mp4" type="video/mp4" />
      Your browser does not support embedded videos.
    </video>
  );
}
