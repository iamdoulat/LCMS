
"use client";

import * as React from "react";
import { format, isValid as isValidDate, parse } from "date-fns";
import { Calendar as CalendarIcon, X as ClearIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import type { ControllerRenderProps } from "react-hook-form";

interface DatePickerInputProps {
  field?: ControllerRenderProps<any, any>;
  placeholder?: string;
  className?: string;
  fromDate?: Date;
  toDate?: Date;
}

const formatDate = (date: Date | undefined): string => {
  if (!date || !isValidDate(date)) {
    return "";
  }
  return format(date, "PPP");
};

export function DatePickerInput({
  field,
  placeholder,
  className,
  fromDate,
  toDate,
}: DatePickerInputProps) {
  const [open, setOpen] = React.useState(false);
  const [inputValue, setInputValue] = React.useState(formatDate(field?.value));

  React.useEffect(() => {
    // Update the input field when the form value changes externally
    setInputValue(formatDate(field?.value));
  }, [field?.value]);

  const handleDateSelect = (selectedDate: Date | undefined) => {
    field?.onChange(selectedDate);
    setInputValue(formatDate(selectedDate));
    setOpen(false);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setInputValue(value);

    // Attempt to parse the date from input
    const parsedDate = parse(value, "PPP", new Date());
    if (isValidDate(parsedDate)) {
      field?.onChange(parsedDate);
    }
  };

  const handleClear = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();
    field?.onChange(undefined);
    setInputValue("");
  };

  return (
    <div className={cn("relative w-full", className)}>
      <Popover open={open} onOpenChange={setOpen}>
        <div className="relative">
          <Input
            value={inputValue}
            onChange={handleInputChange}
            placeholder={placeholder || "Pick a date"}
            className="pr-16" // Make space for buttons
          />
          <div className="absolute inset-y-0 right-0 flex items-center pr-1">
            {field?.value && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={handleClear}
                aria-label="Clear date"
              >
                <ClearIcon className="h-4 w-4 text-muted-foreground" />
              </Button>
            )}
            <PopoverTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                aria-label="Open calendar"
              >
                <CalendarIcon className="h-4 w-4 text-muted-foreground" />
              </Button>
            </PopoverTrigger>
          </div>
        </div>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={field?.value}
            onSelect={handleDateSelect}
            initialFocus
            fromDate={fromDate}
            toDate={toDate}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}
