# 10 — Implementation Plan

Build in dependency order. Each phase ends with a demonstrable, testable increment.

## Phase 0 — Repository and engineering foundation

Deliver:
- Monorepo or clearly versioned client/API repositories
- Architecture decision record for final stack and deployment
- Local development environment and sample configuration
- Linting, formatting, type checking, test runner and CI
- Threat model and data classification

Exit gate: a new developer can run the application and tests from the documented instructions.

## Phase 1 — Identity and organization

Deliver:
- OIDC sign-in and secure sessions
- Workspace, member, team and division records
- Invitations, suspension and revocation
- Server-side authorization middleware
- Audit event foundation

Exit gate: uninvited users cannot enter; removed members lose access; permissions are tested at API level.

## Phase 2 — Project and work management

Deliver:
- Project portfolio
- Work packages and assignments
- Backlog and kanban board
- Comments, activity and notifications
- Dependencies, milestones and calendar

Exit gate: a real project can be created, planned, assigned, reviewed and closed with a complete activity trail.

## Phase 3 — Planning and knowledge

Deliver:
- Gantt and roadmap
- Documents, ADRs and knowledge pages
- Attachments and search
- Reports and saved views

Exit gate: project status and reporting are derived from canonical records and can be traced to source work.

## Phase 4 — Engineering integrations

Deliver:
- Git provider connection
- Merge request and pipeline references
- Messaging deep links and notifications
- Integration health, secret rotation and webhook replay controls

Exit gate: task-to-code-to-review-to-pipeline traceability works end to end.

## Phase 5 — Hardening and pilot

Deliver:
- Security review and remediation
- Load and resilience tests appropriate to pilot size
- Backup/restore exercise
- Accessibility review
- Operational runbooks and support ownership
- Pilot with a small internal team

Exit gate: no unresolved critical/high security findings, successful restore test, and pilot acceptance.

## Delivery rules

- Do not begin every module simultaneously.
- Keep the first release narrow and coherent.
- Every feature has an owner, specification, tests and acceptance criteria.
- Architecture changes require an ADR.
- Do not connect production Truvornex infrastructure or production operator credentials to this workspace.
