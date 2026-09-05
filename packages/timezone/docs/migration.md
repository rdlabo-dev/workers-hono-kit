---
title: Migration
---

# Migration

From kit `0.12.0`, `@rdlabo/workers-hono-kit/business-time` is a deprecated re-export of this
package. Install `@rdlabo/workers-timezone` directly and change the import path. Existing function
names remain available; new code can use `toLocalDateTime`, `localDateTimeToInstant`, and the other
timezone-neutral names in [API](./api.md).

## Behavior changes

The default remains `Asia/Tokyo`, but compatibility is not identical output for every input:

- Conversion uses IANA historical offsets rather than fixed `+09:00`. Historical Tokyo dates can
  therefore produce different results.
- Invalid date-only values normalize to `null`; invalid date-time construction throws `RangeError`
  rather than rolling over into another month.
- DST overlaps choose the earlier occurrence; skipped wall clocks and fully skipped dates throw.

Treat these as breaking behavior changes when migrating from the old fixed-offset implementation.
Test historical dates and validation boundaries before deployment. The compatibility import shares
the same underlying module; it is not a separate timezone configuration slot.
