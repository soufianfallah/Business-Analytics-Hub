# Architecture

## Decisions

### Server-first App Router

Components are Server Components by default. Add `"use client"` only at the lowest interactive boundary—for browser APIs, event handlers, React Hook Form, Recharts, or TanStack Query consumers. Route-level `loading.tsx`, `error.tsx`, `not-found.tsx`, and local `Suspense` boundaries provide explicit async states.

### Feature-based clean architecture

Business code lives in `src/features/<feature-name>`, not in global technical-layer folders. Inside a feature, clean-architecture layers keep domain rules independent from frameworks. Repository interfaces belong to `domain`; Prisma implementations belong to `infrastructure`; use cases belong to `application`; delivery adapters belong to `server` and `components`.

### Data access

Server Components call server-only query functions directly. Mutations use Server Actions for same-application UI workflows. Route Handlers are reserved for webhooks, third-party clients, downloads, and explicitly public APIs. Prisma is instantiated once in `src/lib/db`; feature repositories contain business-specific persistence queries.

### Type-safe boundaries

Every untrusted input—forms, URLs, environment variables, webhooks, and API bodies—is parsed with Zod. Infer TypeScript types from schemas rather than duplicating them. Server operations return discriminated `Result` values for expected failures; unexpected failures are logged centrally and shown through error boundaries.

### Authentication and authorization

Better Auth infrastructure belongs in `src/lib/auth`. Authentication establishes identity; feature-level application policies enforce tenant membership, roles, and resource ownership. Never rely on hidden UI or middleware as authorization.

### Client state

Prefer URL state and Server Components. TanStack Query is for client-side polling, optimistic mutations, and repeatedly refreshed remote data—not a default cache around every server query. Keep query keys/options next to their owning feature.

### UI system

Primitive shadcn/ui components live in `src/components/ui`; cross-feature compositions live in `src/components/shared`; business-aware UI remains within a feature. Tailwind semantic CSS variables support themes. Accessibility requires semantic HTML, keyboard operation, visible focus, labels, sufficient contrast, and reduced-motion awareness.

### SOLID enforcement

- Single responsibility: one use case per application operation.
- Open/closed and dependency inversion: domain ports isolate providers and Prisma.
- Liskov substitution: adapters honor domain port contracts and error semantics.
- Interface segregation: small capability-focused ports instead of broad service interfaces.

## Dependency rule

```text
app/routes -> feature server + feature UI -> application -> domain
                                      infrastructure --^ (implements domain ports)
shared framework utilities never import feature internals
```

## Request lifecycle

1. Parse input with Zod.
2. Authenticate the caller and resolve tenant context.
3. Authorize the requested capability/resource.
4. Invoke an application use case.
5. Access persistence through a domain port.
6. Map domain output to a minimal transport/view model.
7. Return a typed result; log unexpected errors without leaking details.
