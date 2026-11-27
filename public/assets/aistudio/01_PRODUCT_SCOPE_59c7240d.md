# 01 — Product Scope

## 1. Purpose

Create a private engineering workspace through which the Truvornex organization can plan, discuss, design, implement, review, test and document the Truvornex infrastructure programme.

The primary experience should resemble a serious project-control environment: dense but legible, with a persistent navigation model, clear work status, dependencies, timelines and recent activity.

## 2. Users

- Founder / organization leadership
- Programme and project managers
- Systems architects and technical leads
- Software, platform, data, security and SRE engineers
- Researchers and technical writers
- QA and verification engineers
- Approved external contributors with time-limited access

## 3. Product outcomes

1. Every project, task and decision has an owner and traceable history.
2. Teams can see priorities, dependencies, deadlines and blockers.
3. Conversations can be linked to the work they concern.
4. Specifications and architecture decisions remain searchable and versioned.
5. Code, reviews, CI results and releases can be traced back to tasks.
6. Leadership can see programme health without reading every project conversation.

## 4. MVP scope

The first release must include:

- Organization directory, teams and project membership
- Project overview and dashboard
- Work packages: initiatives, epics, tasks, subtasks and bugs
- Backlog, kanban board, calendar, roadmap and Gantt view
- Assignments, priorities, due dates, dependencies and blockers
- Comments, activity history and notifications
- Documents, decision records and file attachments
- Search across projects, tasks and documentation
- Git provider integration for branches, commits and merge requests
- Messaging integration with deep links to projects and tasks
- Role-based access, audit history and administration

## 5. Explicitly out of scope for the first release

- Building a new Git hosting service
- Building a complete Slack/Discord replacement
- Building video-conferencing infrastructure
- Production deployment controls for Truvornex itself
- The eight-person production operator console
- Payroll, HR, finance, customer support or public user accounts
- AI agents that can autonomously change code, permissions or production systems

These can be considered later through approved product decisions.

## 6. Product principles

- One workspace, clear ownership.
- Work is the central object; chat and files attach to work.
- No task is complete without acceptance evidence.
- Least privilege by default.
- Integrate proven tools where they are better than a custom implementation.
- Keep the application useful on ordinary laptops and moderate network connections.
- Avoid vanity metrics and individual surveillance; measure delivery flow and system quality.
