
"use client";

import * as React from "react";
import { format, isValid, parse } from "date-fns"; // Added parse
import { Calendar as CalendarIcon, X as XIcon } from "lucide-react";
import type { ControllerRenderProps, FieldValues, Path } from "react-hook-form";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";

interface DatePickerFieldProps<TFieldValues extends FieldValues> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  field: ControllerRenderProps<TFieldValues, Path<TFieldValues>> | any;
  placeholder?: string;
  disabled?: ((date: Date) => boolean) | boolean;
  dateFormat?: string; // Optional prop for display and parsing format
}

export function DatePickerField<TFieldValues extends FieldValues>({
  field,
  placeholder = "Select date",
  disabled,
  dateFormat = "PPP", // Default display format (e.g., "May 23, 2025")
}: DatePickerFieldProps<TFieldValues>) {
  const [open, setOpen] = React.useState(false);
  // inputValue is what's shown in the text box, field.value is the actual Date object
  const [inputValue, setInputValue] = React.useState<string>("");

  React.useEffect(() => {
    // This effect updates the inputValue when field.value (from RHF) changes
    // This handles external changes like form.reset() or direct setValue() calls
    if (field.value && isValid(new Date(field.value))) {
      try {
        const formatted = format(new Date(field.value), dateFormat);
        // Only update if inputValue is stale or doesn't match formatted valid date
        const currentInputAsDate = parse(inputValue, dateFormat, new Date());
        if (!isValid(currentInputAsDate) || format(currentInputAsDate, dateFormat) !== formatted) {
             setInputValue(formatted);
        }
      } catch (e) {
        // If formatting fails (e.g. complex dateFormat and odd date object), clear
        setInputValue("");
      }
    } else if (!field.value && inputValue) {
      // If RHF field value is cleared, clear input too
      setInputValue("");
    }
  // We only want this to run if field.value changes externally, not when inputValue itself changes it.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [field.value, dateFormat]);


  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const typedValue = e.target.value;
    setInputValue(typedValue); // Update local state to show what user types immediately

    let parsedDate: Date | undefined = undefined;
    if (typedValue) {
      // Try parsing with the display format first
      parsedDate = parse(typedValue, dateFormat, new Date());
      if (!isValid(parsedDate)) {
        // Fallback to more lenient parsing
        parsedDate = new Date(typedValue);
        if (!isValid(parsedDate)) {
          parsedDate = undefined;
        }
      }
    }

    // Update RHF field value only if parsing results in a different valid date or clearing
    if (parsedDate && isValid(parsedDate)) {
      if (!field.value || new Date(field.value).getTime() !== parsedDate.getTime()) {
        field.onChange(parsedDate);
      }
    } else if (!typedValue && field.value !== undefined) { // User cleared input
      field.onChange(undefined);
    } else if (typedValue && field.value !== undefined) { // User typed something invalid, but there was a valid date
      field.onChange(undefined); // Clear the valid RHF date; input shows invalid text for Zod
    }
  };

  const handleCalendarSelect = (selectedDate: Date | undefined) => {
    field.onChange(selectedDate); // Update RHF
    setInputValue(selectedDate ? format(selectedDate, dateFormat) : ""); // Update displayed text
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <div className="relative w-full">
          <Input
            type="text"
            placeholder={placeholder}
            value={inputValue}
            onChange={handleInputChange}
            onFocus={() => setOpen(true)} // Open calendar on focus
            className={cn(
              "w-full justify-start text-left font-normal h-10 pr-8",
              !field.value && !inputValue && "text-muted-foreground"
            )}
            disabled={field.disabled}
          />
          <CalendarIcon
            className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground cursor-pointer"
            onClick={() => setOpen((prev) => !prev)}
          />
        </div>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          captionLayout="dropdown-buttons"
          fromYear={1960}
          toYear={new Date().getFullYear() + 10}
          selected={field.value && isValid(new Date(field.value)) ? new Date(field.value) : undefined}
          onSelect={handleCalendarSelect}
          disabled={disabled}
          initialFocus
        />
        {field.value && isValid(new Date(field.value)) && (
          <>
            <Separator />
            <div className="p-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  field.onChange(undefined);
                  setInputValue("");
                  setOpen(false);
                }}
                className="w-full text-destructive hover:text-destructive hover:bg-destructive/10"
              >
                <XIcon className="mr-2 h-4 w-4" />
                Clear Date
              </Button>
            </div>
          </>
        )}
      </PopoverContent>
    </Popover>
  );
}
