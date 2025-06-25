
"use client";

import * as React from "react";
import { format, isValid } from "date-fns";
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

interface DatePickerFieldProps<TFieldValues extends FieldValues> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  field: ControllerRenderProps<TFieldValues, Path<TFieldValues>> | any;
  placeholder?: string;
  disabled?: ((date: Date) => boolean) | boolean;
  dateFormat?: string;
}

export function DatePickerField<TFieldValues extends FieldValues>({
  field,
  placeholder = "Pick a date",
  disabled,
  dateFormat = "PPP",
}: DatePickerFieldProps<TFieldValues>) {
  const [open, setOpen] = React.useState(false);

  const handleSelect = (selectedDate: Date | undefined) => {
    field.onChange(selectedDate);
    setOpen(false);
  };

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
          {field.value && isValid(new Date(field.value)) ? (
            format(new Date(field.value), dateFormat)
          ) : (
            <span>{placeholder}</span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          captionLayout="dropdown-buttons"
          fromYear={1960}
          toYear={new Date().getFullYear() + 10}
          selected={
            field.value && isValid(new Date(field.value))
              ? new Date(field.value)
              : undefined
          }
          onSelect={handleSelect}
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
