import { useMemo } from "react"

export type HeatmapDataItem = {
  date: string
  level: number
  title?: string
}

const CELL_SIZE = 8
const X_STEP = 11
const Y_STEP = 11
const LEFT_GUTTER = 26
const TOP_GUTTER = 19
const LEGEND_HEIGHT = 22

const MONTH_NAMES = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
]

const DAY_LABELS = [
  { index: 1, name: "Mon" },
  { index: 3, name: "Wed" },
  { index: 5, name: "Fri" },
]

const LEVELS: (keyof typeof INTENSITY_COLORS)[] = [0, 1, 2, 3, 4]

const INTENSITY_COLORS = {
  0: "var(--color-muted)",
  1: "var(--color-green-200)",
  2: "var(--color-green-400)",
  3: "var(--color-green-600)",
  4: "var(--color-green-800)",
}

type WeekGrid = (HeatmapDataItem | null)[][]

export function ActivityHeatmap({ data }: { data: HeatmapDataItem[] }) {
  const weeks = useMemo(() => buildWeeks(data), [data])

  const monthLabels = useMemo(() => {
    const labels: { x: number; label: string }[] = []
    let lastMonth = -1
    let lastWeekIndex = -3
    weeks.forEach((week, wi) => {
      const firstDay = week.find((day): day is HeatmapDataItem => day !== null)
      if (!firstDay) return
      const month = Number(firstDay.date.slice(5, 7)) - 1
      if (month === lastMonth || wi - lastWeekIndex < 3) return
      labels.push({ x: LEFT_GUTTER + wi * X_STEP, label: MONTH_NAMES[month] })
      lastMonth = month
      lastWeekIndex = wi
    })
    return labels
  }, [weeks])

  const width = LEFT_GUTTER + weeks.length * X_STEP
  const height = TOP_GUTTER + 7 * Y_STEP + LEGEND_HEIGHT
  const legendY = TOP_GUTTER + 7 * Y_STEP + LEGEND_HEIGHT / 2
  const legendBoxStartX = width - 4 - 26 - 6 - 5 * X_STEP
  const legendLessX = legendBoxStartX - 6 - 28

  return (
    <div className="w-full overflow-x-auto">
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Activity heatmap">
        {monthLabels.map(({ x, label }) => (
          <text
            key={`month-${label}-${x}`}
            x={x}
            y={12}
            fontSize={8}
            fill="var(--color-muted-foreground)"
          >
            {label}
          </text>
        ))}
        {DAY_LABELS.map(({ index, name }) => (
          <text
            key={name}
            x={LEFT_GUTTER - 6}
            y={TOP_GUTTER + index * Y_STEP + CELL_SIZE / 2}
            dominantBaseline="central"
            textAnchor="end"
            fontSize={8}
            fill="var(--color-muted-foreground)"
          >
            {name}
          </text>
        ))}
        {weeks.map((week, wi) =>
          week.map((day, di) => {
            if (!day) return null
            const fill = INTENSITY_COLORS[day.level as keyof typeof INTENSITY_COLORS]
            return (
              <rect
                key={day.date}
                x={LEFT_GUTTER + wi * X_STEP}
                y={TOP_GUTTER + di * Y_STEP}
                width={CELL_SIZE}
                height={CELL_SIZE}
                rx={2}
                fill={fill}
              >
                <title>{day.title ?? day.date}</title>
              </rect>
            )
          }),
        )}
        <text
          x={legendLessX}
          y={legendY}
          fontSize={8}
          fill="var(--color-muted-foreground)"
          dominantBaseline="central"
        >
          Less
        </text>
        {LEVELS.map((level) => (
          <rect
            key={level}
            x={legendBoxStartX + level * X_STEP}
            y={legendY - CELL_SIZE / 2}
            width={CELL_SIZE}
            height={CELL_SIZE}
            rx={2}
            fill={INTENSITY_COLORS[level]}
          />
        ))}
        <text
          x={width - 4}
          y={legendY}
          textAnchor="end"
          fontSize={8}
          fill="var(--color-muted-foreground)"
          dominantBaseline="central"
        >
          More
        </text>
      </svg>
    </div>
  )
}

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
