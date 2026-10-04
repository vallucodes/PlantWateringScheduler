"use client"

import { useEffect, useRef, useState } from "react"
import {
  ArrowDownRight,
  ArrowUpRight,
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronsDownUp,
  ChevronsUpDown,
  Droplets,
  Leaf,
  LogIn,
  Pencil,
  Plus,
  RotateCcw,
  Search,
  Snowflake,
  Sprout,
  SunMedium,
  Trash2,
  X,
} from "lucide-react"
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"

import { Button } from "@/components/ui/button"
import { ChartContainer } from "@/components/ui/chart"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"

export type Plant = {
  id: number
  name: string
  group: string
  wateringInterval: number | null
  winterGroup: string
  winterWateringInterval: number | null
  winterLastWatered: string | null
  estimatedWateringInterval: number | null
  lastWatered: string | null
  room: string
  minWeight: number
  maxWeight: number
  history: { date: string; weight: number | null }[]
}

type ScheduleGroup = {
  name: string
  lastWatered: string | null
  intervalStart: number | null
  intervalEnd: number | null
}

type PersistedGroupDate = {
  season: "summer" | "winter"
  name: string
  date: string | null
}

function wateringDateKey(season: "summer" | "winter", groupName: string) {
  return `${season}:${groupName}`
}

function plantWateringDateKey(season: "summer" | "winter", plantId: number) {
  return `${season}:${plantId}`
}

const scheduleGroups: ScheduleGroup[] = [
  { name: "30", lastWatered: null, intervalStart: 30, intervalEnd: 30 },
  { name: "20", lastWatered: null, intervalStart: 20, intervalEnd: 20 },
  { name: "14", lastWatered: null, intervalStart: 14, intervalEnd: 14 },
  { name: "9", lastWatered: null, intervalStart: 9, intervalEnd: 9 },
  { name: "7", lastWatered: null, intervalStart: 7, intervalEnd: 7 },
  { name: "5", lastWatered: null, intervalStart: 5, intervalEnd: 5 },
  { name: "2", lastWatered: null, intervalStart: 2, intervalEnd: 2 },
  { name: "Unassigned", lastWatered: null, intervalStart: null, intervalEnd: null },
]

type GroupColor = { accent: string; row: string; border: string }

/** Highest → lowest interval: purple → red → orange → yellow → green → blue */
const groupColorSpectrum: Array<[number, number, number]> = [
  [124, 75, 153],
  [196, 58, 74],
  [198, 91, 43],
  [217, 191, 46],
  [113, 184, 129],
  [96, 122, 170],
]

const unassignedGroupColor: GroupColor = {
  accent: "#ffffff",
  row: "rgba(112, 124, 128, 0.5)",
  border: "rgba(142, 151, 165, 0.8)",
}

function mixRgb(start: [number, number, number], end: [number, number, number], t: number): [number, number, number] {
  return [
    Math.round(start[0] + (end[0] - start[0]) * t),
    Math.round(start[1] + (end[1] - start[1]) * t),
    Math.round(start[2] + (end[2] - start[2]) * t),
  ]
}

function rgbAtSpectrum(t: number): [number, number, number] {
  const clamped = Math.min(1, Math.max(0, t))
  const lastIndex = groupColorSpectrum.length - 1
  const scaled = clamped * lastIndex
  const index = Math.min(lastIndex - 1, Math.floor(scaled))
  const localT = scaled - index
  return mixRgb(groupColorSpectrum[index], groupColorSpectrum[index + 1], localT)
}

function colorFromRgb(rgb: [number, number, number]): GroupColor {
  const [r, g, b] = rgb
  return {
    accent: "#ffffff",
    row: `rgba(${r}, ${g}, ${b}, 0.5)`,
    border: `rgba(${r}, ${g}, ${b}, 0.8)`,
  }
}

/** Colors by sorted position among assigned groups (highest first). Unassigned stays gray. */
function colorForGroup(group: string, orderedGroupNames: string[]) {
  if (group === "Unassigned") return unassignedGroupColor

  const assigned = orderedGroupNames.filter((name) => name !== "Unassigned")
  const index = assigned.indexOf(group)
  if (index < 0 || assigned.length === 0) return unassignedGroupColor

  const t = assigned.length === 1 ? 0 : index / (assigned.length - 1)
  return colorFromRgb(rgbAtSpectrum(t))
}

function formatScheduleDate(date: Date) {
  const day = String(date.getUTCDate()).padStart(2, "0")
  const month = String(date.getUTCMonth() + 1).padStart(2, "0")
  return `${day}.${month}`
}

function addDays(date: Date, days: number) {
  const nextDate = new Date(date)
  nextDate.setUTCDate(nextDate.getUTCDate() + days)
  return nextDate
}

function dateInputValue(date: Date | null) {
  return date ? date.toISOString().slice(0, 10) : ""
}

function parseInputDate(value: string) {
  return value ? new Date(`${value}T00:00:00.000Z`) : null
}

function daysFromToday(date: Date) {
  const today = new Date()
  const todayUtc = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate())
  return Math.round((date.getTime() - todayUtc) / (24 * 60 * 60 * 1000))
}

function formatDaysAgo(dateLabel: string | undefined) {
  if (!dateLabel) return "not measured"

  const measuredDate = new Date(`${dateLabel}, ${new Date().getUTCFullYear()}`)
  if (Number.isNaN(measuredDate.getTime())) return "not measured"

  const daysAgo = Math.max(0, -daysFromToday(measuredDate))
  if (daysAgo === 0) return "today"
  if (daysAgo > 90) return ">90d ago"
  return `${daysAgo}d ago`
}

function latestMeasuredDate(history: Plant["history"]) {
  return history.findLast((entry) => entry.weight !== null)?.date
}

function NextWateringColumn({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <div className="min-h-px min-w-0 flex-1" />
      <div className="w-20 shrink-0 whitespace-nowrap text-left">{children}</div>
      <div className="invisible flex shrink-0 items-center gap-0.5" aria-hidden="true">
        <div className="w-[6.5rem] shrink-0" />
        <span className="size-6 shrink-0" />
      </div>
      <div className="size-4 shrink-0" />
    </div>
  )
}

