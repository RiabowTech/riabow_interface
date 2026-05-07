/**
 * Format subscription period from ISO dates to "YYYYMMDD HH:mm-YYYYMMDD HH:mm" format
 * Input: ISO date strings
 * Output: "20260101 00:00-20260107 23:59"
 */
export function formatSubscriptionPeriodCompact(startTime: string, endTime: string): string {
  const formatIsoToCompact = (isoString: string): string => {
    const date = new Date(isoString);
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, "0");
    const day = String(date.getUTCDate()).padStart(2, "0");
    const hours = String(date.getUTCHours()).padStart(2, "0");
    const minutes = String(date.getUTCMinutes()).padStart(2, "0");
    return `${year}${month}${day} ${hours}:${minutes}`;
  };

  return `${formatIsoToCompact(startTime)}-${formatIsoToCompact(endTime)}`;
}

/**
 * Format date range from ISO dates to "YYYYMMDD-YYYYMMDD" format (no time)
 * Input: ISO date strings
 * Output: "20260108-20260116"
 */
export function formatDateRangeCompact(startTime: string, endTime: string): string {
  const formatIsoToDate = (isoString: string): string => {
    const date = new Date(isoString);
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, "0");
    const day = String(date.getUTCDate()).padStart(2, "0");
    return `${year}${month}${day}`;
  };

  return `${formatIsoToDate(startTime)}-${formatIsoToDate(endTime)}`;
}

/**
 * Format subscription period to Western date format
 * Handle formats:
 * - "20260115 00:00-20260115 23:59" -> "Jan 15, 2026, 00:00 - 23:59" (same date)
 * - "20260101 00:00-20260107 23:59" -> "Jan 1 00:00 - Jan 7, 2026 23:59" (different dates with time)
 * - "20251210-20251218" -> "Dec 10 - Dec 18, 2025" (different dates without time)
 */
export function formatSubscriptionPeriod(period: string): string {
  // Handle format: "20260115 00:00-20260115 23:59" or "20251210-20251218"
  const parts = period.split('-');
  
  if (parts.length !== 2) return period;
  
  const parseDateTime = (str: string) => {
    // Check if includes time (has space)
    const hasTime = str.includes(' ');
    
    if (hasTime) {
      const [datePart, timePart] = str.split(' ');
      const year = datePart.substring(0, 4);
      const month = datePart.substring(4, 6);
      const day = datePart.substring(6, 8);
      const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
      const monthName = date.toLocaleDateString('en-US', { month: 'short' });
      return { date: `${monthName} ${parseInt(day)}, ${year}`, time: timePart };
    } else {
      const year = str.substring(0, 4);
      const month = str.substring(4, 6);
      const day = str.substring(6, 8);
      const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
      const monthName = date.toLocaleDateString('en-US', { month: 'short' });
      return { date: `${monthName} ${parseInt(day)}, ${year}`, time: null };
    }
  };
  
  const start = parseDateTime(parts[0].trim());
  const end = parseDateTime(parts[1].trim());
  
  // If same date, show: "Jan 15, 2026, 00:00 - 23:59"
  if (start.date === end.date && start.time && end.time) {
    return `${start.date}, ${start.time} - ${end.time}`;
  }
  
  // If different dates with time: "Jan 1 0:00 - Jan 7 2026 23:59"
  if (start.time && end.time && start.date !== end.date) {
    const startParts = start.date.split(', ');
    return `${startParts[0]} ${start.time} - ${end.date} ${end.time}`;
  }
  
  // If different dates without time: "Dec 10 - Dec 18, 2025"
  if (start.time === null && end.time === null) {
    // Extract just the month and day from start, full date from end
    const startParts = start.date.split(', ');
    return `${startParts[0]} - ${end.date}`;
  }
  
  return period;
}

/**
 * Format maturity date to Western date format
 * Handle format: "20260108 23:59" -> "Jan 8, 2026 23:59"
 */
export function formatMaturityDate(dateStr: string): string {
  if (!dateStr.includes(' ')) return dateStr;

  const [datePart, timePart] = dateStr.split(' ');

  if (datePart.length !== 8) return dateStr;

  const year = datePart.substring(0, 4);
  const month = datePart.substring(4, 6);
  const day = datePart.substring(6, 8);

  const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
  const monthName = date.toLocaleDateString('en-US', { month: 'short' });

  return `${monthName} ${parseInt(day)}, ${year} ${timePart}`;
}

/**
 * Format ISO date to "YYYYMMDD HH:mm" format
 * Input: "2026-01-08T13:32:33Z"
 * Output: "20260108 13:32"
 */
export function formatIsoToCompactDateTime(isoString: string): string {
  if (!isoString) return "N/A";

  const date = new Date(isoString);
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  const hours = String(date.getUTCHours()).padStart(2, "0");
  const minutes = String(date.getUTCMinutes()).padStart(2, "0");

  return `${year}${month}${day} ${hours}:${minutes}`;
}

/**
 * Format redemption time from period string (extract end time only)
 * Handle format: "20260101 00:00-20260107 23:59" -> "Jan 7, 2026 23:59"
 */
export function formatRedemptionTime(period: string): string {
  // Extract the end time from period format
  const parts = period.split('-');
  if (parts.length !== 2) return period;
  
  const endDateTime = parts[1].trim();
  return formatMaturityDate(endDateTime);
}

