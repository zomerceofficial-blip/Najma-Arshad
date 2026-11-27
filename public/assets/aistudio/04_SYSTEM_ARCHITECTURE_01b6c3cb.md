# 04 — System Architecture

## 1. Architecture goals

- Deliver one responsive web workspace.
- Separate UI, application services and persistence.
- Keep domain modules bounded and testable.
- Integrate source control, CI/CD and messaging instead of rebuilding them.
- Make auditability and authorization first-class.
- Keep the engineering workspace separate from Truvornex production infrastructure and its operator console.

## 2. Recommended initial stack

| Layer | Recommendation | Reason |
|---|---|---|
| Web client | React + TypeScript + Vite | Mature component ecosystem and client-independent API usage |
| API | NestJS + TypeScript | Modular server architecture, validation and dependency boundaries |
| API style | REST + OpenAPI | Clear contracts and generated client types |
| Database | PostgreSQL | Relational integrity, transactions and mature operations |
| Data access | Prisma with reviewed SQL migrations where needed | Explicit schema and migration workflow |
| Background work | PostgreSQL-backed job table initially; Redis/BullMQ when load requires it | Avoid unnecessary infrastructure at MVP |
| File storage | S3-compatible object storage | Durable attachments and document assets |
| Identity | OIDC-compatible identity provider | SSO, MFA and centralized identity lifecycle |
| Search | PostgreSQL full-text search initially | Reduce early operational complexity |
| Observability | Structured logs, metrics and traces using OpenTelemetry conventions | Debuggability and operational evidence |
| Source control/CI | GitLab or an existing approved Git provider | Avoid building Git hosting and CI runners |
| Team messaging | Mattermost or an existing approved collaboration system | Avoid building a complete chat product |

Choose supported stable versions at implementation start. Do not copy version numbers from this specification or hardcode vendor-specific assumptions into domain logic.

## 3. Deployment shape

Start as a modular monolith:

- One web application.
- One API application divided into domain modules.
- PostgreSQL as the source of truth.
- Object storage for attachments.
- Background worker process for notifications, webhooks and long-running jobs.
- Reverse proxy / TLS termination.

Split a module into an independent service only when there is a measured reliability, scaling, security or ownership reason. Do not begin with microservices.

## 4. Backend modules

`identity`, `organization`, `projects`, `work`, `planning`, `collaboration`, `knowledge`, `files`, `integrations`, `notifications`, `search`, `reporting`, `audit`, `administration`.

Each module owns its domain rules and data access. Cross-module communication should use explicit application interfaces or domain events, not direct access to another module's internal tables.

## 5. Main request flow

Browser client → HTTPS reverse proxy → API authentication → authorization policy → application module → PostgreSQL / object storage. Events are recorded through a transactional outbox before asynchronous delivery to integrations and notification workers.

## 6. Reliability

- Use database transactions for multi-record state changes.
- Make webhook handlers idempotent.
- Use bounded retries with dead-letter handling for asynchronous work.
- Back up the database and object storage; regularly test restoration.
- Provide health/readiness endpoints and graceful shutdown.
- Maintain separate development, staging and production environments.

## 7. Non-goals

This architecture does not run Truvornex regional cells, control production infrastructure, store production operator credentials or replace the separate eight-person Operator Console.
