
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { CalendarIcon } from "lucide-react";
import * as React from "react";
import { format } from "date-fns";
import { ControllerRenderProps } from "react-hook-form";

interface DatePickerFieldProps {
  field: ControllerRenderProps<any, any>;
  placeholder?: string;
}

export function DatePickerField({ field, placeholder }: DatePickerFieldProps) {
  const [date, setDate] = React.useState<Date | undefined>(field.value);

  React.useEffect(() => {
    setDate(field.value);
  }, [field.value]);

  const handleDateChange = (newDate: Date | undefined) => {
    setDate(newDate);
    field.onChange(newDate);
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant={"outline"}
          className={cn(
            "w-[240px] justify-start text-left font-normal",
            !date && "text-muted-foreground"
          )}
        >
          <CalendarIcon className="mr-2 h-4 w-4" />
          {date ? format(date, "PPP") : <span>{placeholder || "Pick a date"}</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={date}
          onSelect={handleDateChange}
          disabled={(date) =>
            date > new Date() || date < new Date("1900-01-01")
          }
          initialFocus
        />
      </PopoverContent>
    </Popover>
  );
}
