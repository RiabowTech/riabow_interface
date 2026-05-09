import { Trans } from "@lingui/macro";
import { useState, useEffect } from "react";
import "./ScanningEffect.css";

interface ScanningEffectProps {
  duration?: number; // Duration in milliseconds
  onComplete?: () => void;
}

export function ScanningEffect({ duration = 2500, onComplete }: ScanningEffectProps) {
  const [isScanning, setIsScanning] = useState(true);

  useEffect(() => {
    // Set animation duration as CSS variable (in seconds)
    const durationInSeconds = duration / 1000;
    const scanDuration = durationInSeconds * 0.8; // Main scan animation (80% of total)
    const fadeOutDuration = durationInSeconds * 0.2; // Fade out animation (20% of total)
    const fadeOutDelay = durationInSeconds * 0.8; // Fade out starts after scan completes
    const verticalDelay = durationInSeconds * 0.08; // Vertical scan delay (8% of total)
    
    // Center content (radar + text) fades out earlier for smooth scanning effect
    const centerFadeDelay = durationInSeconds * 0.6; // Start fading at 60%
    const centerFadeDuration = durationInSeconds * 0.3; // Fade over 30% of total time
    
    document.documentElement.style.setProperty('--scan-duration', `${scanDuration}s`);
    document.documentElement.style.setProperty('--scan-fadeout-duration', `${fadeOutDuration}s`);
    document.documentElement.style.setProperty('--scan-fadeout-delay', `${fadeOutDelay}s`);
    document.documentElement.style.setProperty('--scan-vertical-delay', `${verticalDelay}s`);
    document.documentElement.style.setProperty('--scan-center-fade-delay', `${centerFadeDelay}s`);
    document.documentElement.style.setProperty('--scan-center-fade-duration', `${centerFadeDuration}s`);

    const timer = setTimeout(() => {
      setIsScanning(false);
      onComplete?.();
    }, duration);

    /**
     * Zanbara 壳为顶栏 + 主内容，通常无左侧 `.zanbara-sidenav`；未检测到侧栏时须为 0，
     * 否则 CSS 回退 210px 会把整段扫描画在错误偏移上。
     */
    const detectDimensions = () => {
      const sidebar = document.querySelector(".zanbara-sidenav");
      if (sidebar) {
        const w = sidebar.getBoundingClientRect().width;
        document.documentElement.style.setProperty("--detected-sidebar-width", `${w > 0.5 ? w : 0}px`);
      } else {
        document.documentElement.style.setProperty("--detected-sidebar-width", "0px");
      }

      const header =
        document.querySelector('[data-qa="header"]') ?? document.querySelector("header");
      if (header) {
        const height = header.getBoundingClientRect().height;
        document.documentElement.style.setProperty("--detected-header-height", `${height}px`);
      }
    };

    detectDimensions();
    window.addEventListener("resize", detectDimensions);

    const sidebar = document.querySelector(".zanbara-sidenav");
    const sidebarObserver = sidebar ? new MutationObserver(detectDimensions) : null;
    if (sidebarObserver && sidebar) {
      sidebarObserver.observe(sidebar, { attributes: true, attributeFilter: ["class"] });
    }

    const headerEl = document.querySelector('[data-qa="header"]') ?? document.querySelector("header");
    const ro = headerEl ? new ResizeObserver(() => detectDimensions()) : null;
    if (ro && headerEl) {
      ro.observe(headerEl);
    }

    return () => {
      clearTimeout(timer);
      window.removeEventListener("resize", detectDimensions);
      sidebarObserver?.disconnect();
      ro?.disconnect();
      document.documentElement.style.removeProperty("--detected-sidebar-width");
      document.documentElement.style.removeProperty("--detected-header-height");
    };
  }, [duration, onComplete]);

  if (!isScanning) return null;

  return (
    <div className="scan-loading-overlay">
      <div className="scan-reveal-mask-vertical"></div>
      <div className="scan-blur-mask-horizontal"></div>
      <div className="scan-line-horizontal"></div>
      <div className="scan-line-vertical"></div>
      <div className="scan-center">
        <div className="scan-radar"></div>
        <div className="scan-text">
          <Trans>SCANNING STRATEGIES</Trans>
        </div>
      </div>
    </div>
  );
}

