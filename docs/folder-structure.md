# Folder structure

```text
.
├── docs/                       # architecture decisions and team conventions
├── prisma/
│   ├── schema.prisma           # database source of truth
│   └── migrations/             # generated, reviewed SQL migrations
├── public/                     # static public assets only
├── src/
│   ├── app/                    # routes, layouts, metadata, route-level states
│   │   ├── (auth)/             # future unauthenticated auth routes
│   │   ├── (dashboard)/        # future protected application routes
│   │   └── api/                # external HTTP boundaries only
│   ├── features/               # vertically sliced business capabilities
│   ├── components/
│   │   ├── ui/                 # shadcn primitives
│   │   └── shared/             # reusable feature-agnostic compositions
│   ├── config/                 # typed static application configuration
│   ├── hooks/                  # feature-agnostic client hooks
│   ├── lib/
│   │   ├── api/                # transport helpers
│   │   ├── auth/               # Better Auth setup and shared guards
│   │   ├── db/                 # Prisma client and generic transaction support
│   │   ├── errors/             # application error taxonomy and mapping
│   │   ├── observability/      # logging, tracing, metrics adapters
│   │   ├── query/              # TanStack Query provider/client policy
│   │   └── security/           # rate limiting, CSRF/header helpers
│   ├── test/                   # shared test factories and mocks
│   └── types/                  # truly global types only
└── configuration files
```

Route groups are created when the first route needs them; empty directories are not tracked by Git. The same just-in-time rule applies to feature subfolders and generated migrations.
