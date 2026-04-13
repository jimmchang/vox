# Design Spec: Vox Dashboard

## Visual Direction

### Tone: Analytical Editorial

The dashboard presents simulation data to PMs who need to quickly identify where users get stuck. The tone is **analytical editorial** — the confidence and clarity of a well-typeset research report, combined with the density and scanability of a monitoring dashboard. No decorative flourish, no playful whimsy. Every pixel earns its space by making a data point easier to read.

### Typography

- **Display font:** `"DM Serif Display", Georgia, serif` — headings, page titles. The serifs add editorial weight and signal "this is a report worth reading," differentiating from generic dashboards.
- **Body font:** `"DM Sans", system-ui, sans-serif` — tables, labels, body text. Clean geometric sans that pairs well with DM Serif. Loaded via `next/font/google`.
- **Mono font:** `"DM Mono", monospace` — scores, IDs, metric values. Numbers stand out from prose.

**Typographic scale:**
| Role | Size | Weight | Tracking |
|------|------|--------|----------|
| Page title | 2rem / 32px | 700 (serif) | -0.02em |
| Section heading | 1.25rem / 20px | 600 (sans) | -0.01em |
| Body | 0.875rem / 14px | 400 (sans) | 0 |
| Caption / label | 0.75rem / 12px | 500 (sans) | 0.02em |
| Metric value | 1rem / 16px | 500 (mono) | 0.01em |

### Color & Theme

All colors as CSS custom properties in the global CSS file, compatible with shadcn's theming.

**Light mode (primary):**
```
--background: 0 0% 98.5%         /* warm off-white */
--foreground: 220 15% 12%        /* near-black with blue undertone */
--card: 0 0% 100%
--card-foreground: 220 15% 12%
--popover: 0 0% 100%
--popover-foreground: 220 15% 12%
--primary: 220 70% 45%           /* deep blue — authority, clarity */
--primary-foreground: 0 0% 98%
--secondary: 220 10% 94%
--secondary-foreground: 220 15% 20%
--muted: 220 10% 96%
--muted-foreground: 220 10% 45%
--accent: 220 10% 92%
--accent-foreground: 220 15% 15%
--destructive: 0 72% 51%         /* regression red */
--destructive-foreground: 0 0% 98%
--border: 220 10% 90%
--input: 220 10% 90%
--ring: 220 70% 45%
```

**Semantic color mapping for data visualization:**
```
--chart-1: 220 70% 45%           /* primary blue — baseline/current */
--chart-2: 160 60% 40%           /* green — improvement/proposed */
--chart-3: 35 90% 55%            /* amber — warning/caution */
--chart-4: 0 72% 51%             /* red — regression/dropout */
--chart-5: 270 50% 55%           /* purple — neutral/comparison */
```

**Heatmap scale (comprehension/trust 1-5):**
```
--score-1: 0 72% 51%             /* red */
--score-2: 25 85% 55%            /* orange */
--score-3: 45 90% 55%            /* amber */
--score-4: 90 50% 45%            /* yellow-green */
--score-5: 160 60% 40%           /* green */
```

**Dark mode:** Not in v1. The dashboard is a local tool for daytime PM workflows. Ship light-only, add dark later if requested.

### Motion

Minimal, purposeful. No page transitions, no orchestrated animations.

- **Table row hover:** `background-color` transition, 150ms ease
- **Chart tooltip:** instant (Recharts default)
- **Tab switch:** no animation, instant content swap
- **Loading states:** skeleton pulse animation (shadcn Skeleton default)
- **Badge/status indicators:** no animation, static

No motion library needed. CSS transitions only.

### Spatial Composition

- **Max content width:** 1200px, centered with `mx-auto`
- **Page padding:** `px-6 py-8` (24px horizontal, 32px vertical)
- **Card grid:** single column on detail pages, stacked vertically. No masonry, no complex grid.
- **Table density:** compact — 12px vertical padding per row (14px font). PMs scan many rows.
- **Section spacing:** `gap-8` (32px) between major sections, `gap-4` (16px) within sections.
- **Sidebar navigation:** fixed left, 240px wide, collapses to icon-only at `<768px`.

### Backgrounds & Texture

- Page background: flat `--background` (warm off-white). No gradients.
- Cards: white `--card` with `border` and `rounded-lg`. No shadows.
- Heatmap cells: solid fills from the score scale. No gradients within cells.
- No glassmorphism, no noise, no patterns. The data is the texture.

---

## Component Inventory

