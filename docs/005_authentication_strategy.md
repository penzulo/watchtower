# ADR 005: Better-Auth & SQLite for Identity Management

**Date:** 2026-05-26
**Status:** Accepted

## Context
Project WatchTower requires authentication and user session management. We want a robust, pre-built solution without introducing heavy relational database dependencies (like PostgreSQL) strictly for user data, as our main storage (ClickHouse) is heavily optimized for logs, not relational user tables.

## Decision
We will use **Better-Auth** backed by a local **SQLite** database (`bun:sqlite`).

## Rationale
1. **Separation of Concerns:** Keeping user accounts in SQLite isolates identity data from massive log telemetry in ClickHouse.
2. **Speed & Simplicity:** Better-Auth works out-of-the-box with Bun and SQLite, requiring zero external services or complex schema migrations to get started. 
3. **No Network Overhead:** SQLite runs entirely in-memory/on-disk alongside the Bun process, making auth checks virtually instantaneous.

## Consequences
* **Positive:** Fast, secure, and isolated authentication.
* **Negative:** SQLite on a single VPS makes horizontal scaling of the API gateway slightly more complex in the future (though a non-issue for the current MVP).
