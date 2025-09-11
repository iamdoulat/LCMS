"use client";

import * as React from "react";
import { format, isValid as isValidDate } from "date-fns";
import { Calendar as CalendarIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import {
Popover,
PopoverContent,
PopoverTrigger,
} from "@/components/ui/popover";

interface DatePickerInputProps {
date: Date | undefined;
setDate: (date: Date | undefined) => void;
placeholder?: string;
className?: string;
fromDate?: Date;
toDate?: Date;
}

function formatDate(date: Date | undefined) {
if (!date || !isValidDate(date)) {
return "";
}
return format(date, "PPP");
}

export function DatePickerInput({ date, setDate, placeholder, className, fromDate, toDate }: DatePickerInputProps) {
const [open, setOpen] = React.useState(false);
const [value, setValue] = React.useState(formatDate(date));

React.useEffect(() => {
setValue(formatDate(date));
}, [date]);

return (
<Popover open={open} onOpenChange={setOpen}>
<PopoverTrigger asChild>
<Button
variant={"outline"}
className={cn(
"w-full justify-start text-left font-normal",
!date && "text-muted-foreground",
className
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
onSelect={(selectedDate) => {
setDate(selectedDate);
setOpen(false);
}}
initialFocus
fromDate={fromDate}
toDate={toDate}
disabled={(date) =>
date > new Date() || date < new Date("1900-01-01")
}
/>
</PopoverContent>
</Popover>
);
}