# Engineering conventions

## Naming

| Concern             | Convention                                   | Example                |
| ------------------- | -------------------------------------------- | ---------------------- |
| Files/folders       | kebab-case                                   | `revenue-overview.tsx` |
| React components    | PascalCase                                   | `RevenueOverview`      |
| Functions/variables | camelCase                                    | `getRevenueSummary`    |
| Constants           | SCREAMING_SNAKE_CASE                         | `MAX_EXPORT_ROWS`      |
| Types/interfaces    | PascalCase, no `I` prefix                    | `RevenueRepository`    |
| Zod schemas         | camelCase + `Schema`                         | `dateRangeSchema`      |
| Server actions      | verb + noun + `Action`                       | `createReportAction`   |
| Queries             | `get`/`list` prefix                          | `listDashboards`       |
| Booleans            | `is`/`has`/`can`/`should`                    | `canExport`            |
| Database            | singular PascalCase models, camelCase fields | `Dashboard.createdAt`  |
| Routes              | lowercase kebab-case nouns                   | `/data-sources`        |

## Imports and exports

Use `@/` for cross-folder imports and relative imports within a small module. Avoid default exports except where Next.js requires them. A feature's `index.ts` is its only cross-feature import surface; never create large barrel files.

## Errors and states

Expected failures are typed and safe to display. Unexpected exceptions are logged with correlation and tenant context, then mapped to a generic message. Every data surface must deliberately define loading, empty, error, partial-data, and permission-denied states.

## Tests

Co-locate unit tests as `*.test.ts(x)`. Put cross-feature integration tests under `src/test`, and browser journeys in a future top-level `e2e` directory. Domain and use-case tests should not require Next.js or a database.

## Pull-request guardrails

Run `npm run typecheck`, `npm run lint`, `npm run format:check`, tests, and `npm run build`. Review Prisma migration SQL and validate authorization on every new read and write path.
