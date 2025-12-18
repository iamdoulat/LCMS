
"use client";

import * as React from "react";
import { format } from "date-fns";
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

interface DatePickerInputProps {
  field?: ControllerRenderProps<any, any>;
  placeholder?: string;
  className?: string;
  fromDate?: Date;
  toDate?: Date;
  disabled?: boolean;
  fromYear?: number;
  toYear?: number;
  showTimeSelect?: boolean;
}

export function DatePickerInput({
  field,
  placeholder,
  className,
  fromDate,
  toDate,
  disabled = false,
  fromYear = 1990,
  toYear = 2040,
  showTimeSelect = false,
}: DatePickerInputProps) {
  const [open, setOpen] = React.useState(false);

  return (
    <div className={cn("relative w-full", className)}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant={"outline"}
            className={cn(
              "w-full justify-start text-left font-normal",
              !field?.value && "text-muted-foreground"
            )}
            disabled={disabled}
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            {field?.value ? (
              format(new Date(field.value), showTimeSelect ? "PPP p" : "PPP")
            ) : (
              <span>{placeholder || "Pick a date"}</span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={field?.value ? new Date(field.value) : undefined}
            onSelect={(date) => {
              field?.onChange(date);
              setOpen(false);
            }}
            disabled={disabled}
            fromDate={fromDate}
            toDate={toDate}
            captionLayout="dropdown-buttons"
            fromYear={fromYear}
            toYear={toYear}
            defaultMonth={field?.value ? new Date(field.value) : undefined}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}
