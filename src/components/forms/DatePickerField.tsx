
"use client"

import * as React from "react"
import { format } from "date-fns"
import type { ControllerRenderProps, FieldValues, Path } from "react-hook-form"

import { cn } from "@/lib/utils"
import { Input } from "@/components/ui/input"

interface DatePickerFieldProps<TFieldValues extends FieldValues> {
  field: ControllerRenderProps<TFieldValues, Path<TFieldValues>> | any
  placeholder?: string
  disabled?: boolean
}

export function DatePickerField<TFieldValues extends FieldValues>({
  field,
  placeholder,
  disabled,
}: DatePickerFieldProps<TFieldValues>) {
  const { onChange, value, ...rest } = field;

  // The value from react-hook-form might be a Date object or an ISO string.
  // The native date input expects 'yyyy-MM-dd'.
  const formattedValue = React.useMemo(() => {
    if (!value) return "";
    try {
      // Handles both Date objects and ISO strings from Firestore
      return format(new Date(value), "yyyy-MM-dd");
    } catch (e) {
      // Return empty string if the date is invalid
      return "";
    }
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const dateString = e.target.value;
    if (dateString) {
      // The browser provides the date as 'yyyy-MM-dd'.
      // To avoid timezone issues where this might be interpreted as the previous day
      // in some timezones, we create the Date object as if it's UTC midnight.
      const date = new Date(dateString + 'T00:00:00Z');
      onChange(date);
    } else {
      // Handle clearing the date
      onChange(undefined);
    }
  };

  return (
    <Input
      type="date"
      placeholder={placeholder}
      value={formattedValue}
      onChange={handleChange}
      disabled={disabled}
      className={cn("w-full", !value && "text-muted-foreground")}
      {...rest}
    />
  )
}
