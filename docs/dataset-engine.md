# Dataset query engine

## Storage

Every accepted CSV row is stored in `DatasetRow` with its source row number and JSONB values. Rows cascade with their dataset. A compound `(datasetId, rowNumber)` unique index supports stable pagination and a GIN index supports JSONB access. The raw CSV remains the source artifact in object storage.

Ingestion uses batches of 1,000 rows. The complete file is validated against the inferred schema during ingestion, preventing unsafe numeric or date casts at query time. The dataset becomes `READY` only after every row is stored; failures delete the partial dataset and its rows.

## Query API

`POST /api/datasets/:datasetId/query` accepts a validated query document:

```json
{
  "columns": ["region", "revenue", "order_date"],
  "filters": [
    {
      "column": "order_date",
      "operator": "between",
      "value": ["2026-01-01", "2026-12-31"]
    },
    { "column": "revenue", "operator": "gte", "value": 1000 }
  ],
  "search": { "query": "Casablanca", "columns": ["city", "region"] },
  "groupBy": ["region"],
  "aggregations": [
    { "function": "sum", "column": "revenue", "alias": "totalRevenue" },
    { "function": "count", "alias": "orders" }
  ],
  "sort": [{ "column": "totalRevenue", "direction": "desc" }],
  "page": 1,
  "pageSize": 50,
  "cacheTtlSeconds": 60
}
```

Supported filters are `eq`, `neq`, `gt`, `gte`, `lt`, `lte`, `contains`, `startsWith`, `endsWith`, `in`, `between`, `isNull`, and `isNotNull`. `between` provides date-range filtering for date or datetime columns. Aggregations are `count`, `sum`, `avg`, `min`, and `max`.

## Query compilation and security

The API authenticates the user and verifies `dataset:read` permission against the dataset's organization. Dataset schema provides the only allowed column names. Values and JSON keys are parameterized with Prisma SQL templates; clients cannot submit SQL fragments. Numeric, boolean, date, and datetime expressions use inferred types, so ordering and comparison are semantic instead of lexical.

Column projection occurs inside PostgreSQL using `jsonb_build_object`, reducing payload size. Filtering, grouping, aggregation, ordering, counting, and pagination execute in PostgreSQL rather than application memory.

## Caching

Canonical validated query input is hashed with SHA-256. `DatasetQueryCache` stores JSON results and expiration in PostgreSQL, making cache behavior consistent across application instances. TTL is selectable from 0 to 3,600 seconds, defaults to 60 seconds, and expired entries are removed opportunistically. Dataset deletion cascades its cache.
