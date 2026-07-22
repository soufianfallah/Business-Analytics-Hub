# Business Analytics Hub

Production-oriented SaaS foundation using Next.js 15, React 19, TypeScript, Tailwind CSS, shadcn/ui, Prisma/PostgreSQL, Better Auth, TanStack Query, Recharts, Zod, and React Hook Form.

This initial scaffold intentionally contains no business feature implementation. It establishes a server-first application shell, strict tooling, theme tokens, shared state/error contracts, and empty feature boundaries.

## Start locally

1. Install Node.js 20.9+ and PostgreSQL.
2. Run `npm install`.
3. Copy `.env.example` to `.env` and replace every placeholder.
4. Run `npm run db:generate`.
5. Run `npm run dev`.

## Read before adding features

- [Architecture](docs/architecture.md)
- [Folder structure](docs/folder-structure.md)
- [Engineering conventions](docs/conventions.md)

Add a feature only when its domain language and boundary are clear. Start with `src/features/README.md`, expose a deliberately small public API, and keep framework details outside the domain layer.
