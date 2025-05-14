"use client";

import * as React from "react";
import { format } from "date-fns";
import { Calendar as CalendarIcon } from "lucide-react";
import type { ControllerRenderProps, FieldValues, Path } from "react-hook-form";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface DatePickerFieldProps<TFieldValues extends FieldValues> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  field: ControllerRenderProps<TFieldValues, Path<TFieldValues>> | any; // Allow 'any' for broader compatibility if needed
  placeholder?: string;
  disabled?: (date: Date) => boolean;
}

export function DatePickerField<TFieldValues extends FieldValues>({
  field,
  placeholder = "Pick a date",
  disabled,
}: DatePickerFieldProps<TFieldValues>) {
  const [open, setOpen] = React.useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant={"outline"}
          className={cn(
            "w-full justify-start text-left font-normal h-10",
            !field.value && "text-muted-foreground"
          )}
          disabled={field.disabled}
        >
          <CalendarIcon className="mr-2 h-4 w-4" />
          {field.value ? format(new Date(field.value), "PPP") : <span>{placeholder}</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={field.value ? new Date(field.value) : undefined}
          onSelect={(date) => {
            field.onChange(date);
            setOpen(false); // Close popover on date selection
          }}
          disabled={disabled}
          initialFocus
        />
      </PopoverContent>
    </Popover>
  );
}
