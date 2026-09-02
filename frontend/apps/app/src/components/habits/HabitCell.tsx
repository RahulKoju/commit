import { useState, type FormEvent } from "react"
import { Button } from "@workspace/ui/components/button"
import { Checkbox } from "@workspace/ui/components/checkbox"
import { Input } from "@workspace/ui/components/input"
import { Label } from "@workspace/ui/components/label"
import { Popover, PopoverContent, PopoverTrigger } from "@workspace/ui/components/popover"
import { ChevronDown } from "lucide-react"

import type { Habit } from "@/types/habit.types"
import { computeCompletionStatus, isHabitMet } from "./habitMatrixUtils"

export function HabitCell({
  habit,
  dateKey,
  value,
  hasLog,
  disabled,
  onToggle,
  onLog,
}: {
  habit: Habit
  dateKey: string
  value: number
  hasLog: boolean
  disabled: boolean
  onToggle: () => void
  onLog: (value: number) => void
}) {
  const met = hasLog && isHabitMet(habit, value)

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

  if (
    habit.type === "numeric" &&
    (habit.comparison_operator === "gte" || habit.comparison_operator === "between")
  ) {
    const { status, percent } = computeCompletionStatus(habit, value)
    return (
      <div className="flex items-center justify-center gap-1">
        <ProgressRing
          habit={habit}
          dateKey={dateKey}
          value={value}
          status={status}
          percent={percent}
          onToggle={onToggle}
        />
        <NumericValuePopover habit={habit} dateKey={dateKey} value={value} onLog={onLog} />
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

type CompletionStatus = "none" | "partial" | "complete" | "over"

function ProgressRing({
  habit,
  dateKey,
  value,
  status,
  percent,
  onToggle,
}: {
  habit: Habit
  dateKey: string
  value: number
  status: CompletionStatus
  percent: number
  onToggle: () => void
}) {
  const radius = 6.5
  const circumference = 2 * Math.PI * radius
  const displayPercent = Math.min(100, Math.max(0, percent))
  const dashOffset =
    status === "none" ? circumference : circumference * (1 - displayPercent / 100)
  const label = completionLabel(habit, value, status)

  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={`${habit.name} on ${dateKey}: ${label}`}
      aria-pressed={status === "complete" || status === "over"}
      title={label}
      className="flex size-[24px] items-center justify-center rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
    >
      <svg viewBox="0 0 24 24" className="size-[24px]">
        <circle
          cx="12"
          cy="12"
          r={radius}
          fill="none"
          strokeWidth="2"
          stroke="currentColor"
          className="text-border"
        />
        <circle
          cx="12"
          cy="12"
          r={radius}
          fill="none"
          strokeWidth="2"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          transform="rotate(-90 12 12)"
          stroke="currentColor"
          className={
            status === "over" || status === "complete"
              ? "text-primary"
              : status === "partial"
                ? "text-yellow-400"
                : "text-border"
          }
        />
        {status === "over" ? (
          <circle
            cx="12"
            cy="12"
            r={radius + 3.5}
            fill="none"
            strokeWidth="2"
            stroke="currentColor"
            className="text-destructive"
          />
        ) : null}
      </svg>
    </button>
  )
}

function completionLabel(habit: Habit, value: number, status: CompletionStatus): string {
  const unit = habit.target_unit ? ` ${habit.target_unit}` : ""
  const valueText = formatCellNumber(value)
  const target =
    habit.comparison_operator === "between" &&
    habit.target_value_max !== null &&
    habit.target_value_max !== undefined
      ? `${formatCellNumber(habit.target_value ?? 0)}–${formatCellNumber(habit.target_value_max)}`
      : habit.target_value !== null && habit.target_value !== undefined
        ? formatCellNumber(habit.target_value)
        : "—"
  const base = `${valueText} / ${target}${unit}`
  return status === "over" ? `${base} — exceeded` : base
}

function formatCellNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1)
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