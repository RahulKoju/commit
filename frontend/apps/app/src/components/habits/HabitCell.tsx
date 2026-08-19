import { useState, type FormEvent } from "react"
import { Button } from "@workspace/ui/components/button"
import { Checkbox } from "@workspace/ui/components/checkbox"
import { Input } from "@workspace/ui/components/input"
import { Label } from "@workspace/ui/components/label"
import { Popover, PopoverContent, PopoverTrigger } from "@workspace/ui/components/popover"
import { ChevronDown } from "lucide-react"

import type { Habit } from "@/types/habit.types"
import { isHabitMet } from "./habitMatrixUtils"

export function HabitCell({
  habit,
  dateKey,
  value,
  disabled,
  onToggle,
  onLog,
}: {
  habit: Habit
  dateKey: string
  value: number
  disabled: boolean
  onToggle: () => void
  onLog: (value: number) => void
}) {
  const met = isHabitMet(habit, value)

  if (disabled) {
    return (
      <div className="flex items-center justify-center opacity-40" aria-disabled="true">
        <Checkbox checked={false} disabled className="size-4" aria-label={`${habit.name} on ${dateKey} (not scheduled)`} />
      </div>
    )
  }

  if (habit.type === "boolean") {
    return (
      <div className="flex items-center justify-center">
        <Checkbox checked={met} onCheckedChange={onToggle} aria-label={`${habit.name} on ${dateKey}`} />
      </div>
    )
  }

  return (
    <div className="flex items-center justify-center gap-1">
      <Checkbox checked={met} onCheckedChange={onToggle} aria-label={`${habit.name} on ${dateKey}`} />
      <NumericValuePopover habit={habit} dateKey={dateKey} value={value} onLog={onLog} />
    </div>
  )
}

function NumericValuePopover({
  habit,
  dateKey,
  value,
  onLog,
}: {
  habit: Habit
  dateKey: string
  value: number
  onLog: (value: number) => void
}) {
  const [open, setOpen] = useState(false)
  const [inputValue, setInputValue] = useState("")

  function handleOpenChange(next: boolean) {
    setOpen(next)
    if (next) setInputValue(value > 0 ? String(value) : "")
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const parsed = Number(inputValue)
    if (Number.isFinite(parsed) && parsed >= 0) {
      onLog(parsed)
    }
    setOpen(false)
  }

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button type="button" variant="ghost" size="icon-sm" aria-label={`Edit ${habit.name} value on ${dateKey}`}>
          <ChevronDown />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-60">
        <Label htmlFor={`numeric-${habit.id}-${dateKey}`}>
          {habit.name}
          {habit.target_unit ? ` (${habit.target_unit})` : ""}
        </Label>
        <form className="flex gap-2" onSubmit={handleSubmit}>
          <Input
            id={`numeric-${habit.id}-${dateKey}`}
            type="number"
            min={0}
            step="0.1"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder={habit.target_value !== null && habit.target_value !== undefined ? `Target ${habit.target_value}` : "Value"}
          />
          <Button type="submit" size="sm">Save</Button>
        </form>
      </PopoverContent>
    </Popover>
  )
}