### Task 8: Simulation List Page

| UI Element | Component | Variant/Props | Notes |
|-----------|-----------|---------------|-------|
| Page layout | Sidebar + main content | Custom layout component | Sidebar nav with icon + label |
| Nav links | `SidebarMenuButton` | — | Home, Personas, Compare |
| Simulation table | `Table` + subcomponents | Compact density via className | TableHeader, TableBody, TableRow, TableHead, TableCell |
| Status indicator | `Badge` | `variant="default"` (completed), `variant="secondary"` (running), `variant="destructive"` (failed) | Color-coded by simulation status |
| Improvement/regression badge | `Badge` | `variant="outline"` with green/red text color | Shows delta direction |
| Empty state | Custom div | — | Centered text + icon, no simulation data |
| Loading skeleton | `Skeleton` | Repeated rows matching table shape | Shown during fetch |

### Task 9: Simulation Detail Page

| UI Element | Component | Variant/Props | Notes |
|-----------|-----------|---------------|-------|
| Tab navigation | `Tabs` + `TabsList` + `TabsTrigger` + `TabsContent` | `defaultValue="report"` | Tabs: Report, Funnel, Heatmap, Comparison |
| Report display | `Card` + prose styling | — | Rendered markdown inside card, using `@tailwindcss/typography` or manual prose classes |
| Dropout funnel chart | `ChartContainer` + Recharts `BarChart` | Horizontal bars via `layout="vertical"` on BarChart | `Bar` with `fill="var(--color-current)"` and `fill="var(--color-proposed)"` |
| Comprehension heatmap | Custom grid component | CSS Grid, cells colored by `--score-N` | Not a Recharts chart — a styled HTML grid is clearer for persona x touchpoint |
| Delta comparison table | `Table` | Cells contain score + arrow indicator | Current vs proposed side-by-side per persona per touchpoint |
| Metric impact summary | `Card` with grouped items | — | List of metrics with impact badges |
| Status indicator (in-progress) | `Badge` + `Skeleton` | — | When simulation not yet completed |
| 404 state | Custom div | — | Simulation not found |

### Task 10: Comparison + Persona Pages

| UI Element | Component | Variant/Props | Notes |
|-----------|-----------|---------------|-------|
| Simulation selector (compare) | `Select` + `SelectTrigger` + `SelectContent` + `SelectGroup` + `SelectItem` | Two selects side-by-side | Pick simulation A and B |
| Delta table (compare) | `Table` | Cells show score change with color | Touchpoint x persona grid |
| Summary counts | `Card` with metric | — | Improved / Regressed / Unchanged / New counts |
| Persona list | `Table` or card grid | Grouped by domain using section headings | Browse all personas |
| Domain group header | Section heading | `text-sm font-medium text-muted-foreground uppercase tracking-wider` | Groups personas by domain |
| Persona detail card | `Card` + `Tabs` | Tabs for Definition, History, Simulations | Shows YAML fields, version log, usage |
| Version history list | Ordered list inside card | — | Date + change description from persona history array |
| Empty states (compare, personas) | Custom div | — | "Need at least 2 simulations" / "No personas found" |

### Components to Install

These shadcn components need to be added to the project:

1. `table` — simulation list, delta tables, heatmap grid
2. `badge` — status indicators, improvement/regression
3. `tabs` — detail page sections, persona detail
4. `card` — content containers, metric summaries
5. `select` — simulation picker on compare page
6. `skeleton` — loading states
7. `chart` — dropout funnel, trend charts (installs Recharts v3)
8. `sidebar` — main navigation
9. `separator` — visual dividers
10. `tooltip` — hover context on heatmap cells and table values

**Additional dependencies:**
- `recharts` (v3, installed with shadcn chart component)
- `next/font/google` for DM Serif Display, DM Sans, DM Mono (built into Next.js, no install)

---

## Performance Strategy

### Server/Client Boundaries

| Component | Type | Rationale |
|-----------|------|-----------|
| `layout.tsx` (root) | Server | Static shell, sidebar nav, font loading |
| `page.tsx` (simulation list) | Server | Fetches simulation list from SQLite, renders table. No interactivity. |
| `simulation/[id]/page.tsx` | Server | Fetches simulation data, passes to client children |
| `SimulationTabs` | Client | Tab switching requires state |
| `DropoutFunnelChart` | Client | Recharts requires browser APIs |
| `ComprehensionHeatmap` | Client | Hover tooltips require interactivity |
| `compare/page.tsx` | Server | Initial render, wraps client selector |
| `ComparisonSelector` | Client | Select state management |
| `DeltaTable` | Server (inside client parent) | Pure render from props, but lives inside client boundary due to parent |
| `personas/page.tsx` | Server | Static list from SQLite |
| `PersonaDetail` | Client | Tab switching for definition/history/simulations |

