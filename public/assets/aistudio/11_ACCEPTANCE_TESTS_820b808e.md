# 11 — Acceptance Tests and Definition of Done

## 1. Identity and access

- Anonymous users cannot access workspace resources.
- Suspended or removed members lose access immediately or within the documented revocation window.
- A project member cannot read another restricted project without authorization.
- A team lead cannot grant workspace-owner privileges unless explicitly authorized.
- Workspace administrators cannot create production operator identities or retrieve production credentials.
- All role and membership changes create audit events.

## 2. Work management

- Work packages have a unique human-readable key within the defined scope.
- Every active work package has exactly one accountable owner.
- Dependency cycles are rejected.
- Blocked work displays its blocker and owner.
- Status transitions enforce required fields and permissions.
- Accepted work contains reviewer/verification evidence appropriate to its type.

## 3. Collaboration and knowledge

- Comments and mentions are permission-checked.
- Restricted files cannot be downloaded through guessed URLs.
- Document version history is preserved.
- Activity items link to the relevant resource.
- Notifications do not expose restricted content.

## 4. Integrations

- Invalid webhook signatures are rejected.
- Duplicate webhooks do not duplicate state changes.
- Revoked integration credentials stop working.
- Provider outages do not corrupt local project/work records.
- External provider IDs are scoped by provider and account/workspace.

## 5. Reliability and operations

- Database backup can be restored in a tested environment.
- Background jobs retry safely and expose permanent failures.
- API health/readiness checks work.
- Logs contain correlation IDs but no credentials or tokens.
- The application degrades clearly when an integration is unavailable.

## 6. UI and accessibility

- Core workflows work by keyboard.
- Focus is visible and dialogs are screen-reader accessible.
- Status is conveyed by text as well as color.
- Overview, board, project and task detail work at desktop and tablet widths.
- Loading, empty, error and access-denied states are implemented.
- Core workflows meet the chosen WCAG 2.2 AA acceptance target.

## 7. Definition of done

A work package is done only when its acceptance criteria pass, automated tests pass, relevant documentation is updated, security review is complete where required, and the accountable reviewer records acceptance. A green CI pipeline alone is not sufficient.
