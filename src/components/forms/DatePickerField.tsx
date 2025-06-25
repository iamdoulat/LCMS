
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
import { Input } from "@/components/ui/input";

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
  const [inputValue, setInputValue] = React.useState<string>("");

  React.useEffect(() => {
    if (field.value && isValid(new Date(field.value))) {
      setInputValue(format(new Date(field.value), dateFormat));
    } else {
      setInputValue("");
    }
  }, [field.value, dateFormat]);

  const handleSelect = (selectedDate: Date | undefined) => {
    field.onChange(selectedDate);
    if (selectedDate && isValid(selectedDate)) {
      setInputValue(format(selectedDate, dateFormat));
    }
    setOpen(false);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value);
  };

  const handleInputBlur = () => {
    const parsedDate = new Date(inputValue);
    
    if (isValid(parsedDate)) {
      field.onChange(parsedDate);
    } else if (inputValue === "") {
      field.onChange(undefined);
    } else {
      if (field.value && isValid(new Date(field.value))) {
        setInputValue(format(new Date(field.value), dateFormat));
      } else {
        setInputValue("");
      }
    }
  };

  return (
    <div className="relative flex items-center">
      <Input
        type="text"
        placeholder={placeholder}
        value={inputValue}
        onChange={handleInputChange}
        onBlur={handleInputBlur}
        disabled={field.disabled as boolean | undefined}
        className="w-full pr-10"
      />
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            className={cn(
              "absolute right-1 h-8 w-8 p-0",
              field.disabled && "cursor-not-allowed opacity-50"
            )}
            disabled={field.disabled as boolean | undefined}
            aria-label="Open calendar"
          >
            <CalendarIcon className="h-4 w-4" />
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
    </div>
  );
}
