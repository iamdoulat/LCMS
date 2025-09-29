
"use client";

import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { CalendarIcon } from "lucide-react";
import * as React from "react";
import { format, isValid } from "date-fns";
import { ControllerRenderProps } from "react-hook-form";

interface DatePickerFieldProps {
  field: ControllerRenderProps<any, any>;
  placeholder?: string;
  disabled?: boolean;
  fromDate?: Date;
  toDate?: Date;
}

export function DatePickerField({ field, placeholder, disabled, fromDate, toDate }: DatePickerFieldProps) {
  const [date, setDate] = React.useState<Date | undefined>(field.value ? (isValid(new Date(field.value)) ? new Date(field.value) : undefined) : undefined);
  const [month, setMonth] = React.useState<Date | undefined>(date);

  React.useEffect(() => {
    if (field.value && isValid(new Date(field.value))) {
        const newDate = new Date(field.value);
        setDate(newDate);
        setMonth(newDate);
    } else {
        setDate(undefined);
    }
  }, [field.value]);

  const handleDateChange = (newDate: Date | undefined) => {
    setDate(newDate);
    setMonth(newDate);
    field.onChange(newDate);
  };

  const handleClear = () => {
    handleDateChange(undefined);
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant={"outline"}
          className={cn(
            "w-full justify-start text-left font-normal h-10",
            !date && "text-muted-foreground"
          )}
          disabled={disabled}
        >
          <CalendarIcon className="mr-2 h-4 w-4" />
          {date ? format(date, "MM/dd/yyyy") : <span>{placeholder || "Pick a date"}</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          captionLayout="dropdown-buttons"
          selected={date}
          onSelect={handleDateChange}
          month={month}
          onMonthChange={setMonth}
          disabled={(date) =>
            date > new Date("2100-01-01") || date < new Date("1900-01-01")
          }
          fromYear={1990}
          toYear={2040}
          initialFocus
          fromDate={fromDate}
          toDate={toDate}
        />
        <div className="p-2 border-t border-border">
            <Button variant="outline" size="sm" className="w-full" onClick={handleClear}>Clear</Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
