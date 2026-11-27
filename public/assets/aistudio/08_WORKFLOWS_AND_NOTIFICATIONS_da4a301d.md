# 08 — Workflows and Notifications

## 1. Work-package lifecycle

Recommended default lifecycle:

`Draft → Backlog → Ready → In Progress → In Review → Verification → Accepted → Closed`

Additional states: `Blocked`, `Waiting`, `Cancelled` and `Reopened`.

Projects may configure labels and limited workflow variants, but must preserve equivalent semantics for reporting and automation.

## 2. Required task fields

Before a task enters `Ready`, require:

- Clear title and problem statement
- Project and work-package type
- Accountable owner
- Priority
- Scope and acceptance criteria
- Dependencies, or explicit confirmation that none are known

A due date and estimate are required when the work is committed to a milestone or sprint.

## 3. Review and acceptance

- The implementer moves work to `In Review` and links implementation evidence.
- A designated reviewer checks scope, tests and documentation.
- Verification checks required automated/manual evidence.
- The owner or authorized accepting role confirms acceptance.
- Rejected work returns with explicit findings.
- High-risk changes require a separate security/architecture approval according to project policy.

## 4. Dependencies and blockers

Dependencies must be directed and cycle-free. A task cannot be marked `Ready` while a blocking predecessor remains unresolved unless an authorized exception is recorded. Blocked tasks require a reason, blocker owner and next review date.

## 5. Notifications

Notify users about assignments, mentions, review requests, due-date changes, blockers, project announcements, access changes and integration failures. Batch low-priority updates. Do not send secrets or restricted document content in email or chat notifications; send authenticated links instead.

## 6. Activity feed

Activity entries should be generated from committed domain events, not from UI-only actions. Preserve actor, time, action, target and relevant changed fields. Allow filtering by project, person, event type and date.
