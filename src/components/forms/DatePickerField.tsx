"use client";

import * as React from "react";
import { format, parse } from "date-fns";
import { Calendar as CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import type { ControllerRenderProps } from "react-hook-form";
import { Input } from "@/components/ui/input";

interface DatePickerFieldProps {
  field: ControllerRenderProps<any, any>;
  placeholder?: string;
  disabled?: boolean;
  fromDate?: Date;
  toDate?: Date;
}

export function DatePickerField({
  field,
  placeholder = "MM/DD/YYYY", // Set default placeholder
  disabled,
  fromDate,
  toDate,
}: DatePickerFieldProps) {
  const [open, setOpen] = React.useState(false);
  const [inputValue, setInputValue] = React.useState<string>(
    field.value ? format(new Date(field.value), "MM/dd/yyyy") : ""
  );

  React.useEffect(() => {
    if (field.value) {
      const date = new Date(field.value);
      if (!isNaN(date.getTime())) {
        setInputValue(format(date, "MM/dd/yyyy"));
      }
    } else {
      setInputValue("");
    }
  }, [field.value]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setInputValue(value);

    // Basic regex check for MM/DD/YYYY format
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(value)) {
      const parsedDate = parse(value, "MM/dd/yyyy", new Date());
      if (!isNaN(parsedDate.getTime())) {
        field.onChange(parsedDate);
      }
    }
  };
  
  const handleCalendarSelect = (date: Date | undefined) => {
    field.onChange(date);
    if(date){
        setInputValue(format(date, "MM/dd/yyyy"));
    }
    setOpen(false);
  };

  return (
    <div className="relative w-full">
      <Input
        type="text"
        placeholder={placeholder}
        value={inputValue}
        onChange={handleInputChange}
        disabled={disabled}
        className="pr-10" // Add padding to make space for the calendar icon
      />
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8 text-muted-foreground hover:bg-transparent"
            disabled={disabled}
            aria-label="Open calendar"
          >
            <CalendarIcon className="h-4 w-4" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            captionLayout="dropdown"
            selected={field.value ? new Date(field.value) : undefined}
            onSelect={handleCalendarSelect}
            disabled={disabled}
            fromYear={1990}
            toYear={2040}
            initialFocus
            fromDate={fromDate}
            toDate={toDate}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}