# 06 — Core Data Model

The following is the minimum logical model. Physical schema and indexes are implementation deliverables.

## 1. Main entities

| Entity | Key fields / purpose |
|---|---|
| `User` | `id`, identity-provider subject, display name, email, state |
| `Workspace` | `id`, name, configuration |
| `Membership` | user, workspace, state, joined/expiry dates |
| `Division` | workspace, name, lead |
| `Team` | division, name, lead |
| `TeamMembership` | team, user, team role |
| `Project` | key, name, objective, owner, status, visibility, dates |
| `ProjectMembership` | project, user/team, project role |
| `WorkPackage` | key, type, title, description, status, priority, owner, dates |
| `WorkAssignment` | work package, user, assignment role |
| `WorkDependency` | predecessor, successor, dependency type |
| `Milestone` | project, title, target date, state, owner |
| `Comment` | parent resource, author, body, timestamps |
| `Document` | project/scope, title, body, version, owner |
| `Attachment` | parent resource, object key, media type, size, checksum |
| `Label` | workspace, name, color token |
| `WorkLabel` | work package, label |
| `Integration` | provider, workspace scope, status, secret reference |
| `ExternalLink` | local resource, provider, external identifier, URL |
| `Notification` | recipient, type, payload reference, read state |
| `AuditEvent` | actor, action, target, timestamp, request/correlation ID |
| `SavedView` | owner/scope, query definition, display settings |

## 2. Relationship rules

- A workspace contains divisions, teams, projects and members.
- A project can contain many work packages, milestones and documents.
- Work packages can have parent-child relationships and directed dependencies.
- A work package can have multiple assignees, but exactly one accountable owner.
- External provider objects are linked by provider identifiers; do not assume external IDs are globally unique.
- Audit events are append-only from the application perspective.

## 3. Data integrity

- Use UUIDs or equivalent opaque identifiers for internal entities.
- Use human-readable project/work keys only as display identifiers.
- Enforce foreign keys and uniqueness constraints.
- Store timestamps in UTC and render in the viewer's chosen timezone.
- Use optimistic concurrency/version fields for collaborative editing.
- Prevent dependency cycles in the work graph.
- Soft deletion is not a substitute for retention policy; define archival and deletion behavior explicitly.

## 4. Privacy and retention

Collect only data needed for workspace operation. Define retention for audit events, messages, attachments, invitations and inactive accounts. Support account deactivation and lawful deletion workflows while preserving records that must remain for legitimate security or legal reasons. Document each exception.