function MondayCalendar({ value, onChange, disabled, compact = false, ariaLabel = "Choose measurement date" }: { value: string | null; onChange: (value: string | null) => void; disabled?: boolean; compact?: boolean; ariaLabel?: string }) {
  const [open, setOpen] = useState(false)
  const calendarRef = useRef<HTMLDivElement>(null)
  const selectedDate = value ? new Date(`${value}T00:00:00.000Z`) : new Date()
  const [visibleMonth, setVisibleMonth] = useState(() => new Date(Date.UTC(selectedDate.getUTCFullYear(), selectedDate.getUTCMonth(), 1)))
  const firstWeekday = (visibleMonth.getUTCDay() + 6) % 7
  const daysInMonth = new Date(Date.UTC(visibleMonth.getUTCFullYear(), visibleMonth.getUTCMonth() + 1, 0)).getUTCDate()
  const days = Array.from({ length: firstWeekday + daysInMonth }, (_, index) => index < firstWeekday ? null : index - firstWeekday + 1)
  const monthLabel = visibleMonth.toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" })
  const selectedDateLabel = value ? selectedDate.toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC" }) : "Not recorded"
  const today = new Date()
  const todayValue = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`

  useEffect(() => {
    if (!open) return
    const closeOnOutsidePointer = (event: PointerEvent) => {
      if (!calendarRef.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener("pointerdown", closeOnOutsidePointer)
    return () => document.removeEventListener("pointerdown", closeOnOutsidePointer)
  }, [open])

  const selectDay = (day: number) => {
    const selected = new Date(Date.UTC(visibleMonth.getUTCFullYear(), visibleMonth.getUTCMonth(), day))
    onChange(selected.toISOString().slice(0, 10))
    setOpen(false)
  }

  return (
    <div ref={calendarRef} className="relative">
      <Button type="button" variant={compact ? "ghost" : "outline"} size="sm" aria-label={ariaLabel} title={ariaLabel} onClick={(event) => { event.stopPropagation(); setOpen((current) => !current) }} disabled={disabled} className={compact ? "size-6 border-transparent bg-transparent p-0 text-[#55705a] hover:bg-transparent" : "h-8 border-[#cbdac8] px-2 text-[#55705a] hover:bg-[#eef3eb]"}>
        <CalendarDays className="size-3.5" />
        {!compact ? <span>{selectedDateLabel}</span> : null}
      </Button>
      {open ? <div onClick={(event) => event.stopPropagation()} onKeyDown={(event) => event.stopPropagation()} className="absolute bottom-10 left-0 z-50 w-64 cursor-default rounded-md border border-[#d8dfd5] bg-[#fbfcf8] p-3 shadow-lg">
        <div className="mb-2 flex items-center justify-between text-sm font-medium text-[#315d42]">
          <button type="button" aria-label="Previous month" onClick={() => setVisibleMonth((current) => new Date(Date.UTC(current.getUTCFullYear(), current.getUTCMonth() - 1, 1)))} className="cursor-pointer rounded p-1 transition-colors hover:bg-[#303a34] hover:text-white"><ChevronLeft className="size-4" /></button>
          <span>{monthLabel}</span>
          <button type="button" aria-label="Next month" onClick={() => setVisibleMonth((current) => new Date(Date.UTC(current.getUTCFullYear(), current.getUTCMonth() + 1, 1)))} className="cursor-pointer rounded p-1 transition-colors hover:bg-[#303a34] hover:text-white"><ChevronRight className="size-4" /></button>
        </div>
        <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-semibold text-[#889488]">{["M", "T", "W", "T", "F", "S", "S"].map((day, index) => <span key={`${day}-${index}`}>{day}</span>)}</div>
        <div className="mt-1 grid grid-cols-7 gap-1 text-center text-xs">{days.map((day, index) => {
          if (day === null) return <span key={`empty-${index}`} className="cursor-default" />
          const dateValue = new Date(Date.UTC(visibleMonth.getUTCFullYear(), visibleMonth.getUTCMonth(), day)).toISOString().slice(0, 10)
          const isSelected = value === dateValue
          const isToday = todayValue === dateValue
          const dayStateClass = isSelected
              ? "bg-[#315d42] text-white hover:bg-[#162c1d] hover:text-white"
            : isToday
              ? "bg-[#39483d] font-bold text-white ring-2 ring-[#526957] hover:bg-[#4c5e4d] hover:text-white"
              : "hover:bg-[#303a34] hover:text-white"
          return <button key={dateValue} type="button" onClick={() => selectDay(day)} className={`cursor-pointer rounded p-1.5 text-[#315d42] transition-colors ${dayStateClass}`}>{day}</button>
        })}</div>
        {value ? <button type="button" onClick={() => { onChange(null); setOpen(false) }} className="mt-2 w-full cursor-pointer rounded p-1 text-xs text-[#78847a] transition-colors hover:bg-[#303a34] hover:text-white">Clear date</button> : null}
      </div> : null}
    </div>
  )
}

