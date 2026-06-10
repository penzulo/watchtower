# ADR 004: Dead Letter Queue (DLQ) Pattern for Ingestion Resilience

**Date:** 2026-05-26
**Status:** Accepted

## Context
Our Elysia API Gateway accepts JSON logs from various upstream applications in different languages. If an app server sends malformed data (e.g., missing the required `service` field) directly to our ingestion pipeline, it could crash the database worker or corrupt the analytical tables.

## Decision
We will implement a **Dead Letter Queue (DLQ)** pattern at the gateway layer using Redis and TypeBox/Zod validation.

## Rationale
1. **Fault Isolation:** Instead of dropping malformed logs or crashing the main process, invalid payloads are caught by the schema validator and diverted to a secondary Redis list (`logs:dead_letter`).
2. **System Stability:** The main database worker only ever consumes guaranteed, schema-validated data from the primary stream, ensuring zero runtime crashes during database inserts.
3. **Debuggability:** Developers can inspect the DLQ to identify which upstream service is violating the logging contract.

## Consequences
* **Positive:** Bulletproof database ingestion.
* **Negative:** Introduces a secondary queue that must be monitored and periodically purged to prevent Redis memory bloat.
