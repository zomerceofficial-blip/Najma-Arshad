# Truvornex Engineering Workspace

**Specification pack · v1.0 · 26 November 2026**

This repository defines the smallest complete specification needed to design and implement the internal engineering workspace for the Truvornex programme.

It is a team-development platform, not the Truvornex production infrastructure and not the eight-person production operator console.

## Start here

1. `01_PRODUCT_SCOPE.md` — product purpose, users and boundaries.
2. `02_INFORMATION_ARCHITECTURE.md` — navigation and screens.
3. `03_UX_DESIGN_SYSTEM.md` — visual rules derived from the supplied references.
4. `04_SYSTEM_ARCHITECTURE.md` — implementation architecture and technology choices.
5. `05_MODULE_SPECIFICATIONS.md` — module responsibilities and minimum functionality.
6. `06_DATA_MODEL.md` — core entities and relationships.
7. `07_IDENTITY_ACCESS_SECURITY.md` — authentication, permissions and separation of duties.
8. `08_WORKFLOWS_AND_NOTIFICATIONS.md` — task lifecycle, review, approvals and notifications.
9. `09_INTEGRATIONS_API.md` — external integrations and API conventions.
10. `10_IMPLEMENTATION_PLAN.md` — build sequence and deliverables.
11. `11_ACCEPTANCE_TESTS.md` — definition of done and release gates.

## Reference assets

- `assets/truvornex-mark.svg` — clean vector interpretation of the supplied symbol. Keep the proportions and geometry unchanged.
- `references/logo-reference.jpg` — original supplied logo image.
- `references/workspace-reference.jpg` — original supplied project-dashboard reference.

## Core product decision

Build one coherent workspace with a custom Truvornex overview, project/task model, knowledge centre and organization directory. Integrate mature systems for source control/CI and team messaging rather than rebuilding Git hosting or a full chat platform in the first release.

## Important boundary

The engineering workspace may contain many approved contributors. It must not issue or manage production operator privileges. The separate Truvornex Operator Console remains limited to exactly eight authorized operator seats under its own identity, infrastructure, credentials and approval policy.

## Status

This is a build specification. It is not implemented software, a security certification, a deployment, or evidence that any integration is already connected.
