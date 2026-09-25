"use client"

import { useMemo, useState } from "react"
import {
  ArrowDownRight,
  ArrowUpRight,
  CalendarDays,
  ChevronRight,
  Droplets,
  Leaf,
  LogIn,
  Plus,
  Search,
  Sprout,
  SunMedium,
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
  species: string
  group: string
  room: string
  minWeight: number
  maxWeight: number
  history: { date: string; weight: number }[]
}

function getMoisture(plant: Plant) {
  const current = plant.history.at(-1)?.weight ?? plant.minWeight
  const range = plant.maxWeight - plant.minWeight
  const percentage = range > 0 ? Math.round(((current - plant.minWeight) / range) * 100) : 0
  return { current, percentage: Math.min(100, Math.max(0, percentage)) }
}

function statusFor(percentage: number) {
  if (percentage < 20) return { label: "Needs water", tone: "danger" }
  if (percentage < 50) return { label: "Watch closely", tone: "warning" }
  return { label: "Looking good", tone: "healthy" }
}

function PlantHistory({ plant, percentage }: { plant: Plant; percentage: number }) {
  return (
    <DialogContent className="max-w-2xl border-[#d8dfd5] bg-[#fbfcf8] p-0">
      <DialogHeader className="border-b border-[#e4e9e1] px-6 py-5">
        <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.16em] text-[#6f896f]"><Leaf className="size-3.5" /> {plant.group}</div>
        <DialogTitle className="font-heading text-2xl text-[#1f3428]">{plant.name}</DialogTitle>
        <DialogDescription>Weight history against your dry and fully-watered thresholds.</DialogDescription>
      </DialogHeader>
      <div className="px-6 pb-6 pt-5">
        <div className="mb-5 grid grid-cols-3 gap-2 text-center">
          <div className="rounded-md bg-[#f0f4ed] px-2 py-3"><p className="text-[10px] uppercase tracking-[0.12em] text-[#889488]">Current</p><p className="mt-1 font-semibold text-[#315d42]">{plant.history.at(-1)?.weight}g</p></div>
          <div className="rounded-md bg-[#f0f4ed] px-2 py-3"><p className="text-[10px] uppercase tracking-[0.12em] text-[#889488]">Dry line</p><p className="mt-1 font-semibold text-[#bd5b45]">{plant.minWeight}g</p></div>
          <div className="rounded-md bg-[#f0f4ed] px-2 py-3"><p className="text-[10px] uppercase tracking-[0.12em] text-[#889488]">Range left</p><p className="mt-1 font-semibold text-[#a4772b]">{percentage}%</p></div>
        </div>
        <ChartContainer config={{ weight: { label: "Weight", color: "#467555" } }} className="h-[260px] w-full">
          <LineChart data={plant.history} margin={{ top: 10, right: 12, left: -18, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke="#e2e8df" />
            <XAxis dataKey="date" axisLine={false} tickLine={false} tickMargin={10} />
            <YAxis domain={[plant.minWeight - 100, plant.maxWeight + 100]} axisLine={false} tickLine={false} tickMargin={8} />
            <Tooltip contentStyle={{ borderRadius: 8, borderColor: "#d8dfd5", backgroundColor: "#fbfcf8" }} formatter={(value) => [`${value}g`, "Weight"]} />
            <ReferenceLine y={plant.minWeight} stroke="#cf7459" strokeDasharray="4 4" label={{ value: "dry", position: "insideTopRight", fill: "#bd5b45", fontSize: 11 }} />
            <ReferenceLine y={plant.maxWeight} stroke="#6f9d78" strokeDasharray="4 4" label={{ value: "full", position: "insideBottomRight", fill: "#467555", fontSize: 11 }} />
            <Line type="monotone" dataKey="weight" stroke="#467555" strokeWidth={3} dot={{ fill: "#fbfcf8", stroke: "#467555", strokeWidth: 2, r: 4 }} activeDot={{ r: 6 }} />
          </LineChart>
        </ChartContainer>
      </div>
    </DialogContent>
  )
}

function PlantCard({ plant }: { plant: Plant }) {
  const { current, percentage } = getMoisture(plant)
  const status = statusFor(percentage)
  const statusColor = status.tone === "danger" ? "text-[#bd5b45]" : status.tone === "warning" ? "text-[#a4772b]" : "text-[#467555]"
  const barColor = status.tone === "danger" ? "bg-[#cf7459]" : status.tone === "warning" ? "bg-[#d2a34a]" : "bg-[#6f9d78]"

  return (
    <Dialog>
      <DialogTrigger asChild>
        <button className="group flex w-full flex-col border-b border-[#d8dfd5] py-5 text-left transition-colors hover:bg-[#f6f8f3] sm:px-3">
          <div className="flex items-start justify-between gap-3"><div className="flex min-w-0 gap-3"><div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[#dfe9d7] text-[#315d42]"><Sprout className="size-5" /></div><div className="min-w-0"><p className="truncate font-semibold text-[#1f3428]">{plant.name}</p><p className="mt-0.5 text-xs text-[#78847a]">{plant.species} · {plant.room}</p></div></div><ChevronRight className="mt-2 size-4 shrink-0 text-[#aab4aa] transition-transform group-hover:translate-x-1" /></div>
          <div className="mt-5 flex items-end justify-between gap-4"><div className="min-w-0 flex-1"><div className="mb-2 flex items-center justify-between text-xs"><span className={`font-medium ${statusColor}`}>{status.label}</span><span className="text-[#78847a]">{percentage}% of range</span></div><div className="h-2 overflow-hidden rounded-full bg-[#e7ece4]"><div className={`h-full rounded-full transition-all ${barColor}`} style={{ width: `${percentage}%` }} /></div></div><div className="shrink-0 text-right"><p className="font-heading text-xl font-semibold tracking-tight text-[#1f3428]">{current.toLocaleString()}<span className="ml-1 text-xs font-normal text-[#78847a]">g</span></p><p className="text-[10px] uppercase tracking-[0.12em] text-[#9aa39b]">last weight</p></div></div>
        </button>
      </DialogTrigger>
      <PlantHistory plant={plant} percentage={percentage} />
    </Dialog>
  )
}

export default function PlantDashboard({ plants, lastUpdated }: { plants: Plant[]; lastUpdated: string }) {
  const [query, setQuery] = useState("")
  const [activeGroup, setActiveGroup] = useState("All plants")
  const groups = ["All plants", ...Array.from(new Set(plants.map((plant) => plant.group)))]
  const filteredPlants = useMemo(() => plants.filter((plant) => {
    const matchesGroup = activeGroup === "All plants" || plant.group === activeGroup
    const search = query.toLowerCase()
    return matchesGroup && (plant.name.toLowerCase().includes(search) || plant.species.toLowerCase().includes(search))
  }), [activeGroup, plants, query])
  const needsAttention = plants.filter((plant) => getMoisture(plant).percentage < 50).length

  return (
    <main className="min-h-screen bg-[#eef2eb] text-[#1f3428]">
      <div className="mx-auto flex min-h-screen max-w-[1440px] flex-col bg-[#fbfcf8] shadow-[0_0_80px_rgba(41,70,46,0.07)]">
        <header className="flex items-center justify-between border-b border-[#e0e6dd] px-5 py-4 sm:px-10 lg:px-14"><div className="flex items-center gap-3"><div className="flex size-9 items-center justify-center rounded-xl bg-[#315d42] text-[#e8f2e0]"><Droplets className="size-4" /></div><span className="font-heading text-lg font-semibold tracking-tight">verdant</span></div><div className="flex items-center gap-2"><span className="hidden text-xs text-[#78847a] sm:inline">Last measurement {lastUpdated}</span><Button variant="ghost" size="icon" aria-label="Sign in" className="text-[#55705a] hover:bg-[#eef3eb]"><LogIn className="size-4" /></Button></div></header>
        <section className="border-b border-[#e0e6dd] px-5 pb-10 pt-10 sm:px-10 lg:px-14 lg:pb-12 lg:pt-14"><div className="flex flex-col justify-between gap-7 lg:flex-row lg:items-end"><div><p className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-[#6f896f]"><SunMedium className="size-3.5" /> {lastUpdated}</p><h1 className="max-w-xl font-heading text-4xl font-semibold tracking-[-0.04em] text-[#1f3428] sm:text-5xl">A little care goes a long way.</h1><p className="mt-4 max-w-lg text-sm leading-6 text-[#78847a]">Keep an eye on the quiet signals. Your plants are telling you when it is time for a drink.</p></div><div className="flex shrink-0 gap-8 border-l border-[#d8dfd5] pl-6"><div><p className="text-3xl font-semibold tracking-tight text-[#315d42]">{plants.length}</p><p className="mt-1 text-xs text-[#78847a]">plants tracked</p></div><div><p className="flex items-center gap-1 text-3xl font-semibold tracking-tight text-[#bd5b45]">{needsAttention}<ArrowDownRight className="size-5" /></p><p className="mt-1 text-xs text-[#78847a]">need attention</p></div></div></div></section>
        <section className="flex-1 px-5 py-7 sm:px-10 lg:px-14 lg:py-9"><div className="mb-7 flex flex-col justify-between gap-4 md:flex-row md:items-center"><div><h2 className="font-heading text-2xl font-semibold tracking-tight">Your collection</h2><p className="mt-1 text-sm text-[#78847a]">Tap a plant to see its weight story.</p></div><div className="flex items-center gap-2"><div className="relative"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#9aa39b]" /><Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search plants" className="h-9 w-full border-[#d8dfd5] bg-[#f7f9f5] pl-9 text-sm md:w-44" />{query && <button aria-label="Clear search" onClick={() => setQuery("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-[#9aa39b]"><X className="size-3.5" /></button>}</div><Button variant="outline" size="icon" aria-label="Add plant" className="h-9 w-9 border-[#d8dfd5] text-[#315d42]"><Plus className="size-4" /></Button></div></div><div className="mb-8 flex gap-1 overflow-x-auto border-b border-[#e0e6dd]">{groups.map((group) => <button key={group} onClick={() => setActiveGroup(group)} className={`shrink-0 border-b-2 px-3 pb-3 text-sm transition-colors ${activeGroup === group ? "border-[#315d42] font-semibold text-[#315d42]" : "border-transparent text-[#8b968d] hover:text-[#315d42]"}`}>{group}</button>)}</div>{filteredPlants.length > 0 ? <div className="grid gap-x-8 gap-y-7 md:grid-cols-2">{filteredPlants.map((plant) => <div key={plant.id}><p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#9aa39b]">{plant.group}</p><PlantCard plant={plant} /></div>)}</div> : <div className="py-16 text-center"><p className="font-heading text-lg font-semibold">No plants found</p><p className="mt-1 text-sm text-[#78847a]">Try a different search or collection.</p></div>}</section>
        <footer className="flex flex-col justify-between gap-3 border-t border-[#e0e6dd] px-5 py-5 text-xs text-[#8b968d] sm:flex-row sm:px-10 lg:px-14"><p className="flex items-center gap-2"><CalendarDays className="size-3.5" /> Weight history is your most reliable watering signal.</p><p className="flex items-center gap-1 text-[#6f896f]"><ArrowUpRight className="size-3.5" /> All systems growing</p></footer>
      </div>
    </main>
  )
}
