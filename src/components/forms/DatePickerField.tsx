
"use client";

import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { CalendarIcon, X } from "lucide-react";
import * as React from "react";
import { format, isValid, parse } from "date-fns";
import { ControllerRenderProps } from "react-hook-form";
import { Input } from "../ui/input";
import { Label } from "../ui/label";

interface DatePickerFieldProps {
  field: ControllerRenderProps<any, any>;
  placeholder?: string;
  disabled?: boolean;
  fromDate?: Date;
  toDate?: Date;
}

export function DatePickerField({ field, placeholder, disabled, fromDate, toDate }: DatePickerFieldProps) {
  const [open, setOpen] = React.useState(false);
  const [inputValue, setInputValue] = React.useState(field.value ? format(new Date(field.value), "MM/dd/yyyy") : "");
  
  React.useEffect(() => {
    if (field.value && isValid(new Date(field.value))) {
      setInputValue(format(new Date(field.value), "MM/dd/yyyy"));
    } else {
      setInputValue("");
    }
  }, [field.value]);

  const handleDateSelect = (selectedDate: Date | undefined) => {
    field.onChange(selectedDate);
    setInputValue(selectedDate ? format(selectedDate, "MM/dd/yyyy") : "");
    setOpen(false);
  };
  
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value);
    const parsedDate = parse(e.target.value, "MM/dd/yyyy", new Date());
    if (isValid(parsedDate)) {
      field.onChange(parsedDate);
    }
  };

  const handleClear = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();
    field.onChange(undefined);
    setInputValue("");
  };

  return (
     <div className="relative w-full">
        <Popover open={open} onOpenChange={setOpen}>
            <div className="relative">
                <Input
                    value={inputValue}
                    onChange={handleInputChange}
                    placeholder={placeholder || "Pick a date"}
                    className="pr-16"
                    disabled={disabled}
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
                            <X className="h-4 w-4 text-muted-foreground" />
                        </Button>
                    )}
                    <PopoverTrigger asChild>
                    <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        aria-label="Open calendar"
                        disabled={disabled}
                    >
                        <CalendarIcon className="h-4 w-4 text-muted-foreground" />
                    </Button>
                    </PopoverTrigger>
                </div>
            </div>
            <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                    mode="single"
                    captionLayout="dropdown-buttons"
                    selected={field?.value}
                    onSelect={handleDateSelect}
                    month={field?.value ? new Date(field.value) : undefined}
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
