
"use client";

import * as React from "react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { setHours, setMinutes, getHours, getMinutes } from "date-fns";
import type { ControllerRenderProps } from "react-hook-form";
import { Clock, Calendar as CalendarIcon } from "lucide-react";

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

  const selectedDate = field?.value ? new Date(field.value) : undefined;

  const handleTimeChange = (type: "hour" | "minute" | "ampm", value: string) => {
    if (!selectedDate) return;

    let newDate = new Date(selectedDate);
    if (type === "hour") {
      const isPM = getHours(selectedDate) >= 12;
      let hour = parseInt(value);
      if (isPM && hour < 12) hour += 12;
      if (!isPM && hour === 12) hour = 0;
      newDate = setHours(newDate, hour);
    } else if (type === "minute") {
      newDate = setMinutes(newDate, parseInt(value));
    } else if (type === "ampm") {
      const currentHour = getHours(selectedDate);
      const isCurrentlyPM = currentHour >= 12;
      if (value === "PM" && !isCurrentlyPM) {
        newDate = setHours(newDate, currentHour + 12);
      } else if (value === "AM" && isCurrentlyPM) {
        newDate = setHours(newDate, currentHour - 12);
      }
    }
    field?.onChange(newDate);
  };

  const currentHour12 = selectedDate ? (getHours(selectedDate) % 12 || 12) : 12;
  const currentMinute = selectedDate ? getMinutes(selectedDate) : 0;
  const currentAMPM = selectedDate ? (getHours(selectedDate) >= 12 ? "PM" : "AM") : "AM";

  return (
    <div className={cn("relative w-full", className)}>
      <Popover open={open} onOpenChange={setOpen} modal={true}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant={"outline"}
            className={cn(
              "w-full justify-start text-left font-normal h-auto py-3 px-4",
              !field?.value && "text-muted-foreground"
            )}
            disabled={disabled}
          >
            <CalendarIcon className="mr-2 h-4 w-4 shrink-0" />
            <div className="flex flex-col items-start overflow-hidden">
              {field?.value ? (
                <>
                  <span className="text-sm font-semibold truncate w-full">
                    {format(new Date(field.value), "PPP")}
                  </span>
                  {showTimeSelect && (
                    <span className="text-xs text-blue-600 font-bold">
                      {format(new Date(field.value), "p")}
                    </span>
                  )}
                </>
              ) : (
                <span>{placeholder || "Pick a date"}</span>
              )}
            </div>
          </Button>
        </PopoverTrigger>
        <PopoverContent
          className="w-[calc(100vw-2rem)] sm:w-auto p-0 flex flex-col sm:flex-row shadow-2xl border-slate-200 overflow-hidden"
          align="center"
          sideOffset={8}
          collisionPadding={10}
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          <div className="p-1 flex justify-center">
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={(date) => {
                if (date) {
                  const combinedDate = selectedDate
                    ? setHours(setMinutes(date, currentMinute), getHours(selectedDate))
                    : date;
                  field?.onChange(combinedDate);
                  if (!showTimeSelect) setOpen(false);
                }
              }}
              disabled={disabled}
              fromDate={fromDate}
              toDate={toDate}
              captionLayout="dropdown-buttons"
              fromYear={fromYear}
              toYear={toYear}
              defaultMonth={selectedDate}
            />
          </div>
          {showTimeSelect && selectedDate && (
            <div className="border-t sm:border-t-0 sm:border-l border-slate-100 p-4 shrink-0 bg-slate-50/50 flex flex-col items-center sm:items-start gap-4">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-slate-400" />
                <span className="text-sm font-bold text-slate-700">Set Time</span>
              </div>
              <div className="flex gap-2 items-center justify-center sm:justify-start">
                <Select
                  value={currentHour12.toString()}
                  onValueChange={(val) => handleTimeChange("hour", val)}
                >
                  <SelectTrigger className="w-[70px] bg-white border-slate-200 font-bold">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="min-w-[70px]">
                    {Array.from({ length: 12 }, (_, i) => i + 1).map((h) => (
                      <SelectItem key={h} value={h.toString()}>
                        {h.toString().padStart(2, '0')}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <span className="font-bold text-slate-400">:</span>
                <Select
                  value={currentMinute.toString()}
                  onValueChange={(val) => handleTimeChange("minute", val)}
                >
                  <SelectTrigger className="w-[70px] bg-white border-slate-200 font-bold">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="min-w-[70px]">
                    {Array.from({ length: 60 }, (_, i) => i).map((m) => (
                      <SelectItem key={m} value={m.toString()}>
                        {m.toString().padStart(2, '0')}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select
                  value={currentAMPM}
                  onValueChange={(val) => handleTimeChange("ampm", val)}
                >
                  <SelectTrigger className="w-[70px] bg-white border-slate-200 font-bold">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="min-w-[70px]">
                    <SelectItem value="AM">AM</SelectItem>
                    <SelectItem value="PM">PM</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button
                variant="default"
                size="sm"
                className="w-full mt-2 font-bold bg-blue-600 hover:bg-blue-700"
                onClick={() => setOpen(false)}
              >
                Done
              </Button>
            </div>
          )}
        </PopoverContent>
      </Popover>
    </div>
  );
}
