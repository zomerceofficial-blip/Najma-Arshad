# 02 — Information Architecture

## 1. Global layout

Use the supplied dashboard as a structural reference, not a pixel-perfect template:

- A compact blue global header for workspace/project context, global search, help, notifications and user menu.
- A persistent left navigation rail with clear section labels and icons.
- A light, white/near-white work surface.
- A page title and contextual actions at the top of each page.
- Dense but readable cards, tables and timeline views.
- Consistent activity and status presentation.

## 2. Primary navigation

### Workspace
- Overview
- My work
- Activity
- Inbox / notifications

### Delivery
- Projects
- Work packages
- Boards
- Backlog
- Gantt
- Roadmap
- Calendar
- Reports

### Collaboration
- Chat (integration)
- Meetings (integration)
- Documents
- Knowledge base
- Files

### Engineering
- Repositories (integration)
- Merge requests (integration)
- CI/CD pipelines (integration)
- Releases

### Organization
- Teams and divisions
- Members
- Workload

### Administration
- Workspace settings
- Roles and access
- Integrations
- Audit log

Navigation items must be permission-aware. Hide unavailable actions, but never use hiding as the security boundary; the backend must enforce every permission.

## 3. Overview dashboard

The default overview should provide:

- Summary cards: active projects, open work packages, completed this period, blocked, overdue and members.
- Main timeline/Gantt panel with dependency indicators.
- Roadmap and milestone panel.
- Backlog preview.
- Kanban board preview.
- Recent activity feed.
- My assigned work and upcoming deadlines.

Allow users to rearrange or hide dashboard widgets in a later release. The first release may use a fixed layout with sensible responsive behavior.

## 4. Essential screens

1. Sign-in and account recovery
2. Workspace overview
3. Project overview
4. Work package detail / create / edit
5. Backlog and board
6. Gantt and roadmap
7. Calendar
8. Member and team directory
9. Document and knowledge editor/viewer
10. Search results
11. Notifications and activity
12. Integration settings
13. Workspace administration and audit log

## 5. Screen behavior

- Selecting a task opens a detail page or side panel with description, owner, status, priority, dates, dependencies, files, comments and history.
- Every project-scoped screen must show its project context.
- Users must be able to navigate from an activity event to the relevant task, document or merge request.
- Empty states explain how to create or request the relevant resource.
- Loading, error, permission-denied and offline states must be designed—not left to browser defaults.