function WateringSchedule({ plants, groupDates, query, initialSeason, onQueryChange, onPlantUpdated, onEstimatedUpdated, onWeightAdded, onWeightRemoved, onGroupWatered, onLastWateredChanged, onSeasonChanged }: { plants: Plant[]; groupDates: PersistedGroupDate[]; query: string; initialSeason: "summer" | "winter"; onQueryChange: (query: string) => void; onPlantUpdated: (plantId: number, season: "summer" | "winter", group: string, wateringInterval: number | null) => void; onEstimatedUpdated: (plantId: number, interval: number | null) => void; onWeightAdded: (plantId: number, date: string, weight: number) => void; onWeightRemoved: (plantId: number, date: string) => void; onGroupWatered: (plantId: number, season: "summer" | "winter") => Promise<string>; onLastWateredChanged: (plantId: number | null, season: "summer" | "winter", date: string | null, groupKey?: string) => Promise<string | null>; onSeasonChanged: (season: "summer" | "winter") => void }) {
  const [lastWateredDates, setLastWateredDates] = useState<Record<string, Date | null>>(
    () => Object.fromEntries([
      ...scheduleGroups.map((group) => [wateringDateKey("summer", group.name), null]),
      ...groupDates.map((group) => [wateringDateKey(group.season, group.name), group.date ? new Date(group.date) : null]),
      ...plants.map((plant) => [wateringDateKey("summer", plant.group), plant.lastWatered ? new Date(plant.lastWatered) : null]),
      ...plants.map((plant) => [wateringDateKey("winter", plant.winterGroup), plant.winterLastWatered ? new Date(plant.winterLastWatered) : null]),
    ]),
  )
  const [plantLastWateredDates, setPlantLastWateredDates] = useState<Record<string, Date | null>>(
    () => Object.fromEntries([
      ...plants.filter((plant) => plant.group === "Unassigned").map((plant) => [plantWateringDateKey("summer", plant.id), plant.lastWatered ? new Date(plant.lastWatered) : null]),
      ...plants.filter((plant) => plant.winterWateringInterval === null).map((plant) => [plantWateringDateKey("winter", plant.id), plant.winterLastWatered ? new Date(plant.winterLastWatered) : null]),
    ]),
  )
  const [season, setSeason] = useState<"summer" | "winter">(initialSeason)
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({})
  const [wateringGroup, setWateringGroup] = useState<string | null>(null)

  const updateLastWatered = (seasonName: "summer" | "winter", groupName: string, date: Date | null) => {
    setLastWateredDates((current) => ({ ...current, [wateringDateKey(seasonName, groupName)]: date }))
  }

  const updatePlantLastWatered = (seasonName: "summer" | "winter", plantId: number, date: Date | null) => {
    setPlantLastWateredDates((current) => ({ ...current, [plantWateringDateKey(seasonName, plantId)]: date }))
  }

  const seasonPlants = plants.map((plant) => ({
    ...plant,
    group: season === "winter"
      ? plant.winterWateringInterval === null ? "Unassigned" : plant.winterGroup
      : plant.wateringInterval === null ? "Unassigned" : plant.group,
    scheduleInterval: season === "winter" ? plant.winterWateringInterval : plant.wateringInterval,
  }))
  const groups = seasonPlants.reduce<ScheduleGroup[]>((current, plant) => {
    const groupName = plant.group
    if (!current.some((group) => group.name === groupName)) {
      current.push({
        name: groupName,
        lastWatered: null,
        intervalStart: plant.scheduleInterval,
        intervalEnd: plant.scheduleInterval,
      })
    }
    return current
  }, [])
  for (const group of scheduleGroups) {
    if (!groups.some((currentGroup) => currentGroup.name === group.name) && season === "summer") {
      groups.push(group)
    }
  }
  for (const plant of seasonPlants) {
    if (!groups.some((group) => group.name === plant.group)) {
      groups.push({
        name: plant.group,
        lastWatered: null,
        intervalStart: plant.wateringInterval,
        intervalEnd: plant.wateringInterval,
      })
    }
  }
  groups.sort((firstGroup, secondGroup) => {
    if (firstGroup.name === "Unassigned") return 1
    if (secondGroup.name === "Unassigned") return -1
    return Number(secondGroup.name) - Number(firstGroup.name)
  })

  const rows = groups.map((group) => {
    const lastWateredDate = lastWateredDates[wateringDateKey(season, group.name)]
    const nextWateringDates = lastWateredDate && group.intervalStart !== null && group.intervalEnd !== null
      ? group.intervalStart === group.intervalEnd
        ? [addDays(lastWateredDate, group.intervalStart)]
        : [addDays(lastWateredDate, group.intervalStart), addDays(lastWateredDate, group.intervalEnd)]
      : []

    return {
      group: group.name,
      lastWatered: lastWateredDate,
      nextWateringDates,
      plants: seasonPlants.filter((plant) => plant.group === group.name && plant.name.toLowerCase().includes(query.toLowerCase())),
    }
  })

  const orderedGroupNames = groups.map((group) => group.name)

  return (
    <div className="mt-9 overflow-visible border-y border-[#d8dfd5]">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#e0e6dd] px-1 py-2">
        <div className="flex items-center gap-2">
          <Button type="button" variant="ghost" size="sm" onClick={() => setExpandedGroups(Object.fromEntries(groups.map((group) => [group.name, true])))} className="h-8 gap-1.5 px-2 text-xs text-[#55705a] hover:bg-[#eef3eb]">
            <ChevronsDownUp className="size-3.5" />
            Expand all
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={() => setExpandedGroups(Object.fromEntries(groups.map((group) => [group.name, false])))} className="h-8 gap-1.5 px-2 text-xs text-[#55705a] hover:bg-[#eef3eb]">
            <ChevronsUpDown className="size-3.5" />
            Collapse all
          </Button>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#9aa39b]" />
            <Input value={query} onChange={(event) => onQueryChange(event.target.value)} placeholder="Search plants" className="h-9 w-full border-[#d8dfd5] bg-[#f7f9f5] pl-9 text-sm md:w-44" />
            {query && <button type="button" aria-label="Clear search" onClick={() => onQueryChange("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-[#9aa39b]"><X className="size-3.5" /></button>}
          </div>
          <Button type="button" variant="outline" size="icon" aria-label="Add plant" className="h-9 w-9 border-[#d8dfd5] text-[#315d42]"><Plus className="size-4" /></Button>
        </div>
      </div>
      <div className="grid grid-cols-[minmax(7rem,1.1fr)_minmax(8rem,1fr)_minmax(8rem,1.2fr)] items-center gap-4 border-b border-[#e0e6dd] px-1 py-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#9aa39b] sm:grid-cols-[minmax(8rem,1.1fr)_minmax(8rem,1fr)_minmax(10rem,1.2fr)]">
        <span>Watering group</span>
        <span>Last watered</span>
        <NextWateringColumn>Next watering</NextWateringColumn>
      </div>
      {rows.map((row) => {
        const groupColor = colorForGroup(row.group, orderedGroupNames)
        const isExpanded = query.trim().length > 0 || (expandedGroups[row.group] ?? false)
        return <div key={row.group} className="border-b last:border-b-0" style={{ borderColor: groupColor.border }}>
          <div
            role="button"
            tabIndex={0}
            aria-expanded={isExpanded}
            onClick={() => setExpandedGroups((current) => ({ ...current, [row.group]: !isExpanded }))}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault()
                setExpandedGroups((current) => ({ ...current, [row.group]: !isExpanded }))
              }
            }}
            style={{ backgroundColor: groupColor.row }}
            className="grid cursor-pointer grid-cols-[minmax(7rem,1.1fr)_minmax(8rem,1fr)_minmax(8rem,1.2fr)] items-center gap-4 px-1 py-3.5 text-sm transition-colors hover:brightness-110 sm:grid-cols-[minmax(8rem,1.1fr)_minmax(8rem,1fr)_minmax(10rem,1.2fr)]"
          >
          <div>
            <p style={{ color: groupColor.accent }} className="flex items-center gap-2 font-heading text-4xl font-bold tracking-tight"><ChevronDown className={`size-4 transition-transform ${isExpanded ? "" : "-rotate-90"}`} />{row.group}</p>
          </div>
          <div className="flex min-w-0 items-center gap-2">
            {row.group !== "Unassigned" ? <>
            <div className="flex w-[5.25rem] shrink-0 items-center gap-1.5">
              <MondayCalendar
                value={dateInputValue(lastWateredDates[wateringDateKey(season, row.group)]) || null}
                onChange={async (value) => {
                  const date = value ? parseInputDate(value) : null
                  const groupPlant = seasonPlants.find((plant) => plant.group === row.group)
                  const groupKey = row.group === "Unassigned" ? "unassigned" : row.group
                  const savedDate = await onLastWateredChanged(groupPlant?.id ?? null, season, date ? date.toISOString().slice(0, 10) : null, groupPlant ? undefined : groupKey)
                  updateLastWatered(season, row.group, savedDate ? new Date(savedDate) : null)
                }}
                compact
                ariaLabel={`Set last watered date for ${row.group}`}
              />
              <span className="font-bold tabular-nums text-white">{row.lastWatered ? formatScheduleDate(lastWateredDates[wateringDateKey(season, row.group)] as Date) : "Not recorded"}</span>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={async (event) => {
                event.stopPropagation()
                const groupPlant = seasonPlants.find((plant) => plant.group === row.group)
                if (!groupPlant) return
                setWateringGroup(row.group)
                try {
                  const date = await onGroupWatered(groupPlant.id, season)
                  updateLastWatered(season, row.group, new Date(date))
                } finally {
                  setWateringGroup(null)
                }
              }}
              disabled={wateringGroup === row.group}
              onKeyDown={(event) => event.stopPropagation()}
              className="h-7 shrink-0 border-[#cbdac8] px-2 text-xs text-[#315d42] hover:bg-[#eef3eb]"
            >
              Water now
            </Button>
            </> : null}
          </div>
          {row.group !== "Unassigned" && row.nextWateringDates.length > 0 ? (
            <NextWateringColumn>
              <span className="font-medium text-[#1f3428]">
                {row.nextWateringDates.map((date, index) => (
                  <span key={date.toISOString()} className="block text-left">
                    {index > 0 && <span className="mr-1 text-[#9aa39b]">-</span>}
                    {formatScheduleDate(date)} <strong className="font-bold text-[#315d42]">({daysFromToday(date) > 0 ? "+" : ""}{daysFromToday(date)} days)</strong>
                  </span>
                ))}
              </span>
            </NextWateringColumn>
          ) : (
            <NextWateringColumn>
              <span className="font-medium text-[#1f3428]">Not recorded</span>
            </NextWateringColumn>
          )}
          </div>
          {isExpanded && row.plants.length > 0 ? <div>{row.plants.map((plant) => <PlantCard key={plant.id} plant={plant} groupColor={groupColor} lastWateredDate={plant.group === "Unassigned" ? plantLastWateredDates[plantWateringDateKey(season, plant.id)] ?? null : null} onLastWateredUpdated={plant.group === "Unassigned" ? async (date) => { const savedDate = await onLastWateredChanged(plant.id, season, date ? date.toISOString().slice(0, 10) : null); updatePlantLastWatered(season, plant.id, savedDate ? new Date(savedDate) : null) } : undefined} onUpdated={(season, nextGroup, wateringInterval) => onPlantUpdated(plant.id, season, nextGroup, wateringInterval)} onEstimateUpdated={(interval) => onEstimatedUpdated(plant.id, interval)} onWeightAdded={(date, weight) => onWeightAdded(plant.id, date, weight)} onWeightRemoved={(date) => onWeightRemoved(plant.id, date)} />)}</div> : null}
        </div>
      })}
      <div className="flex items-center justify-between gap-3 border-t border-[#d8dfd5] px-1 py-3">
        <span className="text-xs text-[#78847a]">Watering season</span>
        <button
          type="button"
          role="switch"
          aria-checked={season === "winter"}
          onClick={() => {
            const nextSeason = season === "summer" ? "winter" : "summer"
            setSeason(nextSeason)
            onSeasonChanged(nextSeason)
          }}
          className="flex items-center gap-2 rounded-md border border-[#d8dfd5] px-2.5 py-1.5 text-xs font-medium text-[#55705a] transition-colors hover:bg-[#eef3eb]"
        >
          {season === "summer" ? <SunMedium className="size-3.5" /> : <Snowflake className="size-3.5" />}
          {season === "summer" ? "Summer" : "Winter "}
        </button>
      </div>
    </div>
  )
}

function getMoisture(plant: Plant) {
  const current = plant.history.findLast((log) => log.weight !== null)?.weight ?? plant.minWeight
  const range = plant.maxWeight - plant.minWeight
  const percentage = range > 0 ? Math.round(((current - plant.minWeight) / range) * 100) : 0
  return { current, percentage: Math.min(100, Math.max(0, percentage)) }
}

function getWeightAxis(dataMin: number, dataMax: number) {
  const yAxisPadding = Math.max(10, (dataMax - dataMin) * 0.05)
  const minimum = Math.floor((dataMin - yAxisPadding) / 5) * 5
  const maximum = Math.ceil((dataMax + yAxisPadding) / 5) * 5
  const ticks = Array.from({ length: Math.floor((maximum - minimum) / 5) + 1 }, (_, index) => minimum + index * 5)

  return { domain: [minimum, maximum] as [number, number], ticks }
}

function parseChartDate(value: string) {
  return new Date(`${value}, ${new Date().getUTCFullYear()}`).getTime()
}

