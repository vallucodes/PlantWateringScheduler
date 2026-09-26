Markdown

# Project Specification: Plant Weight & Watering Tracker (MVP)

## 1. Project Overview
This is a Minimum Viable Product (MVP) for a web-based plant tracking dashboard. It replaces an existing complex spreadsheet. The app tracks plant weights over time to determine watering needs based on defined minimum and maximum weight thresholds[cite: 1].

The app follows a **Public Read / Protected Write** architecture. Anyone can view the dashboard, current dryness levels, and historical charts. An admin password is required to log weights, add plants, or modify thresholds.

## 2. Tech Stack
* **Framework:** Next.js (App Router, TypeScript)
* **Styling:** Tailwind CSS
* **UI Components:** shadcn/ui (specifically: Card, Button, Input, Form, Dialog, Table, and Chart/Recharts)
* **Icons:** lucide-react
* **Database:** SQLite (local `dev.db` for MVP)
* **ORM:** Prisma
* **Authentication:** Next.js Middleware with a secure HTTP-only cookie (single `ADMIN_PASSWORD` in `.env`)

---

## 3. Database Schema (Prisma)
The database models the relationship between watering groups, plants, and their historical weights.

```prisma
datasource db {
  provider = "sqlite"
  url      = env("DATABASE_URL")
}

generator client {
  provider = "prisma-client-js"
}

model WateringGroup {
  id     String  @id @default(cuid())
  name   String  // e.g., "Summer Cacti", "Aloes"
  plants Plant[]
}

model Plant {
  id            String        @id @default(cuid())
  name          String
  minWeight     Float         // Minimum dry weight threshold
  maxWeight     Float         // Maximum wet weight threshold
  groupId       String?
  group         WateringGroup? @relation(fields: [groupId], references: [id])
  weightLogs    WeightLog[]
  createdAt     DateTime      @default(now())
}

model WeightLog {
  id        String   @id @default(cuid())
  weight    Float
  date      DateTime @default(now())
  plantId   String
  plant     Plant    @relation(fields: [plantId], references: [id], onDelete: Cascade)
}

4. Core Features & UI Requirements
A. Public Read-Only Dashboard (/)

    Grouped View: Display plants clustered by their WateringGroup.

    Plant Cards: Each plant should display its name, latest logged weight, and a visual Dryness Gauge.

    Dryness Calculation: Calculate the percentage using: ((currentWeight - minWeight) / (maxWeight - minWeight)) * 100. Clamp the result between 0% and 100%. Color code the gauge (e.g., Green for >50%, Yellow for 20-50%, Red for <20%).

    Historical Chart Component: Clicking a plant opens a detailed view or modal containing a Line Chart (via shadcn/Recharts).

        X-axis: Date of the log.

        Y-axis: Weight.

        Crucial: The chart MUST include two horizontal <ReferenceLine /> components indicating the plant's minWeight and maxWeight so the user can visually see the current weight dropping toward the minimum threshold[cite: 1].

B. Admin Authentication (/login)

    A simple UI with a single password input.

    Submitting the correct password (matching ADMIN_PASSWORD in .env) sets a secure, HTTP-only session cookie.

    Next.js Middleware must protect all Server Actions or API routes that mutate data.

    If the user has the admin cookie, the UI should conditionally render edit/add buttons.

C. Protected Write Actions (Admin Only)

    Quick Log Form: A UI to quickly input today's weight for multiple plants at once, grouped by WateringGroup.

    CRUD Operations:

        Add/Edit/Delete a WateringGroup.

        Add/Edit/Delete a Plant (must specify name, min weight, max weight, and assign to a group).

        Delete an erroneous WeightLog.

5. Agent Implementation Steps

Step 1: Scaffolding & Setup

    Initialize Next.js app with Tailwind and TypeScript.

    Initialize Prisma with SQLite and apply the schema above.

    Create a seed.ts script to populate the database with 2 Mock Groups, 4 Mock Plants, and 10 days of historical WeightLog data so the UI can be tested immediately.

    Initialize shadcn/ui and install required components (button, input, card, dialog, chart).

Step 2: Backend & Auth

    Implement the simple cookie-based login action.

    Implement Next.js Middleware to verify the cookie for protected actions.

    Write Prisma data access functions (queries for fetching grouped plants, mutations for adding logs).

Step 3: Frontend Construction

    Build the Public Dashboard displaying grouped plant cards and dryness indicators.

    Build the Recharts component with the min/max reference lines.

    Build the conditionally rendered Admin UI (Quick Log, Add Plant, Edit Thresholds).

Agent Instruction Note: Prioritize clean, functional UI using shadcn components over custom CSS. Use Next.js Server Actions for all form submissions and database mutations.
