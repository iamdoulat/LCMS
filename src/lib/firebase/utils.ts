/**
 * Determines attendance flag based on check-in time
 * @param inTime - Time in "hh:mm AM/PM" format
 * @returns 'P' if at or before 09:10 AM, 'D' if after 09:10 AM
 */
export const determineAttendanceFlag = (inTime: string | undefined): 'P' | 'D' => {
    if (!inTime) return 'P'; // Default to present if no time

    try {
        // Parse time in format "hh:mm AM/PM"
        const timeMatch = inTime.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
        if (!timeMatch) return 'P'; // Default if parsing fails

        let hours = parseInt(timeMatch[1], 10);
        const minutes = parseInt(timeMatch[2], 10);
        const period = timeMatch[3].toUpperCase();

        // Convert to 24-hour format
        if (period === 'PM' && hours !== 12) {
            hours += 12;
        } else if (period === 'AM' && hours === 12) {
            hours = 0;
        }

        // Check if time is after 09:10 AM
        // 09:10 AM = 9 hours * 60 + 10 minutes = 550 minutes
        const threshold = 9 * 60 + 10; // 550 minutes
        const timeInMinutes = hours * 60 + minutes;

        return timeInMinutes <= threshold ? 'P' : 'D';
    } catch {
        return 'P'; // Default on error
    }
};
