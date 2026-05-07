import { Trans, t } from "@lingui/macro";
import { useEffect, useRef, useState } from "react";

import type { EpochOption } from "../../hooks/usePointsData";

import "./PointsToolbar.css";

type Season = { id: number; label: string };

type Props = {
  seasons: Season[];
  selectedSeasonId: number | null;
  onSeasonChange: (seasonId: number) => void;
  epochsInSeason: EpochOption[];
  selectedEpochId: number | null;
  onEpochChange: (epochId: number) => void;
};

function PointsToolbarDropdownChevron({ open }: { open: boolean }) {
  return (
    <span className={`points-toolbar-dd__chev ${open ? "is-open" : ""}`} aria-hidden>
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" fill="none" focusable="false">
        <path
          d="M15.002 5.06543L14.4688 5.59375L8.5293 11.4795L8.00098 12.002L7.47363 11.4795L1.5332 5.59375L1.00098 5.06543L2.05664 4L2.58984 4.52734L8.00098 9.89062L13.4131 4.52734L13.9463 4L15.002 5.06543Z"
          fill="#E2E7ED"
          fillOpacity={0.6}
        />
      </svg>
    </span>
  );
}

function statusIsLive(status: string): boolean {
  const s = status.toLowerCase();
  return s === "active" || s === "live";
}

function epochDurationDays(startDate: string, endDate: string): number | null {
  const a = new Date(startDate).getTime();
  const b = new Date(endDate).getTime();
  if (Number.isNaN(a) || Number.isNaN(b) || b <= a) return null;
  return Math.max(1, Math.ceil((b - a) / 86400000));
}

function epochStatusPhrase(status: string): string {
  const s = status.toLowerCase();
  if (s === "active" || s === "live") return t`In Progress`;
  if (s === "ended" || s === "complete" || s === "completed") return t`Ended`;
  if (s === "pending") return t`Pending`;
  return status || t`Unknown`;
}

function SeasonEpochDropdown({
  kind,
  labelMain,
  labelSub,
  live,
  open,
  disabled,
  onToggle,
  children,
}: {
  kind: "season" | "epoch";
  labelMain: string;
  labelSub?: string;
  live: boolean;
  open: boolean;
  disabled?: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onToggle();
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open, onToggle]);

  return (
    <div className={`points-toolbar-dd ${kind}`} ref={ref}>
      <button
        type="button"
        disabled={disabled}
        className={[
          "points-toolbar-dd__trigger",
          open ? "is-open" : "",
          disabled ? "is-disabled" : "",
        ]
          .filter(Boolean)
          .join(" ")}
        onClick={() => !disabled && onToggle()}
      >
        <span className="points-toolbar-dd__accent" aria-hidden />
        <span className="points-toolbar-dd__body">
          {live ? (
            <span className="points-toolbar-dd__live">
              <Trans>Live</Trans>
            </span>
          ) : null}
          <span className="points-toolbar-dd__main">{labelMain}</span>
          {labelSub ? <span className="points-toolbar-dd__sub">{labelSub}</span> : null}
        </span>
        <PointsToolbarDropdownChevron open={open} />
      </button>
      {open && !disabled ? <div className="points-toolbar-dd__menu">{children}</div> : null}
    </div>
  );
}

export function PointsToolbar({
  seasons,
  selectedSeasonId,
  onSeasonChange,
  epochsInSeason,
  selectedEpochId,
  onEpochChange,
}: Props) {
  const [openSeason, setOpenSeason] = useState(false);
  const [openEpoch, setOpenEpoch] = useState(false);

  const selectedSeason = seasons.find((s) => s.id === selectedSeasonId) ?? seasons[0];
  const selectedEpoch = epochsInSeason.find((e) => e.id === selectedEpochId) ?? epochsInSeason[0];
  const seasonHasLive = epochsInSeason.some((e) => statusIsLive(e.status));
  const noSeasons = seasons.length === 0;
  const noEpochs = epochsInSeason.length === 0;

  return (
    <div className="points-toolbar">
      <div className="points-toolbar__title">
        <Trans>Points Dashboard</Trans>
      </div>
      <div className="points-toolbar__row">
        <div className="points-toolbar__selects">
          <SeasonEpochDropdown
            kind="season"
            labelMain={selectedSeason?.label ?? t`Season 1`}
            live={seasonHasLive}
            open={openSeason}
            disabled={noSeasons}
            onToggle={() => {
              setOpenEpoch(false);
              setOpenSeason((v) => !v);
            }}
          >
            {seasons.map((s) => (
              <button
                key={s.id}
                type="button"
                className={`points-toolbar-dd__item ${s.id === selectedSeasonId ? "is-active" : ""}`}
                onClick={() => {
                  onSeasonChange(s.id);
                  setOpenSeason(false);
                }}
              >
                {s.label}
              </button>
            ))}
          </SeasonEpochDropdown>

          <SeasonEpochDropdown
            kind="epoch"
            labelMain={selectedEpoch ? t`Epoch ${selectedEpoch.id}` : t`Epoch`}
            labelSub={
              selectedEpoch ? `[${selectedEpoch.startDate} → ${selectedEpoch.endDate}]` : undefined
            }
            live={selectedEpoch ? statusIsLive(selectedEpoch.status) : false}
            open={openEpoch}
            disabled={noEpochs}
            onToggle={() => {
              setOpenSeason(false);
              setOpenEpoch((v) => !v);
            }}
          >
            {epochsInSeason.map((e) => {
              const days = epochDurationDays(e.startDate, e.endDate);
              const statusWord = epochStatusPhrase(e.status);
              const subLine = days != null ? t`${days} days · ${statusWord}` : statusWord;
              const live = statusIsLive(e.status);
              return (
                <button
                  key={e.id}
                  type="button"
                  className={[
                    "points-toolbar-dd__epoch",
                    e.id === selectedEpochId ? "is-selected" : "",
                    live ? "is-live" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  onClick={() => {
                    onEpochChange(e.id);
                    setOpenEpoch(false);
                  }}
                >
                  <div className="points-toolbar-dd__epoch-left">
                    <span className="points-toolbar-dd__epoch-accent" aria-hidden />
                    <div className="points-toolbar-dd__epoch-copy">
                      <div className="points-toolbar-dd__epoch-title">
                        <span
                          className={
                            e.id === selectedEpochId
                              ? "points-toolbar-dd__epoch-name points-toolbar-dd__epoch-name--selected"
                              : "points-toolbar-dd__epoch-name"
                          }
                        >
                          {t`Epoch ${e.id}`}
                        </span>
                        <span className="points-toolbar-dd__epoch-season">· {e.seasonLabel}</span>
                      </div>
                      <div className="points-toolbar-dd__epoch-meta">
                        <span>
                          {e.startDate} → {e.endDate}
                        </span>
                        <span className="points-toolbar-dd__epoch-meta2">{subLine}</span>
                      </div>
                    </div>
                  </div>
                  <span
                    className={
                      live
                        ? "points-toolbar-dd__tag points-toolbar-dd__tag--live"
                        : "points-toolbar-dd__tag points-toolbar-dd__tag--ended"
                    }
                  >
                    {live ? <Trans>Live</Trans> : <Trans>Ended</Trans>}
                  </span>
                </button>
              );
            })}
          </SeasonEpochDropdown>
        </div>
      </div>
    </div>
  );
}
