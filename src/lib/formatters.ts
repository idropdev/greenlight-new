function formatSingleTime(rawValue: string): string {
  if (!rawValue || typeof rawValue !== 'string') {
    return '';
  }
  const trimmed = rawValue.trim();
  if (trimmed === '') {
    return '';
  }

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
  return rawValue;
}

export function formatFieldValue(
  key: string,
  rawValue: string,
  fields?: Record<string, string>
): string {
  if ((!rawValue || typeof rawValue !== 'string') && key !== 'startTime' && key !== 'endTime') {
    return '';
  }

  const trimmed = (rawValue || '').trim();
  if (trimmed === '' && key !== 'startTime' && key !== 'endTime') {
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
    return rawValue; // Guard against invalid date values
  }

  if (key === 'time') {
    return formatSingleTime(rawValue);
  }

  if (key === 'startTime' || key === 'endTime') {
    const startVal = fields ? (fields.startTime || '') : (key === 'startTime' ? rawValue : '');
    const endVal = fields ? (fields.endTime || '') : (key === 'endTime' ? rawValue : '');
    
    const formattedStart = formatSingleTime(startVal);
    const formattedEnd = formatSingleTime(endVal);
    
    if (formattedStart && formattedEnd) {
      return `${formattedStart} - ${formattedEnd}`;
    }
    if (formattedStart) {
      return formattedStart;
    }
    if (formattedEnd) {
      return formattedEnd;
    }
    return '';
  }

  return rawValue;
}
