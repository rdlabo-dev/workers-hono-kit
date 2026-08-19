---
title: 'API: Offline'
---

# API: `@rdlabo/workers-hono-kit/offline`

Table-agnostic building blocks for product-owned REST ↔ DB method converters and their offline replica wire values. This subpath does not define table projections, Zod object shapes, public-column allowlists, schema hashes, or domain rules; those remain in each Hono application.

This is an additive subpath: existing root and subpath exports are unchanged. Consumers can migrate converter internals independently without changing REST payloads, schema hashes, or persisted SQLite rows. For an `AUTO_INCREMENT` table, omit `id` from a create method's table scheme; keep the client-generated UUID in `local_id` and keep `server_id` null until the server confirms its id.

| Export | Description |
| --- | --- |
| `defineRestDbMethodConverter(converter)` | Type a product-owned, pure `MethodScheme ↔ TableScheme` converter without hiding HTTP or persistence side effects. |
| `RestDbMethodConverter` | Product-owned converter contract. Select and insert bundles may differ; every represented table and column remains required. |
| `CompleteRestDbTableScheme` | Compile-time lock requiring every represented table key and row column. |
| `toReplicaIsoDatetime(value)` | `Date` / datetime string → canonical UTC ISO-8601 wire value. |
| `toReplicaDateOnly(value)` | `Date` / date string / `null` → canonical `YYYY-MM-DD` / `null`. |
| `replicaTimestampMs(value)` | Replica datetime → epoch milliseconds for legacy DTOs. |
| `toTinyIntFlag(value)` / `fromTinyIntFlag(value)` | Boolean-like value ↔ numeric tinyint flag. |
| `replicaNowIso(clock?)` | Injectable wall clock → canonical UTC ISO-8601 wire value. |

```ts
import {
  defineRestDbMethodConverter,
  replicaNowIso,
  toReplicaIsoDatetime,
} from '@rdlabo/workers-hono-kit/offline';

type Tables = {
  foods: FoodRow[];
  allergens: AllergenRow[];
};

export const foodMethodConverter = defineRestDbMethodConverter<FoodMethodScheme, Tables>({
  toMethodScheme: ({ foods, allergens }) => ({
    ...foods[0],
    allergens: allergens.map(({ value }) => value),
  }),
  toTableScheme: (method) => ({
    foods: [{ id: method.id, memo: method.memo ?? null }],
    allergens: method.allergens.map((value) => ({ threadId: method.id, value })),
  }),
});
```

`toTableScheme` requires every key represented by its DB row types. This includes nullable/default columns that Drizzle marks optional in `$inferInsert`; write `memo: method.memo ?? null` instead of omitting `memo`. If a REST method intentionally does not own an `AUTO_INCREMENT` column, remove it from that method's product-owned table scheme explicitly:

```ts
type CreateTables = {
  foods: Omit<typeof foods.$inferInsert, 'id'>[];
};
```

The converter then cannot demand or manufacture `id`; the server adds the generated id to the confirmed response before it is stored as `server_id`.

When a write needs authenticated ownership or scope that is intentionally absent from the public REST body, use separate select/insert bundles and an explicit write context. The original two-generic form remains valid.

```ts
defineRestDbMethodConverter<Method, SelectTables, InsertTables, { userId: number }>({
  toMethodScheme: ({ foods, allergens }) => composeFood(foods, allergens),
  toTableScheme: (method, { userId }) => ({
    foods: [{ userId, name: method.name, memo: method.memo ?? null }],
    allergens: method.allergens.map((value) => ({ value })),
  }),
});
```

```ts
replicaNowIso(() => new Date('2026-07-23T10:00:00Z')); // '2026-07-23T10:00:00.000Z'
toReplicaIsoDatetime('2026-07-23T19:00:00+09:00'); // '2026-07-23T10:00:00.000Z'
```
