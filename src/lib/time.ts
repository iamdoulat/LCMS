import { format, parse, parseISO, isValid } from 'date-fns';

/**
 * Formats various time strings (ISO, HH:mm, hh:mm a) into a standard "hh:mm a" format.
 */
export function formatAttendanceTime(timeStr: string | undefined | null): string {
    if (!timeStr) return '-';
    
    // 0. Handle non-strings
    if (typeof timeStr !== 'string') return '-';

    // 1. Try parsing as ISO
    try {
        const isoDate = parseISO(timeStr);
        if (isValid(isoDate) && !isNaN(isoDate.getTime())) {
            // Check if it's actually an ISO date by checking if the year is plausible
            // Sometimes random numbers can be parsed as dates
            if (isoDate.getFullYear() > 2000) {
              return format(isoDate, 'hh:mm a');
            }
        }
    } catch (e) {}

    // 2. Try parsing as "hh:mm a" or "HH:mm"
    try {
        const formatStr = (timeStr.includes('AM') || timeStr.includes('PM')) ? 'hh:mm a' : 'HH:mm';
        const parsed = parse(timeStr, formatStr, new Date());
        if (isValid(parsed) && !isNaN(parsed.getTime())) {
            return format(parsed, 'hh:mm a');
        }
    } catch (e) {}

    // 3. Fallback to native Date for broader compatibility
    try {
        const date = new Date(timeStr);
        if (isValid(date) && !isNaN(date.getTime())) {
          // If it's a valid date, format it
          return format(date, 'hh:mm a');
        }
    } catch (e) {}

    return timeStr;
}
