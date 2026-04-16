import { isValid } from "date-fns";

/**
 * Generates an array of years starting from the company's operation start date
 * up to 5 years into the future from the current year.
 * @param operationStartDate The start date from company settings (Date, Timestamp, or string)
 * @param defaultStartYear The year to use if operationStartDate is null or invalid
 * @returns Array of year strings
 */
export function getDynamicYearRange(operationStartDate: any, defaultStartYear: number = 2015): string[] {
  let startYear = defaultStartYear;

  if (operationStartDate) {
    let date: Date;
    if (typeof operationStartDate.toDate === 'function') {
      date = operationStartDate.toDate();
    } else {
      date = new Date(operationStartDate);
    }
    
    if (isValid(date)) {
      startYear = date.getFullYear();
    }
  }

  const currentYear = new Date().getFullYear();
  const endYear = currentYear + 5;
  
  return Array.from(
    { length: endYear - startYear + 1 }, 
    (_, i) => (startYear + i).toString()
  );
}
