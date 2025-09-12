'use client'

import { useState, type FC } from 'react'

import { ChevronDownIcon } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'

export type DateTimeValue = {
  date?: Date
  time: string
}

type Props = {
  value: DateTimeValue
  onChange: (value: DateTimeValue) => void
  readOnly?: boolean
}

const DatePickerAndTimePickerDemo: FC<Props> = ({ value, onChange, readOnly = false }) => {
  const [open, setOpen] = useState(false)

  if (readOnly) {
    return (
      <div className="flex gap-12 items-start">
        <div className="flex flex-col gap-1">
          <span className="text-sm text-muted-foreground px-1">Date</span>
          <span className="px-1">{value.date ? value.date.toLocaleDateString() : '-'}</span>
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-sm text-muted-foreground px-1">Time</span>
          <span className="px-1">{value.time || '-'}</span>
        </div>
      </div>
    )
  }

  return (
    <div className="flex gap-4">
      <div className="flex flex-col gap-3">
        <Label htmlFor="date-picker" className="px-1">
          Date picker
        </Label>
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" id="date-picker" className="justify-between font-normal">
              {value.date ? value.date.toLocaleDateString() : 'Pick a date'}
              <ChevronDownIcon />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto overflow-hidden p-0" align="start">
            <Calendar
              mode="single"
              selected={value.date}
              onSelect={(d) => {
                onChange({ ...value, date: d })
                setOpen(false)
              }}
            />
          </PopoverContent>
        </Popover>
      </div>
      <div className="flex flex-col gap-3">
        <Label htmlFor="time-picker" className="px-1">
          Time input
        </Label>
        <Input
          type="time"
          id="time-picker"
          step="1"
          value={value.time}
          onChange={(e) => onChange({ ...value, time: e.target.value })}
          className="bg-background appearance-none [&::-webkit-calendar-picker-indicator]:hidden [&::-webkit-calendar-picker-indicator]:appearance-none"
        />
      </div>
    </div>
  )
}

export default DatePickerAndTimePickerDemo


