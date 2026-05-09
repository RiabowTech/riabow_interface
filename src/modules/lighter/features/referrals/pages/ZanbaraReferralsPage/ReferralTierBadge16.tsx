import { memo, useId, useMemo } from "react";
import type { CSSProperties } from "react";

const tierBadgeSvgUrls = {
  ...import.meta.glob<string>("./assets/tier-badges/bronze-*.svg", { eager: true, query: "?url", import: "default" }),
  ...import.meta.glob<string>("./assets/tier-badges/silver-*.svg", { eager: true, query: "?url", import: "default" }),
  ...import.meta.glob<string>("./assets/tier-badges/gold-*.svg", { eager: true, query: "?url", import: "default" }),
} as Record<string, string>;

/**
 * Figma `Badge_16` (16×16) — layered SVG exports from Zanbara-Website v1.0 Referrals table.
 * Noise / 1.4MB texture layers omitted (imperceptible at 16px; keeps bundle small).
 */
type CrownVariant = "bronze" | "silver" | "gold";

type CrownLayout = {
  top: string;
  right: string;
  bottom: string;
  left: string;
  mixBlendMode?: CSSProperties["mixBlendMode"];
};

const CROWN_LAYOUT: CrownLayout[] = [
  { top: "27.61%", right: "17.51%", bottom: "58.65%", left: "17.47%" },
  { top: "27.61%", right: "17.51%", bottom: "58.65%", left: "17.47%" },
  { top: "27.61%", right: "17.51%", bottom: "58.65%", left: "17.47%", mixBlendMode: "soft-light" },
  { top: "20.31%", right: "6.25%", bottom: "28.76%", left: "6.25%" },
  { top: "20.31%", right: "6.25%", bottom: "28.76%", left: "6.25%", mixBlendMode: "overlay" },
  { top: "20.31%", right: "6.25%", bottom: "28.76%", left: "6.25%", mixBlendMode: "overlay" },
  { top: "20.31%", right: "6.25%", bottom: "56.16%", left: "6.25%", mixBlendMode: "overlay" },
  { top: "53.21%", right: "10.76%", bottom: "33.19%", left: "10.61%", mixBlendMode: "soft-light" },
  { top: "52.34%", right: "10.63%", bottom: "33.92%", left: "10.49%", mixBlendMode: "hard-light" },
  { top: "62.81%", right: "12.49%", bottom: "20.31%", left: "12.5%" },
  { top: "66.44%", right: "17.44%", bottom: "23.08%", left: "17.44%" },
  { top: "27.89%", right: "43.76%", bottom: "57.16%", left: "43.59%", mixBlendMode: "overlay" },
  { top: "29.35%", right: "45.22%", bottom: "58.62%", left: "45.04%" },
  { top: "29.35%", right: "45.22%", bottom: "58.62%", left: "45.04%", mixBlendMode: "overlay" },
];

const CROWN_ASSETS: Record<CrownVariant, string[]> = {
  bronze: [
    "51abd791-6a2a-48a4-9a8f-adc34659bf16",
    "0b825ecf-a69f-4fa7-b881-10a3b44c5651",
    "5d8727e2-e985-4d4d-8fbb-662ad4e3e1aa",
    "33acf69e-7411-4854-91fa-a21a9686a4df",
    "cfaff46c-7e80-478e-b11c-d7195d7bcd59",
    "40be2619-9998-4391-944d-12ce1d5d95f3",
    "113e4ca8-386c-4a7f-be0d-92c394cf1b84",
    "4bcfe147-4c42-45cf-861f-67a16a6f2766",
    "668aaf14-3598-479f-acce-1257683992f1",
    "1e7b035c-bb54-4384-90a2-714e309609ee",
    "374131dc-f1b0-4d70-8a94-8abdbc394d3b",
    "4d1f14e5-534e-4bb7-a2ec-2a750795e98f",
    "0a2d3f97-a872-445c-8582-f761835b9772",
    "663d7e3d-f0bd-44b3-a5fe-90c44be4e6e2",
  ],
  silver: [
    "3ce4134f-7689-404c-b29e-8dbbf2c92f8e",
    "1fd619a9-4a7e-42e1-970a-5ee193e4fde5",
    "19f2d046-d044-4cac-90e3-06d28a0ea6b4",
    "aae48a8d-2f07-4702-81ac-498aed825a85",
    "01b2b2eb-b01b-42b8-9d19-73559245c401",
    "c2b612e1-d23f-4b89-b9f9-d4b750f66260",
    "76ec097c-c077-4eb9-a953-2c66c319c2ad",
    "bb542189-8ddd-4cc3-8542-a2b5a4f8096d",
    "717b6907-c26e-42f8-9e0e-995cadf689f6",
    "d218b4af-8a3a-458d-8ba7-56a245e9e1e2",
    "92e4afe1-ccc8-4698-9b09-d58ff8dc58a1",
    "d9cdf857-8a54-430b-83d6-7920732b0d27",
    "d039798b-09aa-4df4-91b1-16dd4b3a6cf4",
    "245cbd03-38ae-4a38-8e4d-f16eba37f22a",
  ],
  gold: [
    "5458fe44-8646-4fee-b8a5-0d87bec0b4cd",
    "749682df-a04c-420f-93d8-9c0ba22c72a8",
    "d8d73b6e-131b-425e-b776-ab8ae2a2e0cf",
    "990bdf64-ce9b-4449-a8e6-9054604c807f",
    "016bb9f3-9c88-40c4-b778-057bb23b18a3",
    "c86614c4-fcef-4e59-81f8-832e24654bf9",
    "6f9d99fc-3bc0-43a0-850f-0e4787cb4143",
    "c4701e33-5d08-4f49-853d-bf84da5716e6",
    "c94c9e54-76c9-4f17-9eeb-ee69a2183ccb",
    "9d51eba7-ca71-4391-8bcb-304b228d8b12",
    "c996eaa2-f6af-49a8-b635-7941adc88823",
    "316ccbac-fac8-491c-9e4c-418323a53fea",
    "58be22d2-6b40-4479-ba34-c3084886b761",
    "c124cd7b-8226-481c-bd27-cde2eaed132d",
  ],
};

