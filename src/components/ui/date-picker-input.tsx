
"use client";

import * as React from "react";
import { format, isValid as isValidDate } from "date-fns";
import { Calendar as CalendarIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Label } from "./label";

interface DatePickerInputProps {
  date: Date | undefined;
  setDate: (date: Date | undefined) => void;
  placeholder?: string;
  className?: string;
  fromDate?: Date;
  toDate?: Date;
}

function formatDate(date: Date | undefined) {
  if (!date || !isValidDate(date)) {
    return "";
  }
  return format(date, "PPP");
}

export function DatePickerInput({ date, setDate, placeholder, className, fromDate, toDate }: DatePickerInputProps) {
  const [open, setOpen] = React.useState(false);
  const [value, setValue] = React.useState(formatDate(date));

  React.useEffect(() => {
    setValue(formatDate(date));
  }, [date]);

  return (
    <div className={cn("relative flex items-center", className)}>
      <Input
        value={value}
        placeholder={placeholder || "Select a date"}
        className="pr-10"
        onChange={(e) => {
          const newDate = new Date(e.target.value);
          setValue(e.target.value);
          if (isValidDate(newDate)) {
            setDate(newDate);
          }
        }}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setOpen(true);
          }
        }}
      />
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            className="absolute top-1/2 right-2 size-6 -translate-y-1/2 p-0"
            aria-label="Select date"
          >
            <CalendarIcon className="size-4" />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          className="w-auto overflow-hidden p-0"
          align="start"
          sideOffset={10}
        >
          <Calendar
            mode="single"
            selected={date}
            onSelect={(selectedDate) => {
              setDate(selectedDate);
              setValue(formatDate(selectedDate));
              setOpen(false);
            }}
            initialFocus
            fromDate={fromDate}
            toDate={toDate}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}
