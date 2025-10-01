
"use client"

import * as React from "react"
import { format, parse, isValid } from "date-fns"
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
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

interface DatePickerWithRangeProps extends React.HTMLAttributes<HTMLDivElement> {
    date: DateRange | undefined;
    onDateChange: (range: DateRange | undefined) => void;
}

export function DatePickerWithRange({ className, date, onDateChange }: DatePickerWithRangeProps) {
  const [open, setOpen] = React.useState(false);
  const [fromString, setFromString] = React.useState<string>(date?.from ? format(date.from, "MM/dd/yyyy") : "");
  const [toString, setToString] = React.useState<string>(date?.to ? format(date.to, "MM/dd/yyyy") : "");

  React.useEffect(() => {
    setFromString(date?.from ? format(date.from, "MM/dd/yyyy") : "");
    setToString(date?.to ? format(date.to, "MM/dd/yyyy") : "");
  }, [date]);

  const handleDateSelect = (range: DateRange | undefined) => {
    onDateChange(range);
    setFromString(range?.from ? format(range.from, "MM/dd/yyyy") : "");
    setToString(range?.to ? format(range.to, "MM/dd/yyyy") : "");
    setOpen(false);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>, field: 'from' | 'to') => {
    const value = e.target.value;
    if (field === 'from') {
      setFromString(value);
    } else {
      setToString(value);
    }
    
    const fromDate = parse(field === 'from' ? value : fromString, "MM/dd/yyyy", new Date());
    const toDate = parse(field === 'to' ? value : toString, "MM/dd/yyyy", new Date());
    
    const newRange: DateRange = {
      from: isValid(fromDate) ? fromDate : undefined,
      to: isValid(toDate) ? toDate : undefined,
    };
    
    // Only update if at least one date is valid
    if(newRange.from || newRange.to) {
        onDateChange(newRange);
    }
  };

  return (
    <div className={cn("grid gap-2", className)}>
      <Popover open={open} onOpenChange={setOpen}>
        <div className="flex items-center gap-2">
            <div className="flex-1 space-y-1">
                <Label htmlFor="date-from" className="sr-only">From</Label>
                <Input
                    id="date-from"
                    value={fromString}
                    onChange={(e) => handleInputChange(e, 'from')}
                    placeholder="From Date"
                    className="h-10"
                />
            </div>
             <div className="flex-1 space-y-1">
                <Label htmlFor="date-to" className="sr-only">To</Label>
                <Input
                    id="date-to"
                    value={toString}
                    onChange={(e) => handleInputChange(e, 'to')}
                    placeholder="To Date"
                    className="h-10"
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
