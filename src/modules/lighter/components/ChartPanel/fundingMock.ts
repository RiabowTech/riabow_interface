export const FUNDING_RANGE_OPTIONS = ["24H", "1W", "1M"] as const;

export type FundingRange = (typeof FUNDING_RANGE_OPTIONS)[number];

export type FundingHistoryPoint = {
  label: string;
  rate: number;
  positiveRate?: number;
  negativeRate?: number;
};

export type FundingSummary = {
  realtimeFundingRate: string;
  interval: string;
  nextFundingCountdown: string;
  weeklyFundingRate: string;
  monthlyFundingRate: string;
  yearlyFundingRate: string;
};

export type FundingViewModel = {
  summary: FundingSummary;
  history: FundingHistoryPoint[];
};

const BASE_SUMMARY: FundingSummary = {
  realtimeFundingRate: "-0.0009%",
  interval: "1h",
  nextFundingCountdown: "49:33",
  weeklyFundingRate: "-0.1512%",
  monthlyFundingRate: "-0.6480%",
  yearlyFundingRate: "-7.8840%",
};

const RANGE_CONFIG: Record<FundingRange, { points: number; startLabel: string; stepHours: number; tickEvery: number }> = {
  "24H": { points: 24, startLabel: "00:00", stepHours: 1, tickEvery: 4 },
  "1W": { points: 84, startLabel: "4/8", stepHours: 2, tickEvery: 14 },
  "1M": { points: 90, startLabel: "1/15", stepHours: 24 * 4, tickEvery: 10 },
};

export function getFundingMockViewModel(range: FundingRange): FundingViewModel {
  return {
    summary: BASE_SUMMARY,
    history: buildFundingHistory(range),
  };
}

function buildFundingHistory(range: FundingRange): FundingHistoryPoint[] {
  const config = RANGE_CONFIG[range];
  const labels = buildLabels(config.points, config.startLabel, config.stepHours, config.tickEvery);

  return labels.map((label, index) => {
    const rate = getFundingRate(range, index);

    return {
      label,
      rate,
      positiveRate: rate >= 0 ? rate : undefined,
      negativeRate: rate < 0 ? rate : undefined,
    };
  });
}

function getFundingRate(range: FundingRange, index: number) {
  const amplitude = range === "24H" ? 0.0008 : range === "1W" ? 0.0012 : 0.00155;
  const drift = range === "24H" ? 0.00015 : range === "1W" ? -0.00005 : -0.0001;
  const waveA = Math.sin(index / (range === "24H" ? 2.1 : range === "1W" ? 5.2 : 3.8));
  const waveB = Math.cos(index / (range === "24H" ? 4.3 : range === "1W" ? 8.5 : 6.6));
  const spike = ((index * 17) % 11) / 10000 - 0.0005;
  const raw = waveA * amplitude + waveB * amplitude * 0.56 + spike * 0.45 + drift;
  const clamped = Math.max(-0.0028, Math.min(0.0012, raw));

  return Number(clamped.toFixed(6));
}

function buildLabels(count: number, startLabel: string, stepHours: number, tickEvery: number) {
  const labels: string[] = [];
  const start = parseLabelToDate(startLabel);

  for (let i = 0; i < count; i += 1) {
    if (i % tickEvery !== 0 && i !== count - 1) {
      labels.push("");
      continue;
    }

    const date = new Date(start.getTime() + i * stepHours * 60 * 60 * 1000);
    labels.push(stepHours >= 24 ? `${date.getMonth() + 1}/${date.getDate()}` : formatHour(date));
  }

  return labels;
}

function parseLabelToDate(input: string) {
  if (input.includes(":")) {
    const [hours, minutes] = input.split(":").map(Number);
    const date = new Date("2026-04-14T00:00:00");
    date.setHours(hours, minutes, 0, 0);
    return date;
  }

  const [month, day] = input.split("/").map(Number);
  return new Date(2026, month - 1, day, 0, 0, 0, 0);
}

function formatHour(date: Date) {
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}
