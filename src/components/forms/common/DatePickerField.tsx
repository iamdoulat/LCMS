import { format, setHours, setMinutes, getHours, getMinutes } from "date-fns";
import { Calendar as CalendarIcon, Clock } from "lucide-react";
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
import type { ControllerRenderProps } from "react-hook-form";
import * as React from "react";

interface DatePickerFieldProps {
  field?: ControllerRenderProps<any, any>;
  placeholder?: string;
  className?: string;
  fromDate?: Date;
  toDate?: Date;
  disabled?: boolean;
  showTimeSelect?: boolean;
}

export function DatePickerField({
  field,
  placeholder,
  className,
  fromDate,
  toDate,
  disabled = false,
  showTimeSelect = false,
}: DatePickerFieldProps) {
  const [open, setOpen] = React.useState(false);

  return (
    <div className={cn("relative w-full", className)}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant={"outline"}
            className={cn(
              "w-full justify-start text-left font-normal h-10",
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
        <PopoverContent className="w-auto p-0 flex flex-col sm:flex-row shadow-2xl" align="start">
          <Calendar
            mode="single"
            selected={field?.value ? new Date(field.value) : undefined}
            onSelect={(date) => {
              if (date) {
                if (showTimeSelect && field?.value) {
                  const currentVal = new Date(field.value);
                  const combinedDate = setHours(setMinutes(date, getMinutes(currentVal)), getHours(currentVal));
                  field?.onChange(combinedDate);
                } else {
                  field?.onChange(date);
                }
              } else {
                field?.onChange(null);
              }
              if (!showTimeSelect) setOpen(false);
            }}
            disabled={disabled}
            fromDate={fromDate}
            toDate={toDate}
            captionLayout="dropdown-buttons"
            fromYear={1940}
            toYear={2040}
            defaultMonth={field?.value ? new Date(field.value) : undefined}
          />
          {showTimeSelect && field?.value && (
            <TimePickerContent
              value={new Date(field.value)}
              onChange={(newDate) => field?.onChange(newDate)}
              onDone={() => setOpen(false)}
            />
          )}
          {!showTimeSelect && (
            <div className="p-2 border-t border-border w-full">
              <Button
                type="button"
                variant="ghost"
                className="w-full h-8 text-xs"
                onClick={() => {
                  field?.onChange(null);
                  setOpen(false);
                }}
              >
                Reset
              </Button>
            </div>
          )}
        </PopoverContent>
      </Popover>
    </div>
  );
}

function TimePickerContent({ value, onChange, onDone }: { value: Date, onChange: (date: Date) => void, onDone: () => void }) {
  const currentHour12 = getHours(value) % 12 || 12;
  const currentMinute = getMinutes(value);
  const currentAMPM = getHours(value) >= 12 ? "PM" : "AM";

  const handleTimeChange = (type: "hour" | "minute" | "ampm", val: string) => {
    let newDate = new Date(value);
    const currentHour24 = getHours(value);
    const hr12 = currentHour24 % 12 || 12;

    if (type === "hour") {
      let h12 = parseInt(val);
      const isPM = currentHour24 >= 12;
      let h24 = h12;
      if (isPM && h12 < 12) h24 = h12 + 12;
      if (!isPM && h12 === 12) h24 = 0;
      newDate = setHours(newDate, h24);
    } else if (type === "minute") {
      newDate = setMinutes(newDate, parseInt(val));
    } else if (type === "ampm") {
      let h24 = hr12;
      if (val === "PM" && hr12 < 12) h24 = hr12 + 12;
      if (val === "AM" && hr12 === 12) h24 = 0;
      if (val === "AM" && hr12 < 12) h24 = hr12;
      newDate = setHours(newDate, h24);
    }
    onChange(newDate);
  };

  return (
    <div className="border-t sm:border-t-0 sm:border-l border-border p-4 shrink-0 bg-slate-50/50 flex flex-col items-center sm:items-start gap-4 min-w-[210px]">
      <div className="flex items-center gap-2">
        <Clock className="h-4 w-4 text-slate-400" />
        <span className="text-sm font-bold text-slate-700">Set Time</span>
      </div>
      <div className="flex gap-2 items-center justify-center sm:justify-start">
        <Select
          value={currentHour12.toString()}
          onValueChange={(val) => handleTimeChange("hour", val)}
        >
          <SelectTrigger className="w-[60px] bg-white border-slate-200 font-bold">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="min-w-[60px]">
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
          <SelectTrigger className="w-[60px] bg-white border-slate-200 font-bold">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="min-w-[60px]">
            {Array.from({ length: 60 }, (_, i) => i).map((m) => (
              <SelectItem key={m} value={m.toString()}>
                {m.toString().padStart(2, '0')}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* AM/PM Toggle Group - More reliable than Select for 2 items */}
        <div className="flex border border-slate-200 rounded-md overflow-hidden bg-white">
          <Button
            type="button"
            variant={currentAMPM === "AM" ? "default" : "ghost"}
            size="sm"
            className={cn(
              "h-9 px-3 rounded-none text-xs font-bold",
              currentAMPM === "AM" ? "bg-slate-900 text-white" : "text-slate-500 hover:bg-slate-100"
            )}
            onClick={() => handleTimeChange("ampm", "AM")}
          >
            AM
          </Button>
          <Button
            type="button"
            variant={currentAMPM === "PM" ? "default" : "ghost"}
            size="sm"
            className={cn(
              "h-9 px-3 rounded-none text-xs font-bold border-l border-slate-200",
              currentAMPM === "PM" ? "bg-slate-900 text-white" : "text-slate-500 hover:bg-slate-100"
            )}
            onClick={() => handleTimeChange("ampm", "PM")}
          >
            PM
          </Button>
        </div>
      </div>
      <div className="flex gap-2 w-full mt-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="flex-1 text-xs"
          onClick={() => {
            onChange(null as any);
            onDone();
          }}
        >
          Reset
        </Button>
        <Button
          type="button"
          variant="default"
          size="sm"
          className="flex-1 font-bold bg-blue-600 hover:bg-blue-700 text-white"
          onClick={onDone}
        >
          Done
        </Button>
      </div>
    </div>
  );
}
