# 09 — Integrations and API

## 1. Integration strategy

Integrate proven external products for capabilities that are not Truvornex's differentiator:

- Git provider: repositories, branches, commits, merge requests and release tags.
- CI provider: pipeline status, build links and test summaries.
- Team messaging: channels, notifications and deep links.
- Calendar/email: optional notifications and meeting links.
- OIDC identity provider: authentication and account lifecycle.
- Object storage: attachment bytes.

The workspace remains the source of truth for projects, work packages, assignments, milestones and its own knowledge records.

## 2. Integration safety

- Use narrowly scoped service accounts and permissions.
- Prefer OAuth or short-lived credentials where supported.
- Store credential references, not raw secrets, in the application database.
- Verify webhook signatures and timestamps.
- Make webhook processing idempotent.
- Apply per-provider rate limits and retry policies.
- Allow integrations to be disabled and credentials revoked independently.
- Never allow an external webhook to change user roles or grant workspace administration.

## 3. API conventions

- Version routes under `/api/v1`.
- Publish an OpenAPI document.
- Use JSON request/response schemas and consistent error envelopes.
- Use cursor pagination for large collections.
- Support filtering and sorting with allowlisted fields.
- Use idempotency keys for retryable create/transition operations where duplicate execution would be harmful.
- Include request/correlation IDs.
- Enforce authorization before returning resource details.

## 4. Initial resource groups

`/auth`, `/workspace`, `/members`, `/teams`, `/projects`, `/work-packages`, `/dependencies`, `/milestones`, `/comments`, `/documents`, `/attachments`, `/notifications`, `/integrations`, `/reports`, `/audit`.

## 5. Event delivery

Publish internal domain events through a transactional outbox. Initial event types include `WorkPackageCreated`, `WorkPackageAssigned`, `WorkPackageStatusChanged`, `DependencyBlocked`, `CommentMentioned`, `MilestoneChanged`, `MemberAccessChanged` and `IntegrationStateChanged`.

Do not expose internal event payloads as a public stable contract until versioned and documented.
