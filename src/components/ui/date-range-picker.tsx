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
    return format(date.from, "MMMM dd, yyyy")
  }
  return `${format(date.from, "MMMM dd, yyyy")} - ${format(date.to, "MMMM dd, yyyy")}`
}

export function DatePickerWithRange({ className, onDateChange }: DatePickerWithRangeProps) {
  const [open, setOpen] = React.useState(false)
  const [date, setDate] = React.useState<DateRange | undefined>(undefined)
  const [value, setValue] = React.useState(formatDateRange(date))

  React.useEffect(() => {
    onDateChange(date);
    setValue(formatDateRange(date));
  }, [date, onDateChange]);

  return (
    <div className={cn("relative flex gap-2", className)}>
      <Input
        value={value}
        placeholder="Select date range"
        className="bg-background pr-10"
        onChange={(e) => {
          setValue(e.target.value)
          // You could add date parsing logic here if needed
        }}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") {
            e.preventDefault()
            setOpen(true)
          }
        }}
        readOnly
      />
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            className="absolute top-1/2 right-2 size-6 -translate-y-1/2"
          >
            <CalendarIcon className="size-3.5" />
            <span className="sr-only">Select date range</span>
          </Button>
        </PopoverTrigger>
        <PopoverContent
          className="w-auto overflow-hidden p-0"
          align="end"
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
              // Close popover when both dates are selected
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