# 03 — UX and Visual Design System

## 1. Reference interpretation

### Workspace reference
The first supplied image communicates an enterprise project-control interface: blue global navigation, white canvas, left sidebar, compact KPI cards, Gantt chart, roadmap, backlog, kanban board and activity feed. Preserve this information hierarchy and density while creating original Truvornex components and spacing.

### Logo reference
The supplied Truvornex mark is a black rounded-square field containing three white horizontal rounded bars of decreasing length and a light-grey circular endpoint that intersects the third bar. It is an abstract routing/structure symbol.

Use the mark as provided. Do not add gradients, outlines, shadows, extra strokes, text inside the mark, or decorative effects. Do not change the bar count, relative lengths, circle position or corner geometry.

## 2. Visual character

- Functional, restrained, precise and institutional.
- Light theme as the default for the engineering workspace.
- Strong hierarchy through spacing, alignment, typography and borders—not decoration.
- Blue is a functional navigation/action accent, based on the dashboard reference.
- The logo remains monochrome and must not be recolored to match the blue interface.
- Avoid glassmorphism, neon, gradients, oversized rounded cards, marketing-style hero sections and decorative charts.

## 3. Starter tokens

These are initial design tokens and should be centralized in code:

| Token | Value | Use |
|---|---|---|
| `brand.ink` | `#111111` | Primary text and logo field |
| `brand.blue` | `#1261A6` | Global navigation and primary actions |
| `surface.canvas` | `#F7F8FA` | Application background |
| `surface.panel` | `#FFFFFF` | Cards and main content |
| `border.default` | `#D9DEE5` | Dividers and card borders |
| `text.primary` | `#17212B` | Main text |
| `text.secondary` | `#66717D` | Secondary text |
| `status.success` | `#2D9B67` | Completed / healthy |
| `status.progress` | `#2878C7` | In progress |
| `status.warning` | `#D69A18` | Scheduled / attention |
| `status.danger` | `#C74747` | Overdue / failure |
| `status.neutral` | `#9099A3` | New / inactive |

Do not encode status by color alone. Always include a label or icon and meet accessible contrast requirements.

## 4. Components

Build a small consistent component library:

- App header and sidebar
- Breadcrumbs and page heading
- KPI/stat card
- Data table with filters and saved views
- Work-package card and detail panel
- Kanban column/card
- Timeline/Gantt row and dependency edge
- Roadmap milestone
- Activity item
- Avatar and member identity
- Status, priority and role labels
- Comment thread
- File attachment list
- Empty, loading, error and access-denied states
- Dialog, popover, dropdown and command/search palette

## 5. Typography and density

Use a highly legible sans-serif system font stack. Use compact but comfortable text sizes; avoid tiny labels. Use consistent 4/8-point spacing increments. Tables should prioritize scanability, aligned columns and predictable row heights.

## 6. Responsive behavior

- Desktop: full sidebar and multi-column overview.
- Tablet: collapsible sidebar and reduced dashboard columns.
- Mobile: single-column dashboard, task-first interaction and navigation drawer.
- Gantt and dense tables may use horizontal scrolling on small screens; do not hide essential information silently.

## 7. Accessibility

Target WCAG 2.2 AA for core workflows. Support keyboard navigation, visible focus, semantic headings, accessible dialogs, screen-reader labels and reduced motion. Charts and timelines need equivalent textual summaries.

## 8. Brand asset rules

Use `assets/truvornex-mark.svg` as the scalable mark. Keep clear space around it at least equal to the height of the smallest bar. On light surfaces use the full black mark tile; do not place the white bars directly on white. On dark surfaces use the same black tile with sufficient separation. The SVG is a clean vector interpretation of the user-provided logo reference; compare against `references/logo-reference.jpg` before final brand approval.
