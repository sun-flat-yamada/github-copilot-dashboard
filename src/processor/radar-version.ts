/**
 * AI Model Radar Version Management Module
 * Format: yyyy-mm-dd-xxxx (e.g. 2026-09-13-0001)
 * Allows individual page versioning with incremental sequence for the same day.
 */

export const RADAR_VERSION_REGEX = /^\d{4}-\d{2}-\d{2}-\d{4}$/;

/**
 * Format a Date object as 'yyyy-mm-dd'.
 */
export function formatDateKey(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Validates if the version string adheres to 'yyyy-mm-dd-xxxx' format.
 */
export function isValidRadarVersion(version: string): boolean {
  return RADAR_VERSION_REGEX.test(version);
}

/**
 * Parses a radar version string into date and sequence number.
 */
export function parseRadarVersion(version: string): { date: string; sequence: number } | null {
  if (!isValidRadarVersion(version)) {
    return null;
  }
  const datePart = version.slice(0, 10);
  const seqPart = parseInt(version.slice(11), 10);
  return {
    date: datePart,
    sequence: isNaN(seqPart) ? 1 : seqPart,
  };
}

/**
 * Generates the next incremental radar version.
 * - If currentVersion has the same date, increment the sequence (0001 -> 0002).
 * - If currentVersion has a different date or is legacy, reset sequence to 0001.
 */
export function getNextRadarVersion(currentVersion?: string, date: Date = new Date()): string {
  const targetDateKey = formatDateKey(date);

  if (!currentVersion) {
    return `${targetDateKey}-0001`;
  }

  const parsed = parseRadarVersion(currentVersion);
  if (parsed && parsed.date === targetDateKey) {
    const nextSeq = String(parsed.sequence + 1).padStart(4, '0');
    return `${targetDateKey}-${nextSeq}`;
  }

  return `${targetDateKey}-0001`;
}
