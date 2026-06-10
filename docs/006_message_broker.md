# ADR 006: BullMQ over Raw Redis for Job Queuing

**Date:** 2026-05-26
**Status:** Accepted

## Context
Our ingestion gateway routes log data to a background worker for database insertion. Raw Redis lists (`LPUSH`/`RPOP`) lack built-in retry mechanisms, rate limiting, and failure handling, risking data loss if the worker crashes mid-process.

## Decision
We will use **BullMQ** (which runs on top of Redis) as our message broker abstraction.

## Rationale
1. **Resilience:** BullMQ natively handles job retries, backoffs, and stalled job recovery, ensuring no log is lost during worker downtime.
2. **Built-in DLQ:** BullMQ automatically moves repeatedly failing jobs into a "failed" status, natively giving us the Dead Letter Queue behavior we designed in ADR 004.
3. **Developer Velocity:** Abstracting raw Redis commands saves hours of boilerplate code for queue management.

## Consequences
* **Positive:** Enterprise-grade queue resilience.
* **Negative:** Slightly higher memory overhead in Redis, and we must learn BullMQ's specific API rather than standard Redis commands.
