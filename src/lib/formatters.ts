/**
 * Formats standard input values (like ISO YYYY-MM-DD for date, HH:MM for time)
 * into a clean, human-readable format for the Konva canvas.
 */
export function formatFieldValue(key: string, rawValue: string): string {
  if (!rawValue || typeof rawValue !== 'string') {
    return '';
  }

  const trimmed = rawValue.trim();
  if (trimmed === '') {
    return '';
  }

  if (key === 'date') {
    // YYYY-MM-DD format
    const parts = trimmed.split('-');
    if (parts.length === 3) {
      const year = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1; // 0-indexed month
      const day = parseInt(parts[2], 10);
      
      if (!isNaN(year) && !isNaN(month) && !isNaN(day)) {
        const date = new Date(year, month, day);
        if (!isNaN(date.getTime())) {
          return new Intl.DateTimeFormat('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          }).format(date);
        }
      }
    }
    return ''; // Guard against invalid date values
  }

  if (key === 'time') {
    // HH:MM format (24-hour)
    const parts = trimmed.split(':');
    if (parts.length >= 2) {
      const hours = parseInt(parts[0], 10);
      const minutes = parseInt(parts[1], 10);
      
      if (!isNaN(hours) && !isNaN(minutes)) {
        const date = new Date();
        date.setHours(hours, minutes, 0, 0);
        if (!isNaN(date.getTime())) {
          return new Intl.DateTimeFormat('en-US', {
            hour: 'numeric',
            minute: '2-digit',
            hour12: true,
          }).format(date);
        }
      }
    }
    return ''; // Guard against invalid time values
  }

  return rawValue;
}