**Key decisions:**
- All data fetching happens in server components via direct Drizzle queries (no API routes needed for server components — but API routes exist for potential external consumers).
- Charts are always client components (`"use client"` boundary).
- Tables that don't need interactivity stay server-rendered.

### Data Fetching Plan

**Simulation list page (`/`):**
- Single query: `SELECT * FROM simulations ORDER BY created_at DESC` — server component, no Suspense needed (fast local SQLite).

**Simulation detail page (`/simulation/[id]`):**
- Parallel queries in server component using `Promise.all()`:
  ```
  Promise.all([
    getSimulation(id),
    getEvents(id),
    getReport(id),
    getTouchpoints(id),
  ])
  ```
- Pass pre-fetched data as props to client chart/tab components. No client-side fetching.

**Compare page (`/compare`):**
- Initial: fetch simulation list for selectors (server).
- On selection change: client-side fetch via API route (`/api/simulations/[id]/compare`). This is the one place where client-side data fetching is needed because selections are dynamic.

**Persona page (`/personas`):**
- Single query: `SELECT * FROM personas ORDER BY domain, name` — server component.

### Bundle Optimization

- **No barrel files.** Import directly from component files: `import { Table } from "@/components/ui/table"`, not from an index.
- **Dynamic import for charts.** Wrap `DropoutFunnelChart` and `ComprehensionHeatmap` in `next/dynamic` with `ssr: false` — Recharts is heavy and not needed for initial paint. Show `Skeleton` as fallback.
- **No third-party analytics/logging in v1.** Nothing to defer.
- **Font preload.** DM Serif Display and DM Sans loaded via `next/font/google` with `display: "swap"` — automatic preload by Next.js.

### Re-render Prevention

- **No inline component definitions.** Every component that renders inside a `.map()` or conditional is defined in its own file (e.g., `SimulationRow`, `HeatmapCell`, `PersonaCard`).
- **Derived state in compare page.** The comparison selector stores two simulation IDs. The delta data is fetched, not derived from raw events on each render.
- **Memoize chart configs.** `chartConfig` objects defined as module-level constants (outside component body), not recreated each render.
- **No `startTransition` needed.** No CPU-heavy state updates in v1 — tab switches swap pre-fetched content.

---

## Design Constraints

These are hard rules for `/build-run` to enforce on every slice.

### Layout & Spacing
- [ ] Max content width 1200px, centered
- [ ] `gap-*` for spacing, never `space-x` / `space-y`
- [ ] `size-*` for equal width/height, never `w-* h-*` separately

### Components
- [ ] All UI elements use shadcn components — no custom buttons, inputs, or dropdowns
- [ ] `SelectItem` inside `SelectGroup`, always
- [ ] Forms use `FieldGroup` + `Field` if any form elements appear (v1 is read-only, so unlikely)
- [ ] Icons use `data-icon` attribute, no sizing classes on icons inside components
- [ ] Semantic colors only: `bg-primary`, `text-muted-foreground`, etc. — never raw `bg-blue-500`
- [ ] Badge variants for status: `default` = completed, `secondary` = running, `destructive` = failed

### Charts
- [ ] All charts wrapped in `ChartContainer` with explicit `min-h-[VALUE]`
- [ ] Chart colors reference `var(--color-KEY)` from chartConfig, never hardcoded
- [ ] Charts are client components, dynamically imported with `next/dynamic({ ssr: false })`
- [ ] Heatmap is a CSS Grid, not a Recharts chart

### Data
- [ ] Server components fetch data via direct Drizzle queries, not API routes
- [ ] Parallel fetches use `Promise.all()`
- [ ] No client-side data fetching except compare page selector changes
- [ ] API routes exist but are consumed only by the compare page client component

### Performance
- [ ] No barrel file imports
- [ ] Chart components dynamically imported
- [ ] Fonts loaded via `next/font/google` at layout level
- [ ] No inline component definitions inside `.map()` or render functions
- [ ] chartConfig objects defined at module level, not inside components

### Scope
- [ ] Dashboard is strictly read-only — no forms, no mutations, no POST/PUT/DELETE
- [ ] No dark mode in v1
- [ ] No page transition animations
