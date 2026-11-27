# Initial Architecture Decisions

## ADR-001 — Build a unified workspace, integrate specialist tools

**Status:** Proposed baseline

Build Truvornex-specific project/work management, organization, knowledge and reporting capabilities. Integrate an established Git/CI provider and an established messaging platform. Do not build a Git hosting service or complete chat replacement in the MVP.

## ADR-002 — Modular monolith first

**Status:** Proposed baseline

Use a modular API with explicit ownership boundaries and a single PostgreSQL database initially. Split services only when evidence justifies the added operational cost.

## ADR-003 — Workspace and production operations are separate trust domains

**Status:** Mandatory constraint

The engineering workspace does not manage the eight production operator seats, production operator identities, production credentials or production approvals.

## ADR-004 — Light enterprise interface

**Status:** Proposed baseline

Use the supplied project dashboard as a layout reference and the supplied monochrome mark as the brand asset. Keep the UI restrained, information-dense and accessible; do not reproduce the reference screenshot pixel-for-pixel.

## ADR-005 — Canonical work records

**Status:** Proposed baseline

All views (board, backlog, Gantt, calendar, roadmap and reports) operate on the same canonical work-package and milestone records.