function crownSrc(variant: CrownVariant, assetId: string): string {
  const key = `./assets/tier-badges/${variant}-${assetId}.svg`;
  return tierBadgeSvgUrls[key] ?? "";
}

const CrownF16Layer = memo(function CrownF16Layer({
  top,
  right,
  bottom,
  left,
  mixBlendMode,
  src,
}: {
  top: string;
  right: string;
  bottom: string;
  left: string;
  mixBlendMode?: CSSProperties["mixBlendMode"];
  src: string;
}) {
  const style = useMemo(
    () => ({
      top,
      right,
      bottom,
      left,
      mixBlendMode,
    }),
    [top, right, bottom, left, mixBlendMode]
  );
  return (
    <div className="ref-tier-badge-f16__layer" style={style}>
      <img className="ref-tier-badge-f16__img" src={src} alt="" draggable={false} />
    </div>
  );
});

function CrownBadge16({ variant }: { variant: CrownVariant }) {
  const ids = CROWN_ASSETS[variant];
  return (
    <div className="ref-tier-badge-f16" aria-hidden>
      {CROWN_LAYOUT.map((box, i) => {
        const id = ids[i];
        if (!id) return null;
        return (
          <CrownF16Layer
            key={`${variant}-${id}`}
            top={box.top}
            right={box.right}
            bottom={box.bottom}
            left={box.left}
            mixBlendMode={box.mixBlendMode}
            src={crownSrc(variant, id)}
          />
        );
      })}
    </div>
  );
}

/** Faceted diamond — Figma `Badge_16` diamond variant uses heavy masks; this matches hue / read at 16px. */
function DiamondBadge16() {
  const uid = useId().replace(/:/g, "");
  const gTop = `refDiaTop-${uid}`;
  const gBot = `refDiaBot-${uid}`;
  const gSide = `refDiaSide-${uid}`;
  const gSide2 = `refDiaSide2-${uid}`;
  return (
    <svg className="ref-tier-badge-diamond" width={16} height={16} viewBox="0 0 16 16" aria-hidden>
      <defs>
        <linearGradient id={gTop} x1="8" y1="0" x2="8" y2="8" gradientUnits="userSpaceOnUse">
          <stop stopColor="#f2ffff" />
          <stop offset="1" stopColor="#56bbc9" />
        </linearGradient>
        <linearGradient id={gBot} x1="8" y1="8" x2="8" y2="16" gradientUnits="userSpaceOnUse">
          <stop stopColor="#3a8aa0" />
          <stop offset="1" stopColor="#0f2f44" />
        </linearGradient>
        <linearGradient id={gSide} x1="0" y1="4" x2="6" y2="10" gradientUnits="userSpaceOnUse">
          <stop stopColor="#7fe8f0" stopOpacity={0.95} />
          <stop offset="1" stopColor="#1e5f78" />
        </linearGradient>
        <linearGradient id={gSide2} x1="16" y1="4" x2="10" y2="10" gradientUnits="userSpaceOnUse">
          <stop stopColor="#9af6ff" stopOpacity={0.9} />
          <stop offset="1" stopColor="#205a72" />
        </linearGradient>
      </defs>
      <path d="M8 1.2L14.2 5.4L8 14.8L1.8 5.4L8 1.2Z" fill={`url(#${gTop})`} />
      <path d="M1.8 5.4L8 14.8L8 5.4L1.8 5.4Z" fill={`url(#${gSide})`} />
      <path d="M14.2 5.4L8 14.8L8 5.4L14.2 5.4Z" fill={`url(#${gSide2})`} />
      <path d="M4.2 5.4h7.6L8 1.2L4.2 5.4Z" fill="#d8ffff" fillOpacity={0.35} />
      <path d="M8 5.4v9.4l6.2-9.4H8Z" fill={`url(#${gBot})`} fillOpacity={0.55} />
      <path d="M8 5.4v9.4L1.8 5.4H8Z" fill={`url(#${gBot})`} fillOpacity={0.45} />
    </svg>
  );
}

export type ReferralTierBadgeKind = "none" | "crownGold" | "crownTeal" | "crownYellow" | "diamond";

export function ReferralTierBadge16({ kind }: { kind: ReferralTierBadgeKind }) {
  if (kind === "none") {
    return <span className="ref-tier-badge-spacer" aria-hidden />;
  }
  if (kind === "crownGold") {
    return <CrownBadge16 variant="bronze" />;
  }
  if (kind === "crownTeal") {
    return <CrownBadge16 variant="silver" />;
  }
  if (kind === "crownYellow") {
    return <CrownBadge16 variant="gold" />;
  }
  return <DiamondBadge16 />;
}
