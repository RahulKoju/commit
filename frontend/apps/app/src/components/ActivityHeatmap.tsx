import { useMemo } from "react"

export type HeatmapDataItem = {
  date: string
  total: number
  completed: number
}

export function ActivityHeatmap({ data }: { data: HeatmapDataItem[] }) {
  const weeks = useMemo(() => buildWeeks(data), [data])

  return (
    <div className="w-full overflow-x-auto">
      <svg viewBox={`0 0 ${weeks.length * 14 + 30} 134`} className="max-h-36">
        {weeks.map((week, wi) =>
          week.map((day, di) => {
            if (!day) return null
            const intensity = day.total > 0 ? Math.round((day.completed / day.total) * 4) : 0
            const fill = INTENSITY_COLORS[intensity as keyof typeof INTENSITY_COLORS]
            return (
              <rect
                key={day.date}
                x={wi * 14 + 14}
                y={di * 16 + 2}
                width={12}
                height={12}
                rx={2}
                fill={fill}
              >
                <title>{`${day.date}: ${day.completed}/${day.total}`}</title>
              </rect>
            )
          }),
        )}
      </svg>
    </div>
  )
}

const INTENSITY_COLORS = {
  0: "var(--color-muted)",
  1: "var(--color-green-200)",
  2: "var(--color-green-400)",
  3: "var(--color-green-600)",
  4: "var(--color-green-800)",
}

type WeekGrid = (HeatmapDataItem | null)[][]

function buildWeeks(data: HeatmapDataItem[]): WeekGrid {
  if (data.length === 0) return []

  const map = new Map<string, HeatmapDataItem>()
  for (const item of data) {
    map.set(item.date, item)
  }

  const weeks: WeekGrid = []
  let currentWeek: (HeatmapDataItem | null)[] = []

  const firstDate = new Date(data[0].date)
  const startDay = firstDate.getDay()
  for (let i = 0; i < startDay; i++) {
    currentWeek.push(null)
  }

  for (const item of data) {
    if (currentWeek.length === 7) {
      weeks.push(currentWeek)
      currentWeek = []
    }
    currentWeek.push(map.get(item.date) ?? null)
  }

  while (currentWeek.length < 7) {
    currentWeek.push(null)
  }
  weeks.push(currentWeek)

  return weeks
}