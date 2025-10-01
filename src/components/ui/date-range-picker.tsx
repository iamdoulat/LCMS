
"use client"

import * as React from "react"
import { format } from "date-fns"
import { Calendar as CalendarIcon } from "lucide-react"
import type { DateRange } from "react-day-picker"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { DatePickerInput } from "./date-picker-input" // Changed to new component
import { Label } from "./label"

interface DatePickerWithRangeProps extends React.HTMLAttributes<HTMLDivElement> {
    date: DateRange | undefined;
    onDateChange: (range: DateRange | undefined) => void;
}

export function DatePickerWithRange({ className, date, onDateChange }: DatePickerWithRangeProps) {
  const [open, setOpen] = React.useState(false);

  const handleDateSelect = (range: DateRange | undefined) => {
    onDateChange(range);
    setOpen(false);
  };
  
  return (
    <div className={cn("grid gap-2", className)}>
      <Popover open={open} onOpenChange={setOpen}>
        <div className="flex items-center gap-2">
            <div className="flex-1 space-y-1">
                <Label htmlFor="date-from" className="sr-only">From</Label>
                <DatePickerInput
                    field={{ value: date?.from, onChange: (d) => onDateChange({ ...date, from: d }) }}
                    placeholder="From Date"
                />
            </div>
             <div className="flex-1 space-y-1">
                <Label htmlFor="date-to" className="sr-only">To</Label>
                <DatePickerInput
                    field={{ value: date?.to, onChange: (d) => onDateChange({ ...date, to: d }) }}
                    placeholder="To Date"
                />
            </div>
            <PopoverTrigger asChild>
                <Button variant="outline" size="icon" className="h-10 w-10">
                    <CalendarIcon className="h-4 w-4" />
                </Button>
            </PopoverTrigger>
        </div>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            initialFocus
            mode="range"
            defaultMonth={date?.from}
            selected={date}
            onSelect={handleDateSelect}
            numberOfMonths={2}
          />
        </PopoverContent>
      </Popover>
    </div>
  )
}
