# Feature module contract

Each business capability owns its UI, application logic, domain rules, infrastructure adapters, validation, and public types. Create only the folders a feature needs:

```text
features/<feature-name>/
├── application/       # use cases; orchestrates domain ports
├── domain/            # entities, value objects, policies, repository interfaces
├── infrastructure/    # Prisma/external-service implementations
├── server/            # server actions, queries, route handlers, authorization
├── components/        # feature UI; client boundary only where interaction requires it
├── hooks/             # feature-specific client hooks and TanStack Query options
├── schemas/           # Zod input/output schemas
├── types/             # transport and presentation types
└── index.ts            # deliberately small public API
```

Dependencies point inward: `infrastructure` and presentation may depend on `application` and `domain`; domain code depends on neither Next.js nor Prisma. Features must not deep-import one another. Promote genuinely shared code to `src/components`, `src/lib`, `src/hooks`, or `src/types`.
