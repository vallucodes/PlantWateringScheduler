"use client"

import { useEffect, useMemo, useState } from "react"
import {
  ArrowDownRight,
  ArrowUpRight,
  CalendarDays,
  ChevronDown,
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
  ReferenceArea,
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
  id: string
  name: string
  group: string
  wateringInterval: number | null
  lastWatered: string | null
  room: string
  minWeight: number
  maxWeight: number
  history: { date: string; weight: number | null }[]
}

const scheduleGroups = [
  { name: "20-31", lastWatered: "07.09", intervalStart: 20, intervalEnd: 31 },
  { name: "20", lastWatered: "07.09", intervalStart: 20, intervalEnd: 20 },
  { name: "14", lastWatered: "07.09", intervalStart: 14, intervalEnd: 14 },
  { name: "9", lastWatered: "10.09", intervalStart: 9, intervalEnd: 9 },
  { name: "7", lastWatered: "17.09", intervalStart: 7, intervalEnd: 7 },
  { name: "5", lastWatered: "14.09", intervalStart: 5, intervalEnd: 5 },
  { name: "2", lastWatered: "23.09", intervalStart: 2, intervalEnd: 2 },
  { name: "Unassigned", lastWatered: null, intervalStart: null, intervalEnd: null },
]

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

function parseScheduleDate(value: string) {
  const [day, month] = value.split(".").map(Number)
  return new Date(Date.UTC(2026, month - 1, day))
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

function WateringSchedule() {
  const [lastWateredDates, setLastWateredDates] = useState<Record<string, Date | null>>(
    () => Object.fromEntries(scheduleGroups.map((group) => [group.name, group.lastWatered ? parseScheduleDate(group.lastWatered) : null])),
  )
  const [season, setSeason] = useState<"summer" | "winter">("summer")
  const intervalMultiplier = season === "winter" ? 2 : 1

  const updateLastWatered = (groupName: string, date: Date | null) => {
    setLastWateredDates((current) => ({ ...current, [groupName]: date }))
  }

  const rows = scheduleGroups.map((group) => {
    const lastWateredDate = lastWateredDates[group.name]

    const nextWateringDates = lastWateredDate && group.intervalStart !== null && group.intervalEnd !== null
      ? group.intervalStart === group.intervalEnd
        ? [addDays(lastWateredDate, group.intervalStart * intervalMultiplier)]
        : [addDays(lastWateredDate, group.intervalStart * intervalMultiplier), addDays(lastWateredDate, group.intervalEnd * intervalMultiplier)]
      : []

    return {
      group: group.name,
      lastWatered: group.lastWatered,
      nextWateringDates,
    }
  })

  return (
    <div className="mt-9 overflow-hidden border-y border-[#d8dfd5]">
      <div className="grid grid-cols-[minmax(7rem,1.1fr)_minmax(8rem,1fr)_minmax(8rem,1.2fr)] items-center gap-4 border-b border-[#e0e6dd] px-1 py-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#9aa39b] sm:grid-cols-[minmax(8rem,1.1fr)_minmax(8rem,1fr)_minmax(10rem,1.2fr)]">
        <span>Watering group</span>
        <span>Last watered</span>
        <span>Next watering</span>
      </div>
      {rows.map((row) => (
        <div key={row.group} className="grid grid-cols-[minmax(7rem,1.1fr)_minmax(8rem,1fr)_minmax(8rem,1.2fr)] items-center gap-4 border-b border-[#e8ede6] px-1 py-3.5 text-sm last:border-b-0 sm:grid-cols-[minmax(8rem,1.1fr)_minmax(8rem,1fr)_minmax(10rem,1.2fr)]">
          <div>
            <p className="font-medium text-[#315d42]">{row.group}</p>
            <p className="mt-0.5 text-xs text-[#9aa39b]">{row.group === "Unassigned" ? "No interval" : `${row.group} days`}</p>
          </div>
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <div className="flex min-w-0 items-center gap-1.5">
              {row.lastWatered ? (
                <span className="relative inline-flex size-5 items-center justify-center text-[#55705a]" title={`Set last watered date for ${row.group}`}>
                  <CalendarDays className="size-4" aria-hidden="true" />
                  <input
                    type="date"
                    value={dateInputValue(lastWateredDates[row.group])}
                    onChange={(event) => updateLastWatered(row.group, parseInputDate(event.target.value))}
                    aria-label={`Set last watered date for ${row.group}`}
                    className="absolute inset-0 cursor-pointer opacity-0"
                  />
                </span>
              ) : null}
              <span className="text-[#78847a]">{row.lastWatered ? formatScheduleDate(lastWateredDates[row.group] as Date) : "Not recorded"}</span>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => updateLastWatered(row.group, new Date(Date.UTC(new Date().getFullYear(), new Date().getMonth(), new Date().getDate())))}
              className="h-7 border-[#cbdac8] px-2 text-xs text-[#315d42] hover:bg-[#eef3eb]"
            >
              Water now
            </Button>
          </div>
          {row.nextWateringDates.length > 0 ? (
            <span className="font-medium text-[#1f3428]">
              {row.nextWateringDates.map((date, index) => (
                <span key={date.toISOString()} className="block">
                  {index > 0 && <span className="mr-1 text-[#9aa39b]">-</span>}
                  {formatScheduleDate(date)} <strong className="font-bold text-[#315d42]">({daysFromToday(date) > 0 ? "+" : ""}{daysFromToday(date)} days)</strong>
                </span>
              ))}
            </span>
          ) : (
            <span className="font-medium text-[#1f3428]">Not recorded</span>
          )}
        </div>
      ))}
      <div className="flex items-center justify-between gap-3 border-t border-[#d8dfd5] px-1 py-3">
        <span className="text-xs text-[#78847a]">Watering season</span>
        <button
          type="button"
          role="switch"
          aria-checked={season === "winter"}
          onClick={() => setSeason((current) => current === "summer" ? "winter" : "summer")}
          className="flex items-center gap-2 rounded-md border border-[#d8dfd5] px-2.5 py-1.5 text-xs font-medium text-[#55705a] transition-colors hover:bg-[#eef3eb]"
        >
          {season === "summer" ? <SunMedium className="size-3.5" /> : <Snowflake className="size-3.5" />}
          {season === "summer" ? "Summer" : "Winter (2x interval)"}
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

function statusFor(percentage: number) {
  if (percentage < 20) return { label: "Needs water", tone: "danger" }
  if (percentage < 50) return { label: "Watch closely", tone: "warning" }
  return { label: "Looking good", tone: "healthy" }
}

function PlantHistory({ plant, percentage, onUpdated, onDeleted, onNameUpdated }: { plant: Plant; percentage: number; onUpdated: (group: string, wateringInterval: number | null) => void; onDeleted: () => void; onNameUpdated: (name: string) => void }) {
  const [range, setRange] = useState({ startIndex: 0, endIndex: Math.max(0, plant.history.length - 1) })
  const [selectionStart, setSelectionStart] = useState<number | null>(null)
  const [selectionEnd, setSelectionEnd] = useState<number | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const visibleHistory = plant.history.slice(range.startIndex, range.endIndex + 1)
  const visibleWeights = visibleHistory.flatMap((entry) => entry.weight === null ? [] : [entry.weight])
  const dataMin = Math.min(plant.minWeight, ...visibleWeights)
  const dataMax = Math.max(plant.maxWeight, ...visibleWeights)
  const yAxisPadding = Math.max(10, (dataMax - dataMin) * 0.05)
  const yAxisDomain: [number, number] = [dataMin - yAxisPadding, dataMax + yAxisPadding]
  const selectedStart = selectionStart !== null && selectionEnd !== null ? Math.min(selectionStart, selectionEnd) : range.startIndex
  const selectedEnd = selectionStart !== null && selectionEnd !== null ? Math.max(selectionStart, selectionEnd) : range.endIndex
  const selectedDates = plant.history.length > 0 ? `${plant.history[selectedStart].date} - ${plant.history[selectedEnd].date}` : "No dates"

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
    if (selectionStart !== null && selectionEnd !== null && selectionStart !== selectionEnd) {
      setRange({ startIndex: Math.min(selectionStart, selectionEnd), endIndex: Math.max(selectionStart, selectionEnd) })
    }
    setSelectionStart(null)
    setSelectionEnd(null)
  }

  const resetRange = () => {
    const fullRange = { startIndex: 0, endIndex: Math.max(0, plant.history.length - 1) }
    setRange(fullRange)
    setSelectionStart(null)
    setSelectionEnd(null)
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
        <PlantScheduleEditor plant={plant} onUpdated={onUpdated} />
        <div className="mb-5 grid grid-cols-3 gap-2 text-center">
          <div className="rounded-md bg-[#f0f4ed] px-2 py-3"><p className="text-[10px] uppercase tracking-[0.12em] text-[#889488]">Current</p><p className="mt-1 font-semibold text-[#315d42]">{getMoisture(plant).current}g</p></div>
          <div className="rounded-md bg-[#f0f4ed] px-2 py-3"><p className="text-[10px] uppercase tracking-[0.12em] text-[#889488]">Dry line</p><p className="mt-1 font-semibold text-[#bd5b45]">{plant.minWeight}g</p></div>
          <div className="rounded-md bg-[#f0f4ed] px-2 py-3"><p className="text-[10px] uppercase tracking-[0.12em] text-[#889488]">Range left</p><p className="mt-1 font-semibold text-[#a4772b]">{percentage}%</p></div>
        </div>
        <div className="mb-2 flex items-center justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.12em] text-[#889488]">History window</p>
            <p className="mt-1 text-xs text-[#78847a]">{selectedDates}</p>
          </div>
          <button type="button" onClick={resetRange} aria-label="Show full weight history" className="rounded-md p-1.5 text-[#78847a] transition-colors hover:bg-[#eef3eb] hover:text-[#315d42]">
            <RotateCcw className="size-3.5" />
          </button>
        </div>
        <ChartContainer config={{ weight: { label: "Weight", color: "#467555" } }} className="h-[260px] w-full">
          <LineChart data={visibleHistory} margin={{ top: 10, right: 12, left: 0, bottom: 0 }} onMouseDown={handleChartMouseDown} onMouseMove={handleChartMouseMove} onMouseUp={handleChartMouseUp} onMouseLeave={handleChartMouseUp}>
            <CartesianGrid vertical={false} stroke="#e2e8df" />
            <XAxis dataKey="date" axisLine={false} tickLine={false} tickMargin={10} />
            <YAxis domain={yAxisDomain} axisLine={false} tickLine={false} tickMargin={8} />
            <Tooltip contentStyle={{ borderRadius: 8, borderColor: "#d8dfd5", backgroundColor: "#fbfcf8" }} formatter={(value) => [`${value}g`, "Weight"]} />
            {selectedStart !== selectedEnd && <ReferenceArea x1={plant.history[selectedStart].date} x2={plant.history[selectedEnd].date} fill="#9fbaa0" fillOpacity={0.28} stroke="#467555" strokeOpacity={0.6} />}
            <ReferenceLine y={plant.minWeight} stroke="#cf7459" strokeDasharray="4 4" label={{ value: "dry", position: "insideTopRight", fill: "#bd5b45", fontSize: 11 }} />
            <ReferenceLine y={plant.maxWeight} stroke="#6f9d78" strokeDasharray="4 4" label={{ value: "full", position: "insideBottomRight", fill: "#467555", fontSize: 11 }} />
            <Line type="monotone" dataKey="weight" connectNulls={false} isAnimationActive={false} stroke="#467555" strokeWidth={3} dot={{ fill: "#fbfcf8", stroke: "#467555", strokeWidth: 2, r: 4 }} activeDot={{ r: 6 }} />
          </LineChart>
        </ChartContainer>
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

function PlantScheduleEditor({ plant, onUpdated }: { plant: Plant; onUpdated: (group: string, wateringInterval: number | null) => void }) {
  const [open, setOpen] = useState(false)
  const [interval, setInterval] = useState(plant.wateringInterval?.toString() ?? "")
  const [error, setError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  const saveSchedule = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)
    setIsSaving(true)

    const intervalDays = interval.trim() === "" ? null : Number(interval)
    if (intervalDays !== null && (!Number.isInteger(intervalDays) || intervalDays < 1 || intervalDays > 365)) {
      setError("Enter a whole number from 1 to 365, or leave it empty.")
      setIsSaving(false)
      return
    }

    try {
      const response = await fetch(`/api/plants/${plant.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ intervalDays }),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error ?? "Could not update schedule.")

      setInterval(intervalDays?.toString() ?? "")
      onUpdated(result.group, result.wateringInterval)
      setOpen(false)
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Could not update schedule.")
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
          <DialogTitle className="text-[#1f3428]">Modify watering group</DialogTitle>
          <DialogDescription>Set how many days should pass between waterings for {plant.name}.</DialogDescription>
        </DialogHeader>
        <form onSubmit={saveSchedule} className="space-y-4">
          <label className="block text-sm font-medium text-[#315d42]" htmlFor={`watering-interval-${plant.id}`}>
            Days between waterings
            <Input
              id={`watering-interval-${plant.id}`}
              type="number"
              min="1"
              max="365"
              step="1"
              value={interval}
              onChange={(event) => setInterval(event.target.value)}
              placeholder="Leave empty for no schedule"
              className="mt-1.5 border-[#cbdac8] bg-white"
            />
          </label>
          {error ? <p className="text-sm text-[#bd5b45]" role="alert">{error}</p> : null}
          <div className="flex justify-end gap-2">
            <DialogClose asChild>
              <Button type="button" variant="outline">Cancel</Button>
            </DialogClose>
            <Button type="submit" disabled={isSaving}>{isSaving ? "Saving..." : "Save group"}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function PlantCard({ plant, onUpdated, onDeleted, onNameUpdated }: { plant: Plant; onUpdated: (group: string, wateringInterval: number | null) => void; onDeleted?: () => void; onNameUpdated?: (name: string) => void }) {
  const { current, percentage } = getMoisture(plant)
  const status = statusFor(percentage)
  const statusColor = status.tone === "danger" ? "text-[#bd5b45]" : status.tone === "warning" ? "text-[#a4772b]" : "text-[#467555]"
  const barColor = status.tone === "danger" ? "bg-[#cf7459]" : status.tone === "warning" ? "bg-[#d2a34a]" : "bg-[#6f9d78]"

  return (
    <Dialog>
      <DialogTrigger asChild>
        <button className="group grid w-full gap-4 border-t border-[#e4e9e1] px-1 py-4 text-left transition-colors hover:bg-[#f6f8f3] sm:grid-cols-[minmax(13rem,1.25fr)_minmax(12rem,1fr)_minmax(7rem,auto)] sm:items-center sm:px-4">
          <div className="flex min-w-0 items-center gap-3"><div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[#dfe9d7] text-[#315d42]"><Sprout className="size-4" /></div><div className="min-w-0"><p className="truncate font-semibold text-[#1f3428]">{plant.name}</p><p className="mt-0.5 text-xs text-[#78847a]">{plant.room}</p></div></div>
          <div className="min-w-0"><div className="mb-1.5 flex items-center justify-between gap-3 text-xs"><span className={`font-medium ${statusColor}`}>{status.label}</span><span className="shrink-0 text-[#78847a]">{percentage}% of range</span></div><div className="h-2 overflow-hidden rounded-full bg-[#e7ece4]"><div className={`h-full rounded-full transition-all ${barColor}`} style={{ width: `${percentage}%` }} /></div></div>
          <div className="flex items-center justify-between gap-3 sm:justify-end"><div className="text-left sm:text-right"><p className="font-heading text-xl font-semibold tracking-tight text-[#1f3428]">{current.toLocaleString()}<span className="ml-1 text-xs font-normal text-[#78847a]">g</span></p><p className="text-[10px] uppercase tracking-[0.12em] text-[#9aa39b]">last weight</p></div><ChevronDown className="size-4 shrink-0 text-[#aab4aa] transition-transform group-hover:translate-y-0.5" /></div>
        </button>
      </DialogTrigger>
      <PlantHistory plant={plant} percentage={percentage} onUpdated={onUpdated} onDeleted={onDeleted ?? (() => window.location.reload())} onNameUpdated={onNameUpdated ?? (() => window.location.reload())} />
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

export default function PlantDashboard({ plants, lastUpdated }: { plants: Plant[]; lastUpdated: string }) {
  const [plantList, setPlantList] = useState(plants)
  const [query, setQuery] = useState("")
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({})
  const groupedPlants = useMemo(() => {
    const search = query.toLowerCase()
    const matchingPlants = plantList.filter((plant) => plant.name.toLowerCase().includes(search))
    return Array.from(new Set(matchingPlants.map((plant) => plant.group))).map((group) => ({
      group,
      plants: matchingPlants.filter((plant) => plant.group === group),
    }))
  }, [plantList, query])
  const needsAttention = plantList.filter((plant) => getMoisture(plant).percentage < 50).length

  return (
    <main className="report-shell min-h-screen bg-[#0f1013] text-[#e7e9ed]">
      <CreatePlantDialog onCreated={(plant) => setPlantList((current) => [plant, ...current])} />
      <div className="mx-auto flex min-h-screen max-w-[1440px] flex-col bg-[#111318] shadow-[0_0_80px_rgba(0,0,0,0.24)]">
        <header className="flex items-center justify-between border-b border-[#e0e6dd] px-5 py-4 sm:px-10 lg:px-14"><div className="flex items-center gap-3"><div className="flex size-9 items-center justify-center rounded-xl bg-[#315d42] text-[#e8f2e0]"><Droplets className="size-4" /></div><span className="font-heading text-lg font-semibold tracking-tight">verdant</span></div><div className="flex items-center gap-2"><span className="hidden text-xs text-[#78847a] sm:inline">Last measurement {lastUpdated}</span><Button variant="ghost" size="icon" aria-label="Sign in" className="text-[#55705a] hover:bg-[#eef3eb]"><LogIn className="size-4" /></Button></div></header>
        <section className="border-b border-[#e0e6dd] px-5 pb-10 pt-10 sm:px-10 lg:px-14 lg:pb-12 lg:pt-14"><div className="flex flex-col justify-between gap-7 lg:flex-row lg:items-end"><div><p className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-[#6f896f]"><SunMedium className="size-3.5" /> {lastUpdated}</p><h1 className="max-w-xl font-heading text-4xl font-semibold tracking-[-0.04em] text-[#1f3428] sm:text-5xl">A little care goes a long way.</h1><p className="mt-4 max-w-lg text-sm leading-6 text-[#78847a]">Keep an eye on the quiet signals. Your plants are telling you when it is time for a drink.</p></div><div className="flex shrink-0 gap-8 border-l border-[#d8dfd5] pl-6"><div><p className="text-3xl font-semibold tracking-tight text-[#315d42]">{plantList.length}</p><p className="mt-1 text-xs text-[#78847a]">plants tracked</p></div><div><p className="flex items-center gap-1 text-3xl font-semibold tracking-tight text-[#bd5b45]">{needsAttention}<ArrowDownRight className="size-5" /></p><p className="mt-1 text-xs text-[#78847a]">need attention</p></div></div></div><WateringSchedule /></section>
        <section className="flex-1 px-5 py-7 sm:px-10 lg:px-14 lg:py-9"><div className="mb-7 flex flex-col justify-between gap-4 md:flex-row md:items-center"><div><h2 className="font-heading text-2xl font-semibold tracking-tight">Your collection</h2><p className="mt-1 text-sm text-[#78847a]">Tap a plant to see its weight story.</p></div><div className="flex items-center gap-2"><div className="relative"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#9aa39b]" /><Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search plants" className="h-9 w-full border-[#d8dfd5] bg-[#f7f9f5] pl-9 text-sm md:w-44" />{query && <button aria-label="Clear search" onClick={() => setQuery("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-[#9aa39b]"><X className="size-3.5" /></button>}</div><Button variant="outline" size="icon" aria-label="Add plant" className="h-9 w-9 border-[#d8dfd5] text-[#315d42]"><Plus className="size-4" /></Button></div></div>{groupedPlants.length > 0 ? <div className="overflow-hidden border-y border-[#d8dfd5]">{groupedPlants.map(({ group, plants: groupPlants }) => { const isExpanded = expandedGroups[group] ?? true; return <div key={group} className="border-b border-[#d8dfd5] last:border-b-0"><button type="button" onClick={() => setExpandedGroups((current) => ({ ...current, [group]: !isExpanded }))} aria-expanded={isExpanded} className="flex w-full items-center justify-between gap-4 bg-[#f4f7f1] px-1 py-3 text-left transition-colors hover:bg-[#edf3e9] sm:px-4"><span className="flex min-w-0 items-center gap-2"><span className="text-sm font-semibold text-[#315d42]">{group}</span><span className="text-xs text-[#9aa39b]">{groupPlants.length} {groupPlants.length === 1 ? "plant" : "plants"}</span></span><ChevronDown className={`size-4 shrink-0 text-[#55705a] transition-transform ${isExpanded ? "" : "-rotate-90"}`} /></button>{isExpanded ? <div>{groupPlants.map((plant) => <PlantCard key={plant.id} plant={plant} onUpdated={(nextGroup, wateringInterval) => setPlantList((current) => current.map((currentPlant) => currentPlant.id === plant.id ? { ...currentPlant, group: nextGroup, wateringInterval, room: wateringInterval ? `Every ${wateringInterval} days` : "No schedule" } : currentPlant))} />)}</div> : null}</div>})}</div> : <div className="py-16 text-center"><p className="font-heading text-lg font-semibold">No plants found</p><p className="mt-1 text-sm text-[#78847a]">Try a different search or collection.</p></div>}</section>
        <footer className="flex flex-col justify-between gap-3 border-t border-[#e0e6dd] px-5 py-5 text-xs text-[#8b968d] sm:flex-row sm:px-10 lg:px-14"><p className="flex items-center gap-2"><CalendarDays className="size-3.5" /> Weight history is your most reliable watering signal.</p><p className="flex items-center gap-1 text-[#6f896f]"><ArrowUpRight className="size-3.5" /> All systems growing</p></footer>
      </div>
    </main>
  )
}
