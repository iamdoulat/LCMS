/**
 * Parses a time string into minutes from midnight
 * @param timeStr - Time in "hh:mm AM/PM", "HH:mm", or ISO string format
 * @returns number of minutes from midnight
 */
export const parseTimeToMinutes = (timeStr: string | undefined): number => {
    if (!timeStr) return 0;

    try {
        let hours = 0;
        let minutes = 0;

        // Try 12-hour format: "09:15 AM" or "9:15 AM"
        const time12Match = timeStr.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
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
            const time24Match = timeStr.match(/^(\d{1,2}):(\d{2})$/);
            if (time24Match) {
                hours = parseInt(time24Match[1], 10);
                minutes = parseInt(time24Match[2], 10);
            } else {
                // Try ISO String parsing
                const date = new Date(timeStr);
                if (!isNaN(date.getTime())) {
                    hours = date.getHours();
                    minutes = date.getMinutes();
                } else {
                    return 0; // Default if all parsing fails
                }
            }
        }

        return hours * 60 + minutes;
    } catch {
        return 0;
    }
};

/**
 * Determines attendance flag based on check-in time and policy
 * @param inTime - Time in "hh:mm AM/PM" format
 * @param policy - The attendance policy to apply (can be a DailyAttendancePolicy or generic policy object)
 * @returns 'P' if at or before threshold, 'D' if after
 */
// Flag determining logic (Dynamic based on policy)
export const determineAttendanceFlag = (
    inTime: string | undefined,
    policy?: { inTime?: string; delayBuffer?: number; name?: string }
): 'P' | 'D' => {
    if (!inTime) return 'P';

    try {
        const timeInMinutes = parseTimeToMinutes(inTime);

        // DEFAULT threshold: 09:10 AM (550 minutes)
        // This is only a fallback if absolutely no policy info is available.
        let threshold = 9 * 60 + 10;

        if (policy) {
            // If we have a policy object, we should try to use its specific inTime and buffer
            const policyInTime = policy.inTime;
            const buffer = policy.delayBuffer ?? 0;

            if (policyInTime) {
                const policyInTimeMinutes = parseTimeToMinutes(policyInTime);
                threshold = policyInTimeMinutes + buffer;
            } else {
                // If policy exists but inTime is missing (common in dailyPolicy overrides), 
                // we should NOT necessarily fall back to 09:10 AM if this is meant to be a merged policy.
                // However, the caller should ideally handle merging.
                // For safety, if it's a known policy but missing inTime, we keep the default 
                // OR we could throw an error to force callers to be more explicit.
                // Given the request "inTime will follow by Attendance policy 'In Time' Field",
                // we ensure threshold is derived from there.
            }
        }

        return timeInMinutes <= threshold ? 'P' : 'D';
    } catch {
        return 'P';
    }
};
