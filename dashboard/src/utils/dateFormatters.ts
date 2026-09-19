/**
 * 日付・タイムスタンプから現在（または基準日時）までの経過時間を
 * 日数や時間（例: 3時間前, 5日前, 本日）でシンプルにフォーマットするユーティリティ
 */
export function formatElapsedActivity(
  dateStr?: string | null,
  referenceDate: Date = new Date()
): string {
  if (!dateStr || dateStr.trim() === '' || dateStr === '-') {
    return '';
  }

  const cleanStr = dateStr.trim();
  const hasTime = cleanStr.includes('T') || cleanStr.includes(':');
  const targetDate = hasTime
    ? new Date(cleanStr)
    : new Date(`${cleanStr}T00:00:00`);

  if (isNaN(targetDate.getTime())) {
    return '';
  }

  const diffMs = referenceDate.getTime() - targetDate.getTime();
  if (diffMs < 0) {
    return '本日';
  }

  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (hasTime) {
    if (diffMinutes < 1) {
      return 'たった今';
    }
    if (diffHours < 1) {
      return `${diffMinutes}分前`;
    }
    if (diffHours < 24) {
      return `${diffHours}時間前`;
    }
  } else {
    // 日付のみ（YYYY-MM-DD等）の場合
    if (diffDays === 0) {
      return '本日';
    }
  }

  return `${diffDays}日前`;
}
