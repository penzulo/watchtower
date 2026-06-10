# ADR 003: ClickHouse over PostgreSQL for Log Storage

**Date:** 2026-05-26
**Status:** Accepted

## Context
Project WatchTower needs to store high-volume, continuous log streams for up to 30 days. The database must handle massive write-throughput and execute analytical queries (e.g., filtering by level, service, or time) without locking or crashing.

## Decision
We will use **ClickHouse** (a Column-Oriented OLAP database) instead of a traditional Row-Oriented relational database like PostgreSQL.

## Rationale
1. **Disk I/O & Query Speed:** PostgreSQL reads data row-by-row, loading heavy text payloads into memory just to filter by a boolean or enum. ClickHouse reads strictly the columns queried, entirely skipping heavy message bodies during filtering, resulting in millisecond aggregations.
2. **Write Throughput:** ClickHouse's MergeTree engine is purpose-built for massive, append-only data streams. It easily handles thousands of inserts per second without the indexing overhead that chokes Postgres.
3. **Storage Compression:** Columnar data compresses incredibly well. Repeated strings (like `service` names or `INFO` levels) are compressed drastically, saving massive amounts of disk space compared to Postgres.

## Consequences
* **Positive:** Unbreakable analytical query performance and massive disk space savings.
* **Negative:** ClickHouse is not ACID compliant in the traditional sense; updates/deletes are asynchronous mutations. We must treat logs as immutable events.
