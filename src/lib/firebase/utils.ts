/**
 * Determines attendance flag based on check-in time
 * @param inTime - Time in "hh:mm AM/PM" format
 * @returns 'P' if at or before 09:10 AM, 'D' if after 09:10 AM
 */
export const determineAttendanceFlag = (inTime: string | undefined): 'P' | 'D' => {
    if (!inTime) return 'P';

    try {
        let hours = 0;
        let minutes = 0;

        // Try 12-hour format: "09:15 AM" or "9:15 AM"
        const time12Match = inTime.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
        if (time12Match) {
            hours = parseInt(time12Match[1], 10);
            minutes = parseInt(time12Match[2], 10);
            const period = time12Match[3].toUpperCase();

            if (period === 'PM' && hours !== 12) {
                hours += 12;
            } else if (period === 'AM' && hours === 12) {
                hours = 0;
            }
        } else {
            // Try 24-hour format: "09:15" or "14:30"
            const time24Match = inTime.match(/^(\d{1,2}):(\d{2})$/);
            if (time24Match) {
                hours = parseInt(time24Match[1], 10);
                minutes = parseInt(time24Match[2], 10);
            } else {
                // Try ISO String parsing
                const date = new Date(inTime);
                if (!isNaN(date.getTime())) {
                    hours = date.getHours();
                    minutes = date.getMinutes();
                } else {
                    return 'P'; // Default if all parsing fails
                }
            }
        }

        const threshold = 9 * 60 + 10; // 09:10 AM
        const timeInMinutes = hours * 60 + minutes;

        return timeInMinutes <= threshold ? 'P' : 'D';
    } catch {
        return 'P';
    }
};
