
"use client"

import * as React from "react"
import { format } from "date-fns"
import { Calendar as CalendarIcon } from "lucide-react"
import type { DateRange } from "react-day-picker"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Input } from "@/components/ui/input"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

interface DatePickerWithRangeProps extends React.HTMLAttributes<HTMLDivElement> {
    onDateChange: (range: DateRange | undefined) => void;
}

function formatDateRange(date: DateRange | undefined) {
  if (!date?.from) {
    return ""
  }
  if (!date.to) {
    return format(date.from, "LLL dd, y")
  }
  return `${format(date.from, "LLL dd, y")} - ${format(date.to, "LLL dd, y")}`
}

export function DatePickerWithRange({ className, onDateChange }: DatePickerWithRangeProps) {
  const [open, setOpen] = React.useState(false)
  const [date, setDate] = React.useState<DateRange | undefined>(undefined)

  // Call the onDateChange prop whenever the date state changes.
  React.useEffect(() => {
    onDateChange(date);
  }, [date, onDateChange]);

  const displayValue = formatDateRange(date);

  return (
    <div className={cn("relative flex gap-2", className)}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            id="date"
            variant={"outline"}
            className={cn(
              "w-full justify-start text-left font-normal",
              !date && "text-muted-foreground"
            )}
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            {displayValue ? displayValue : <span>Pick a date range</span>}
          </Button>
        </PopoverTrigger>
        <PopoverContent
          className="w-auto overflow-hidden p-0"
          align="start"
          alignOffset={-8}
          sideOffset={10}
        >
          <Calendar
            initialFocus
            mode="range"
            defaultMonth={date?.from}
            selected={date}
            onSelect={(newDate) => {
              setDate(newDate)
              if (newDate?.from && newDate?.to) {
                setOpen(false)
              }
            }}
            numberOfMonths={2}
          />
        </PopoverContent>
      </Popover>
    </div>
  )
}
