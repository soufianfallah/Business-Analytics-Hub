"use client";

import { format } from "date-fns";
import { CalendarIcon, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export type DatePickerProps = {
  value?: Date;
  onChange: (date?: Date) => void;
  placeholder?: string;
  disabled?: boolean;
  fromDate?: Date;
  toDate?: Date;
  className?: string;
};

export function DatePicker({
  value,
  onChange,
  placeholder = "Pick a date",
  disabled,
  fromDate,
  toDate,
  className,
}: DatePickerProps) {
  return (
    <div className={cn("flex items-center gap-1", className)}>
      <Popover>
        <PopoverTrigger asChild>
          <Button
            className={cn(
              "flex-1 justify-start text-left font-normal",
              !value && "text-muted-foreground",
            )}
            disabled={disabled}
            variant="outline"
          >
            <CalendarIcon className="size-4" aria-hidden="true" />
            {value ? format(value, "PPP") : placeholder}
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-auto p-0">
          <Calendar
            autoFocus
            disabled={(date) =>
              Boolean(
                (fromDate && date < fromDate) || (toDate && date > toDate),
              )
            }
            mode="single"
            onSelect={onChange}
            selected={value}
          />
        </PopoverContent>
      </Popover>
      {value ? (
        <Button
          disabled={disabled}
          onClick={() => onChange(undefined)}
          size="icon"
          type="button"
          variant="ghost"
        >
          <X className="size-4" />
          <span className="sr-only">Clear date</span>
        </Button>
      ) : null}
    </div>
  );
}
