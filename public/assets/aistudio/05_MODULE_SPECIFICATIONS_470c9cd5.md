# 05 — Module Specifications

## 1. Workspace and organization

Manage workspace settings, divisions, teams, members, project memberships and invitations. Membership changes must be auditable and support immediate revocation.

## 2. Project portfolio

Projects have a stable key, name, objective, owner, sponsor, status, dates, visibility, participating teams and linked documents. Projects can be grouped into programmes. Project health is derived from milestones, blocked work, overdue work and delivery risks; owners may add a reasoned manual assessment.

## 3. Work packages

Support these types: initiative, epic, feature, task, subtask, bug, research item and technical debt. Common fields: key, title, description, type, status, priority, owner, assignees, reviewer, project, team, start/due dates, estimate, labels, dependencies, attachments and acceptance criteria.

## 4. Planning views

- Backlog: prioritized unscheduled work.
- Board: configurable columns and swimlanes.
- Calendar: deadlines, milestones and meetings.
- Roadmap: project/initiative milestones and target windows.
- Gantt: work-package dates, dependency links and critical blockers.
- Reports: saved filters and aggregate project metrics.

All views use the same underlying work-package records; they must not maintain separate copies of task status.

## 5. Collaboration

Provide task comments, mentions, reactions, project announcements and activity history. Link to the external chat system for real-time conversations. Important decisions made in chat must be captured as an ADR, RFC or project note.

## 6. Knowledge and files

Support Markdown-first pages, version history, page ownership, labels, cross-links, file attachments and access inheritance from project/team scope. Provide permanent URLs for documents and decision records. File downloads must check authorization on every request.

## 7. Engineering integrations

Display linked repositories, branches, commits, merge requests, pipeline status and release references. Do not copy repository contents into the workspace database. Store provider identifiers and normalized metadata only.

## 8. Notifications

Provide in-app notifications and optional email/delivery integrations. Users can configure non-critical preferences; security, access and approval events cannot be disabled by ordinary notification preferences.

## 9. Administration

Manage identity provider settings, teams, roles, workspace defaults, integrations and audit views. Sensitive administrative changes require re-authentication and produce audit events.

## 10. Reports

Start with project health, work by status, overdue/blocked work, milestone confidence, review queue, defect trends and delivery throughput. Report aggregates, not hidden individual surveillance metrics.