function formatChartDate(value: string | number) {
  const date = new Date(typeof value === "number" ? value : parseChartDate(value))
  const day = String(date.getUTCDate()).padStart(2, "0")
  const month = String(date.getUTCMonth() + 1).padStart(2, "0")
  return `${day}.${month}`
}

function PlantHistory({ plant, percentage, onUpdated, onEstimateUpdated, onWeightAdded, onDeleted, onNameUpdated }: { plant: Plant; percentage: number; onUpdated: (season: "summer" | "winter", group: string, wateringInterval: number | null) => void; onEstimateUpdated: (interval: number | null) => void; onWeightAdded: (date: string, weight: number) => void; onDeleted: () => void; onNameUpdated: (name: string) => void }) {
  const [range, setRange] = useState({ startIndex: 0, endIndex: Math.max(0, plant.history.length - 1) })
  const [selectionStart, setSelectionStart] = useState<number | null>(null)
  const [selectionEnd, setSelectionEnd] = useState<number | null>(null)
  const [measurementStartIndex, setMeasurementStartIndex] = useState<number | null>(null)
  const [measurementEndIndex, setMeasurementEndIndex] = useState<number | null>(null)
  const [measurementDate, setMeasurementDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [measurementWeight, setMeasurementWeight] = useState("")
  const [measurementError, setMeasurementError] = useState<string | null>(null)
  const [isSavingMeasurement, setIsSavingMeasurement] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const visibleHistory = plant.history.slice(range.startIndex, range.endIndex + 1)
  const visibleWeights = visibleHistory.flatMap((entry) => entry.weight === null ? [] : [entry.weight])
  const dataMin = Math.min(plant.minWeight, ...visibleWeights)
  const dataMax = Math.max(plant.maxWeight, ...visibleWeights)
  const weightAxis = getWeightAxis(dataMin, dataMax)
  const chartData = visibleHistory.map((entry) => ({ ...entry, chartDate: parseChartDate(entry.date) }))
  const monthlyTicks = chartData.filter((entry) => new Date(entry.chartDate).getUTCDate() === 1).map((entry) => entry.chartDate)
  const selectedStart = selectionStart !== null && selectionEnd !== null ? Math.min(selectionStart, selectionEnd) : range.startIndex
  const selectedEnd = selectionStart !== null && selectionEnd !== null ? Math.max(selectionStart, selectionEnd) : range.endIndex
  const selectedDates = plant.history.length > 0 ? `${plant.history[selectedStart].date} - ${plant.history[selectedEnd].date}` : "No dates"
  const measurementDays = measurementStartIndex !== null && measurementEndIndex !== null
    ? Math.round(Math.abs(parseChartDate(plant.history[measurementEndIndex].date) - parseChartDate(plant.history[measurementStartIndex].date)) / 86400000)
    : null

  const indexFromChartEvent = (event: { activeTooltipIndex?: number | string | null } | undefined) => {
    if (event?.activeTooltipIndex === undefined || event.activeTooltipIndex === null) return null
    const index = Number(event.activeTooltipIndex) + range.startIndex
    return Number.isInteger(index) && index >= 0 && index < plant.history.length ? index : null
  }

  const handleChartMouseDown = (event: { activeTooltipIndex?: number | string | null } | undefined) => {
    const index = indexFromChartEvent(event)
    if (index !== null) {
      setSelectionStart(index)
      setSelectionEnd(index)
    }
  }

  const handleChartMouseMove = (event: { activeTooltipIndex?: number | string | null } | undefined) => {
    if (selectionStart === null) return
    const index = indexFromChartEvent(event)
    if (index !== null) setSelectionEnd(index)
  }

  const handleChartMouseUp = () => {
    if (selectionStart !== null && selectionEnd === selectionStart) {
      if (measurementStartIndex === null || measurementEndIndex !== null) {
        setMeasurementStartIndex(selectionStart)
        setMeasurementEndIndex(null)
      } else {
        setMeasurementEndIndex(selectionStart)
      }
    }
    if (selectionStart !== null && selectionEnd !== null && selectionStart !== selectionEnd) {
      setRange({ startIndex: Math.min(selectionStart, selectionEnd), endIndex: Math.max(selectionStart, selectionEnd) })
    }
    setSelectionStart(null)
    setSelectionEnd(null)
  }

  const handleChartMouseLeave = () => {
    setSelectionStart(null)
    setSelectionEnd(null)
  }

  const resetRange = () => {
    const fullRange = { startIndex: 0, endIndex: Math.max(0, plant.history.length - 1) }
    setRange(fullRange)
    setSelectionStart(null)
    setSelectionEnd(null)
  }

  const saveMeasurement = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const parsedWeight = Number(measurementWeight)
    if (!measurementDate || !Number.isFinite(parsedWeight) || parsedWeight < 0) {
      setMeasurementError("Enter a valid date and weight.")
      return
    }

    setMeasurementError(null)
    setIsSavingMeasurement(true)
    try {
      const response = await fetch(`/api/plants/${plant.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date: measurementDate, weight: parsedWeight }),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error ?? "Could not save measurement.")
      onWeightAdded(result.date, result.weight)
      setMeasurementWeight("")
    } catch (saveError) {
      setMeasurementError(saveError instanceof Error ? saveError.message : "Could not save measurement.")
    } finally {
      setIsSavingMeasurement(false)
    }
  }

  const deletePlant = async () => {
    if (!window.confirm(`Delete ${plant.name}? This also removes its weight history.`)) return
    setDeleteError(null)
    setIsDeleting(true)
    try {
      const response = await fetch(`/api/plants/${plant.id}`, { method: "DELETE" })
      const result = await response.json().catch(() => null)
      if (!response.ok) throw new Error(result?.error ?? "Could not delete plant.")
      onDeleted()
    } catch (deleteErrorValue) {
      setDeleteError(deleteErrorValue instanceof Error ? deleteErrorValue.message : "Could not delete plant.")
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <DialogContent className="max-w-2xl border-[#d8dfd5] bg-[#fbfcf8] p-0 sm:max-w-2xl">
      <DialogHeader className="border-b border-[#e4e9e1] px-6 py-5">
        <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.16em] text-[#6f896f]"><Leaf className="size-3.5" /> {plant.group}</div>
        <div className="flex items-center gap-2">
          <DialogTitle className="font-heading text-2xl text-[#1f3428]">{plant.name}</DialogTitle>
          <PlantNameEditor plant={plant} onUpdated={onNameUpdated} />
        </div>
        <DialogDescription>Weight history against your dry and fully-watered thresholds.</DialogDescription>
      </DialogHeader>
      <div className="px-6 pb-6 pt-5">
        <PlantScheduleEditor plant={plant} onUpdated={onUpdated} onEstimateUpdated={onEstimateUpdated} />
        <div className="mb-5 grid grid-cols-3 gap-2 text-center">
          <div className="rounded-md bg-[#f0f4ed] px-2 py-3"><p className="text-[10px] uppercase tracking-[0.12em] text-[#889488]">Current</p><p className="mt-1 font-semibold text-[#315d42]">{getMoisture(plant).current}g</p></div>
          <div className="rounded-md bg-[#f0f4ed] px-2 py-3"><p className="text-[10px] uppercase tracking-[0.12em] text-[#889488]">Dry line</p><p className="mt-1 font-semibold text-[#bd5b45]">{plant.minWeight}g</p></div>
          <div className="rounded-md bg-[#f0f4ed] px-2 py-3"><p className="text-[10px] uppercase tracking-[0.12em] text-[#889488]">Range left</p><p className="mt-1 font-semibold text-[#a4772b]">{percentage}%</p></div>
        </div>
        <div className="relative mb-2 flex items-center justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.12em] text-[#889488]">History window</p>
            <div className="mt-1 flex items-center gap-3 text-xs">
              <p className="text-[#78847a]">{selectedDates}</p>
            </div>
          </div>
          {measurementDays !== null ? <p className="absolute left-1/2 -translate-x-1/2 text-sm font-semibold text-[#315d42]">{measurementDays} days</p> : null}
          <button type="button" onClick={resetRange} aria-label="Show full weight history" className="rounded-md p-1.5 text-[#78847a] transition-colors hover:bg-[#eef3eb] hover:text-[#315d42]">
            <RotateCcw className="size-3.5" />
          </button>
        </div>
        <ChartContainer config={{ weight: { label: "Weight", color: "#467555" } }} className="h-[260px] w-full">
          <LineChart data={chartData} margin={{ top: 16, right: 12, left: 0, bottom: 0 }} onMouseDown={handleChartMouseDown} onMouseMove={handleChartMouseMove} onMouseUp={handleChartMouseUp} onMouseLeave={handleChartMouseLeave}>
            <CartesianGrid vertical={false} stroke="#e2e8df" />
            <XAxis dataKey="chartDate" type="number" domain={["dataMin", "dataMax"]} ticks={monthlyTicks} interval={0} axisLine={false} tickLine={false} tickMargin={10} tickFormatter={formatChartDate} />
            <YAxis domain={weightAxis.domain} ticks={weightAxis.ticks} axisLine={false} tickLine={false} tickMargin={8} />
            <Tooltip shared={false} contentStyle={{ borderRadius: 8, borderColor: "#d8dfd5", backgroundColor: "#fbfcf8", color: "#1f3428" }} labelStyle={{ color: "#1f3428" }} labelFormatter={(value) => formatChartDate(value as number)} formatter={(value) => [`${value}g`, "Weight"]} />
            {measurementStartIndex !== null && measurementStartIndex >= range.startIndex && measurementStartIndex <= range.endIndex ? <ReferenceLine x={chartData[measurementStartIndex - range.startIndex].chartDate} stroke="#bd5b45" strokeWidth={2} label={{ value: formatChartDate(chartData[measurementStartIndex - range.startIndex].chartDate), position: "top", fill: "#bd5b45", fontSize: 12 }} /> : null}
            {measurementEndIndex !== null && measurementEndIndex >= range.startIndex && measurementEndIndex <= range.endIndex ? <ReferenceLine x={chartData[measurementEndIndex - range.startIndex].chartDate} stroke="#bd5b45" strokeWidth={2} label={{ value: formatChartDate(chartData[measurementEndIndex - range.startIndex].chartDate), position: "top", fill: "#bd5b45", fontSize: 12 }} /> : null}
            <ReferenceLine y={plant.minWeight} stroke="#cf7459" strokeDasharray="4 4" label={{ value: "dry", position: "insideTopRight", fill: "#bd5b45", fontSize: 11 }} />
            <ReferenceLine y={plant.maxWeight} stroke="#6f9d78" strokeDasharray="4 4" label={{ value: "full", position: "insideBottomRight", fill: "#467555", fontSize: 11 }} />
            <Line type="monotone" dataKey="weight" connectNulls={false} isAnimationActive={false} stroke="#467555" strokeWidth={3} dot={{ fill: "#fbfcf8", stroke: "#467555", strokeWidth: 2, r: 4 }} activeDot={{ r: 6 }} />
          </LineChart>
        </ChartContainer>
        <form onSubmit={saveMeasurement} className="mt-5 flex flex-wrap items-end justify-start gap-2 border-t border-[#e4e9e1] pt-4">
          <label className="block text-sm font-medium text-[#315d42]" htmlFor={`measurement-date-${plant.id}`}>
            <span className="sr-only">Date</span>
            <MondayCalendar value={measurementDate} onChange={(value) => { if (value) setMeasurementDate(value) }} disabled={isSavingMeasurement} />
          </label>
          <label className="block w-full text-sm font-medium text-[#315d42] sm:w-28" htmlFor={`measurement-weight-${plant.id}`}>
            <span className="sr-only">Weight (g)</span>
            <Input id={`measurement-weight-${plant.id}`} type="number" min="0" step="0.1" aria-label="Weight in grams" value={measurementWeight} onChange={(event) => setMeasurementWeight(event.target.value)} placeholder="Weight (g)" className="h-8 border-[#cbdac8] bg-white" disabled={isSavingMeasurement} />
          </label>
          <Button type="submit" disabled={isSavingMeasurement}>{isSavingMeasurement ? "Saving..." : "Add weight"}</Button>
          {measurementError ? <p className="text-sm text-[#bd5b45] sm:col-span-3" role="alert">{measurementError}</p> : null}
        </form>
        <div className="mt-5 flex items-center justify-between border-t border-[#e4e9e1] pt-4">
          {deleteError ? <p className="text-sm text-[#bd5b45]" role="alert">{deleteError}</p> : <span />}
          <Button type="button" variant="destructive" size="sm" onClick={deletePlant} disabled={isDeleting}>
            <Trash2 className="size-3.5" />
            {isDeleting ? "Deleting..." : "Delete plant"}
          </Button>
        </div>
      </div>
    </DialogContent>
  )
}

function PlantNameEditor({ plant, onUpdated }: { plant: Plant; onUpdated: (name: string) => void }) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState(plant.name)
  const [error, setError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  const saveName = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const nextName = name.trim()
    if (!nextName) {
      setError("Plant name is required.")
      return
    }

    setError(null)
    setIsSaving(true)
    try {
      const response = await fetch(`/api/plants/${plant.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: nextName }),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error ?? "Could not update plant name.")
      onUpdated(result.name)
      setName(result.name)
      setOpen(false)
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Could not update plant name.")
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" variant="ghost" size="icon-xs" aria-label={`Edit name for ${plant.name}`} className="text-[#55705a] hover:bg-[#eef3eb]"><Pencil className="size-3.5" /></Button>
      </DialogTrigger>
      <DialogContent className="border-[#d8dfd5] bg-[#fbfcf8] sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-[#1f3428]">Edit plant name</DialogTitle>
          <DialogDescription>Update the name shown in your collection.</DialogDescription>
        </DialogHeader>
        <form onSubmit={saveName} className="space-y-4">
          <label className="block text-sm font-medium text-[#315d42]" htmlFor={`plant-name-${plant.id}`}>
            Name
            <Input id={`plant-name-${plant.id}`} required value={name} onChange={(event) => setName(event.target.value)} className="mt-1.5 border-[#cbdac8] bg-white" />
          </label>
          {error ? <p className="text-sm text-[#bd5b45]" role="alert">{error}</p> : null}
          <div className="flex justify-end gap-2">
            <DialogClose asChild><Button type="button" variant="outline">Cancel</Button></DialogClose>
            <Button type="submit" disabled={isSaving}>{isSaving ? "Saving..." : "Save name"}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function PlantScheduleEditor({ plant, onUpdated, onEstimateUpdated }: { plant: Plant; onUpdated: (season: "summer" | "winter", group: string, wateringInterval: number | null) => void; onEstimateUpdated: (interval: number | null) => void }) {
  const [open, setOpen] = useState(false)
  const [summerInterval, setSummerInterval] = useState(plant.wateringInterval?.toString() ?? "")
  const [winterInterval, setWinterInterval] = useState(plant.winterWateringInterval?.toString() ?? "")
  const [estimatedInterval, setEstimatedInterval] = useState(plant.estimatedWateringInterval?.toString() ?? "")
  const [error, setError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  const saveSchedule = async (event: React.FormEvent<HTMLFormElement>, season: "summer" | "winter", value: string) => {
    event.preventDefault()
    setError(null)
    setIsSaving(true)

    const intervalDays = value.trim() === "" ? null : Number(value)
    if (intervalDays !== null && (!Number.isInteger(intervalDays) || intervalDays < 1 || intervalDays > 365)) {
      setError("Enter a whole number from 1 to 365, or leave it empty.")
      setIsSaving(false)
      return
    }

    try {
      const response = await fetch(`/api/plants/${plant.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(season === "winter" ? { winterIntervalDays: intervalDays } : { intervalDays }),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error ?? "Could not update schedule.")

      if (season === "summer") setSummerInterval(intervalDays?.toString() ?? "")
      else setWinterInterval(intervalDays?.toString() ?? "")
      onUpdated(result.season, result.group, result.wateringInterval)
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Could not update schedule.")
    } finally {
      setIsSaving(false)
    }
  }

  const saveEstimate = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)
    setIsSaving(true)
    const intervalDays = estimatedInterval.trim() === "" ? null : Number(estimatedInterval)
    if (intervalDays !== null && (!Number.isInteger(intervalDays) || intervalDays < 1 || intervalDays > 365)) {
      setError("Enter a whole number from 1 to 365, or leave it empty.")
      setIsSaving(false)
      return
    }

    try {
      const response = await fetch(`/api/plants/${plant.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ estimatedWateringInterval: intervalDays }),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error ?? "Could not update estimate.")
      setEstimatedInterval(intervalDays?.toString() ?? "")
      onEstimateUpdated(intervalDays)
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Could not update estimate.")
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" variant="outline" size="sm" className="h-8 border-[#cbdac8] text-[#315d42] hover:bg-[#eef3eb]">
          <Pencil className="size-3.5" />
          Modify watering group
        </Button>
      </DialogTrigger>
      <DialogContent className="border-[#d8dfd5] bg-[#fbfcf8] sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-[#1f3428]">Modify watering groups</DialogTitle>
          <DialogDescription>Set summer and winter watering intervals separately for {plant.name}.</DialogDescription>
        </DialogHeader>
          <div className="grid gap-4 sm:grid-cols-2">
            {(["summer", "winter"] as const).map((season) => {
              const value = season === "summer" ? summerInterval : winterInterval
              const setValue = season === "summer" ? setSummerInterval : setWinterInterval
              return <form key={season} onSubmit={(event) => saveSchedule(event, season, value)} className="space-y-3 rounded-md border border-[#d8dfd5] bg-white/60 p-3">
                <label className="block text-sm font-medium capitalize text-[#315d42]" htmlFor={`${season}-watering-interval-${plant.id}`}>
                  {season} interval
                  <Input
                    id={`${season}-watering-interval-${plant.id}`}
                    type="number"
                    min="1"
                    max="365"
                    step="1"
                    value={value}
                    onChange={(event) => setValue(event.target.value)}
                    placeholder="No schedule"
                    className="mt-1.5 border-[#cbdac8] bg-white"
                  />
                </label>
                <Button type="submit" disabled={isSaving} className="w-full">{isSaving ? "Saving..." : `Save ${season}`}</Button>
              </form>
            })}
          {error ? <p className="text-sm text-[#bd5b45]" role="alert">{error}</p> : null}
          </div>
          {plant.group === "Unassigned" ? <form onSubmit={saveEstimate} className="mt-4 space-y-3 rounded-md border border-[#d8dfd5] bg-white/60 p-3">
            <label className="block text-sm font-medium text-[#315d42]" htmlFor={`estimated-watering-interval-${plant.id}`}>
              Estimated interval for this plant
              <Input
                id={`estimated-watering-interval-${plant.id}`}
                type="number"
                min="1"
                max="365"
                step="1"
                value={estimatedInterval}
                onChange={(event) => setEstimatedInterval(event.target.value)}
                placeholder="No estimate"
                className="mt-1.5 border-[#cbdac8] bg-white"
              />
            </label>
            <Button type="submit" disabled={isSaving} className="w-full">{isSaving ? "Saving..." : "Save estimate"}</Button>
          </form> : null}
          <div className="flex justify-end"><DialogClose asChild><Button type="button" variant="outline">Close</Button></DialogClose></div>
      </DialogContent>
    </Dialog>
  )
}

function PlantCard({ plant, groupColor, lastWateredDate, onLastWateredUpdated, onUpdated, onEstimateUpdated, onWeightAdded, onWeightRemoved, onDeleted, onNameUpdated }: { plant: Plant; groupColor: GroupColor; lastWateredDate: Date | null; onLastWateredUpdated?: (date: Date | null) => Promise<void>; onUpdated: (season: "summer" | "winter", group: string, wateringInterval: number | null) => void; onEstimateUpdated: (interval: number | null) => void; onWeightAdded: (date: string, weight: number) => void; onWeightRemoved: (date: string) => void; onDeleted?: () => void; onNameUpdated?: (name: string) => void }) {
  const { current, percentage } = getMoisture(plant)
  const [weight, setWeight] = useState("")
  const [isSavingWeight, setIsSavingWeight] = useState(false)
  const [isRemovingWeight, setIsRemovingWeight] = useState(false)
  const [weightError, setWeightError] = useState<string | null>(null)
  const nextWatering = plant.group === "Unassigned" && lastWateredDate && plant.estimatedWateringInterval !== null
    ? addDays(lastWateredDate, plant.estimatedWateringInterval)
    : null

  const saveWeight = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const parsedWeight = Number(weight)
    if (!Number.isFinite(parsedWeight) || parsedWeight < 0) {
      setWeightError("Enter a valid weight.")
      return
    }

    setWeightError(null)
    setIsSavingWeight(true)
    const currentInput = event.currentTarget.querySelector<HTMLInputElement>("[data-weight-input]")
    const weightInputs = Array.from(document.querySelectorAll<HTMLInputElement>("[data-weight-input]"))
    const currentInputIndex = currentInput ? weightInputs.indexOf(currentInput) : -1
    try {
      const response = await fetch(`/api/plants/${plant.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ weight: parsedWeight }),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error ?? "Could not save weight.")
      onWeightAdded(result.date, result.weight)
      setWeight("")
      if (currentInputIndex >= 0) {
        window.requestAnimationFrame(() => {
          const nextInput = document.querySelectorAll<HTMLInputElement>("[data-weight-input]")[currentInputIndex + 1]
          nextInput?.focus()
        })
      }
    } catch (saveError) {
      setWeightError(saveError instanceof Error ? saveError.message : "Could not save weight.")
    } finally {
      setIsSavingWeight(false)
    }
  }
  const removeLatestWeight = async (event: React.MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation()
    setIsRemovingWeight(true)
    setWeightError(null)
    try {
      const response = await fetch(`/api/plants/${plant.id}?weight=latest`, { method: "DELETE" })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error ?? "Could not remove weight.")
      onWeightRemoved(result.date)
    } catch (removeError) {
      setWeightError(removeError instanceof Error ? removeError.message : "Could not remove weight.")
    } finally {
      setIsRemovingWeight(false)
    }
  }
  const moveToWeightInput = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return

    const weightInputs = Array.from(document.querySelectorAll<HTMLInputElement>("[data-weight-input]"))
    const currentIndex = weightInputs.indexOf(event.currentTarget)
    const nextIndex = currentIndex + (event.key === "ArrowDown" ? 1 : -1)
    const nextInput = weightInputs[nextIndex]
    if (!nextInput) return

    event.preventDefault()
    nextInput.focus()
  }

  return (
    <Dialog>
      <DialogTrigger asChild>
        <div role="button" tabIndex={0} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); event.currentTarget.click() } }} style={{ backgroundColor: groupColor.row, borderColor: groupColor.border }} className={`group relative grid w-full gap-4 border-t px-1 py-4 text-left transition-colors hover:brightness-110 sm:items-center grid-cols-[minmax(7rem,1.1fr)_minmax(8rem,1fr)_minmax(8rem,1.2fr)] sm:grid-cols-[minmax(8rem,1.1fr)_minmax(8rem,1fr)_minmax(10rem,1.2fr)]`}>
          <div className="flex min-w-0 items-center gap-3"><div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[#dfe9d7] text-[#315d42]"><Sprout className="size-4" /></div><div className="min-w-0"><p className="truncate font-semibold text-[#1f3428]">{plant.name}</p></div></div>
          {plant.group === "Unassigned" ? <div className="col-span-2 flex min-w-0 items-center gap-3">
            <div className="flex shrink-0 items-center gap-2 text-sm">
              <div className="flex w-[5.25rem] shrink-0 items-center gap-1.5">
                <MondayCalendar value={dateInputValue(lastWateredDate) || null} onChange={async (value) => { await onLastWateredUpdated?.(value ? parseInputDate(value) : null) }} compact ariaLabel={`Set last watered date for ${plant.name}`} />
                <span className="font-bold tabular-nums text-white">{lastWateredDate ? formatScheduleDate(lastWateredDate) : "Not recorded"}</span>
              </div>
              <Button type="button" variant="outline" size="sm" onClick={async (event) => { event.stopPropagation(); await onLastWateredUpdated?.(new Date(Date.UTC(new Date().getFullYear(), new Date().getMonth(), new Date().getDate()))) }} onKeyDown={(event) => event.stopPropagation()} className="h-7 shrink-0 border-[#cbdac8] px-2 text-xs text-[#315d42] hover:bg-[#eef3eb]">Water now</Button>
            </div>
            <div className="min-h-px min-w-0 flex-1" />
            <div className="shrink-0 whitespace-nowrap text-sm font-medium text-[#1f3428]">{nextWatering ? <><span>{formatScheduleDate(nextWatering)}</span> <strong className="font-bold text-[#315d42]">({daysFromToday(nextWatering) > 0 ? "+" : ""}{daysFromToday(nextWatering)} days)</strong></> : "Set an interval"}</div>
            <form onSubmit={saveWeight} onClick={(event) => event.stopPropagation()} onKeyDown={(event) => event.stopPropagation()} className="flex w-20 shrink-0 items-center gap-1"><Input type="text" inputMode="decimal" value={weight} onChange={(event) => setWeight(event.target.value)} onKeyDown={moveToWeightInput} data-weight-input aria-label={`Enter current weight for ${plant.name}`} placeholder="g" className="h-8 w-full border-white/50 bg-black/20 px-2 text-sm text-white placeholder:text-white/70" disabled={isSavingWeight} /><button type="submit" className="sr-only">Save weight</button>{weightError ? <span className="text-xs text-white" role="alert">{weightError}</span> : null}</form>
            <div className="flex shrink-0 items-center gap-0.5">
              <div className="w-[6.5rem] shrink-0 text-left tabular-nums"><p className="whitespace-nowrap font-heading text-xl font-bold tracking-tight text-[#1f3428]">{current.toLocaleString()}<span className="ml-1 text-sm font-bold text-white">g</span></p><p className="whitespace-nowrap text-xs font-bold tracking-[0.08em] text-white">{formatDaysAgo(latestMeasuredDate(plant.history))}</p></div>
              {plant.history.some((entry) => entry.weight !== null) ? <button type="button" aria-label={`Remove latest weight for ${plant.name}`} title="Remove latest weight" onClick={removeLatestWeight} onKeyDown={(event) => event.stopPropagation()} disabled={isRemovingWeight} className="flex size-6 shrink-0 items-center justify-center rounded-md text-[#aab4aa] transition-colors hover:bg-black/10 hover:text-[#bd5b45] disabled:opacity-50"><Trash2 className="size-3.5" /></button> : <span className="size-6 shrink-0" />}
            </div>
            <ChevronDown className="size-4 shrink-0 text-[#aab4aa] transition-transform group-hover:translate-y-0.5" />
          </div> : <div className="col-span-2 flex min-w-0 items-center gap-3">
            <div className="w-[22rem] min-w-0 max-w-[22rem] shrink" role="progressbar" aria-label={`${plant.name} moisture level`} aria-valuemin={plant.minWeight} aria-valuemax={plant.maxWeight} aria-valuenow={current} aria-valuetext={`${percentage}% from dry weight`}>
              <div className="mb-1 flex justify-between text-xs font-semibold leading-none text-white/80"><span>{plant.minWeight.toLocaleString()}g</span><span>{percentage}%</span><span>{plant.maxWeight.toLocaleString()}g</span></div>
              <div className="h-2.5 overflow-hidden rounded-full bg-black/20"><div className="h-full rounded-full bg-[#dfe9d7] transition-[width]" style={{ width: `${percentage}%` }} /></div>
            </div>
            <div className="min-h-px min-w-0 flex-1" />
            <form onSubmit={saveWeight} onClick={(event) => event.stopPropagation()} onKeyDown={(event) => event.stopPropagation()} className="flex w-20 shrink-0 items-center gap-1"><Input type="text" inputMode="decimal" value={weight} onChange={(event) => setWeight(event.target.value)} onKeyDown={moveToWeightInput} data-weight-input aria-label={`Enter current weight for ${plant.name}`} placeholder="g" className="h-8 w-full border-white/50 bg-black/20 px-2 text-sm text-white placeholder:text-white/70" disabled={isSavingWeight} /><button type="submit" className="sr-only">Save weight</button>{weightError ? <span className="text-xs text-white" role="alert">{weightError}</span> : null}</form>
            <div className="flex shrink-0 items-center gap-0.5">
              <div className="w-[6.5rem] shrink-0 text-left tabular-nums"><p className="whitespace-nowrap font-heading text-xl font-bold tracking-tight text-[#1f3428]">{current.toLocaleString()}<span className="ml-1 text-sm font-bold text-white">g</span></p><p className="whitespace-nowrap text-xs font-bold tracking-[0.08em] text-white">{formatDaysAgo(latestMeasuredDate(plant.history))}</p></div>
              {plant.history.some((entry) => entry.weight !== null) ? <button type="button" aria-label={`Remove latest weight for ${plant.name}`} title="Remove latest weight" onClick={removeLatestWeight} onKeyDown={(event) => event.stopPropagation()} disabled={isRemovingWeight} className="flex size-6 shrink-0 items-center justify-center rounded-md text-[#aab4aa] transition-colors hover:bg-black/10 hover:text-[#bd5b45] disabled:opacity-50"><Trash2 className="size-3.5" /></button> : <span className="size-6 shrink-0" />}
            </div>
            <ChevronDown className="size-4 shrink-0 text-[#aab4aa] transition-transform group-hover:translate-y-0.5" />
          </div>}
        </div>
      </DialogTrigger>
      <PlantHistory plant={plant} percentage={getMoisture(plant).percentage} onUpdated={onUpdated} onEstimateUpdated={onEstimateUpdated} onWeightAdded={onWeightAdded} onDeleted={onDeleted ?? (() => window.location.reload())} onNameUpdated={onNameUpdated ?? (() => window.location.reload())} />
    </Dialog>
  )
}

function CreatePlantDialog({ onCreated }: { onCreated: (plant: Plant) => void }) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState("")
  const [minWeight, setMinWeight] = useState("")
  const [maxWeight, setMaxWeight] = useState("")
  const [interval, setInterval] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  const reset = () => {
    setName("")
    setMinWeight("")
    setMaxWeight("")
    setInterval("")
    setError(null)
  }

  useEffect(() => {
    const addButton = document.querySelector('main button[aria-label="Add plant"]')
    if (!addButton) return
    const openDialog = () => setOpen(true)
    addButton.addEventListener("click", openDialog)
    return () => addButton.removeEventListener("click", openDialog)
  }, [])

  const createPlant = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)
    setIsSaving(true)
    try {
      const response = await fetch("/api/plants", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, minWeight, maxWeight, intervalDays: interval }),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error ?? "Could not create plant.")
      onCreated(result.plant)
      reset()
      setOpen(false)
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "Could not create plant.")
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => { setOpen(nextOpen); if (!nextOpen) reset() }}>
      <DialogContent className="border-[#d8dfd5] bg-[#fbfcf8] sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-[#1f3428]">Add a plant</DialogTitle>
          <DialogDescription>Add a plant to your collection and set its moisture thresholds.</DialogDescription>
        </DialogHeader>
        <form onSubmit={createPlant} className="space-y-4">
          <label className="block text-sm font-medium text-[#315d42]" htmlFor="plant-name">Name<Input id="plant-name" required value={name} onChange={(event) => setName(event.target.value)} className="mt-1.5 border-[#cbdac8] bg-white" /></label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block text-sm font-medium text-[#315d42]" htmlFor="plant-min-weight">Dry weight (g)<Input id="plant-min-weight" type="number" min="0" step="0.1" value={minWeight} onChange={(event) => setMinWeight(event.target.value)} placeholder="Optional" className="mt-1.5 border-[#cbdac8] bg-white" /></label>
            <label className="block text-sm font-medium text-[#315d42]" htmlFor="plant-max-weight">Full weight (g)<Input id="plant-max-weight" type="number" min="0" step="0.1" value={maxWeight} onChange={(event) => setMaxWeight(event.target.value)} placeholder="Optional" className="mt-1.5 border-[#cbdac8] bg-white" /></label>
          </div>
          <label className="block text-sm font-medium text-[#315d42]" htmlFor="plant-interval">Days between waterings<Input id="plant-interval" type="number" min="1" max="365" step="1" value={interval} onChange={(event) => setInterval(event.target.value)} placeholder="Optional" className="mt-1.5 border-[#cbdac8] bg-white" /></label>
          {error ? <p className="text-sm text-[#bd5b45]" role="alert">{error}</p> : null}
          <div className="flex justify-end gap-2">
            <DialogClose asChild><Button type="button" variant="outline">Cancel</Button></DialogClose>
            <Button type="submit" disabled={isSaving}>{isSaving ? "Adding..." : "Add plant"}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function AdminAccess() {
  const [open, setOpen] = useState(false)
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const authenticate = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)
    setIsSubmitting(true)
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error ?? "Could not sign in.")
      setIsAuthenticated(true)
      setPassword("")
      setOpen(false)
    } catch (loginError) {
      setError(loginError instanceof Error ? loginError.message : "Could not sign in.")
    } finally {
      setIsSubmitting(false)
    }
  }

  const logout = async () => {
    await fetch("/api/auth/logout", { method: "POST" })
    setIsAuthenticated(false)
  }

  if (isAuthenticated) {
    return <Button variant="ghost" size="icon" aria-label="Sign out" onClick={logout} className="text-[#55705a] hover:bg-[#eef3eb]"><LogIn className="size-4" /></Button>
  }

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => { setOpen(nextOpen); if (!nextOpen) setError(null) }}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Sign in to edit plants" className="text-[#55705a] hover:bg-[#eef3eb]"><LogIn className="size-4" /></Button>
      </DialogTrigger>
      <DialogContent className="border-[#d8dfd5] bg-[#fbfcf8] sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-[#1f3428]">Admin sign in</DialogTitle>
          <DialogDescription>Sign in to add plants, record measurements, and change schedules.</DialogDescription>
        </DialogHeader>
        <form onSubmit={authenticate} className="space-y-4">
          <label className="block text-sm font-medium text-[#315d42]" htmlFor="admin-password">
            Password
            <Input id="admin-password" type="password" autoFocus required value={password} onChange={(event) => setPassword(event.target.value)} className="mt-1.5 border-[#cbdac8] bg-white" />
          </label>
          {error ? <p className="text-sm text-[#bd5b45]" role="alert">{error}</p> : null}
          <div className="flex justify-end">
            <Button type="submit" disabled={isSubmitting}>{isSubmitting ? "Signing in..." : "Sign in"}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

import { setSeasonSetting } from "@/app/actions"

export default function PlantDashboard({ plants, groupDates, lastUpdated, initialSeason }: { plants: Plant[]; groupDates: PersistedGroupDate[]; lastUpdated: string; initialSeason: "summer" | "winter" }) {
  const [plantList, setPlantList] = useState(plants)
  const [query, setQuery] = useState("")
  const needsAttention = plantList.filter((plant) => getMoisture(plant).percentage < 50).length

  const addWeight = (plantId: number, date: string, weight: number) => {
    setPlantList((current) => current.map((plant) => {
      if (plant.id !== plantId) return plant
      const dateLabel = new Date(date).toLocaleDateString("en-US", { month: "short", day: "2-digit", timeZone: "UTC" })
      const history = plant.history.some((entry) => entry.date === dateLabel)
        ? plant.history.map((entry) => entry.date === dateLabel ? { ...entry, weight } : entry)
        : [...plant.history, { date: dateLabel, weight }]
      history.sort((firstEntry, secondEntry) => new Date(`${firstEntry.date}, ${new Date().getUTCFullYear()}`).getTime() - new Date(`${secondEntry.date}, ${new Date().getUTCFullYear()}`).getTime())
      return { ...plant, history }
    }))
  }

  const removeWeight = (plantId: number, date: string) => {
    const dateLabel = new Date(date).toLocaleDateString("en-US", { month: "short", day: "2-digit", timeZone: "UTC" })
    setPlantList((current) => current.map((plant) => plant.id === plantId ? { ...plant, history: plant.history.filter((entry) => entry.date !== dateLabel) } : plant))
  }

  const waterGroup = async (plantId: number, season: "summer" | "winter") => {
    const response = await fetch(`/api/plants/${plantId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "water", season }),
    })
    const result = await response.json()
    if (!response.ok) throw new Error(result.error ?? "Could not record watering.")
    return result.date as string
  }

  const saveLastWatered = async (plantId: number | null, season: "summer" | "winter", date: string | null, groupKey?: string) => {
    const response = await fetch(plantId === null ? "/api/plants" : `/api/plants/${plantId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "setLastWatered", season, date, ...(groupKey ? { groupKey } : {}) }),
    })
    const result = await response.json()
    if (!response.ok) throw new Error(result.error ?? "Could not save watering date.")
    return result.date as string | null
  }

  return (
    <main className="report-shell min-h-screen bg-[#0f1013] text-[#e7e9ed]">
      <CreatePlantDialog onCreated={(plant) => setPlantList((current) => [plant, ...current])} />
      <div className="mx-auto flex min-h-screen max-w-[1200px] flex-col bg-[#21242c] shadow-[0_0_80px_rgba(0,0,0,0.24)]">
        <header className="flex items-center justify-between border-b border-[#e0e6dd] px-5 py-4 sm:px-10 lg:px-14"><div className="flex items-center gap-3"><div className="flex size-9 items-center justify-center rounded-xl bg-[#315d42] text-[#e8f2e0]"><Droplets className="size-4" /></div><span className="font-heading text-lg font-semibold tracking-tight">verdant</span></div><div className="flex items-center gap-2"><span className="hidden text-xs text-[#78847a] sm:inline">Last measurement {lastUpdated}</span><AdminAccess /></div></header>
        <section className="border-b border-[#e0e6dd] px-5 pb-10 pt-10 sm:px-10 lg:px-14 lg:pb-12 lg:pt-14"><div className="flex flex-col justify-between gap-7 lg:flex-row lg:items-end"><div><p className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-[#6f896f]"><SunMedium className="size-3.5" /> {lastUpdated}</p><h1 className="max-w-xl font-heading text-4xl font-semibold tracking-[-0.04em] text-[#1f3428] sm:text-5xl">A little care goes a long way.</h1><p className="mt-4 max-w-lg text-sm leading-6 text-[#78847a]">Keep an eye on the quiet signals. Your plants are telling you when it is time for a drink.</p></div><div className="flex shrink-0 gap-8 border-l border-[#d8dfd5] pl-6"><div><p className="text-3xl font-semibold tracking-tight text-[#315d42]">{plantList.length}</p><p className="mt-1 text-xs text-[#78847a]">plants tracked</p></div><div><p className="flex items-center gap-1 text-3xl font-semibold tracking-tight text-[#bd5b45]">{needsAttention}<ArrowDownRight className="size-5" /></p><p className="mt-1 text-xs text-[#78847a]">need attention</p></div></div></div></section>
        <section className="flex-1 px-5 py-7 sm:px-10 lg:px-14 lg:py-9"><div className="mb-7"><h2 className="font-heading text-2xl font-semibold tracking-tight">Your collection</h2><p className="mt-1 text-sm text-[#78847a]">Tap a group to see its plants.</p></div><WateringSchedule plants={plantList} groupDates={groupDates} query={query} initialSeason={initialSeason} onQueryChange={setQuery} onSeasonChanged={setSeasonSetting} onGroupWatered={waterGroup} onLastWateredChanged={saveLastWatered} onPlantUpdated={(plantId, season, nextGroup, wateringInterval) => setPlantList((current) => current.map((plant) => {
          if (plant.id !== plantId) return plant
          if (season === "winter") return { ...plant, winterGroup: nextGroup, winterWateringInterval: wateringInterval }
          return { ...plant, group: nextGroup, wateringInterval, room: wateringInterval ? `Every ${wateringInterval} days` : "No schedule" }
        }))} onEstimatedUpdated={(plantId, interval) => setPlantList((current) => current.map((plant) => plant.id === plantId ? { ...plant, estimatedWateringInterval: interval } : plant))} onWeightAdded={addWeight} onWeightRemoved={removeWeight} /></section>
        <footer className="flex flex-col justify-between gap-3 border-t border-[#e0e6dd] px-5 py-5 text-xs text-[#8b968d] sm:flex-row sm:px-10 lg:px-14"><p className="flex items-center gap-2"><CalendarDays className="size-3.5" /> Weight history is your most reliable watering signal.</p><p className="flex items-center gap-1 text-[#6f896f]"><ArrowUpRight className="size-3.5" /> All systems growing</p></footer>
      </div>
    </main>
  )
}
// #21242c
