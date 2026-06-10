# ADR 002: Elysia over Hono for API Gateway

**Date:** 2026-05-26
**Status:** Accepted

## Context
Our ingestion gateway needs to handle extremely high-throughput asynchronous log streams, parse incoming JSON, enforce strict schemas, and stream Server-Sent Events (SSE) to the frontend. We require a framework natively optimized for the Bun runtime. 

## Decision
We will use **Elysia** as our backend framework instead of Hono or Express.

## Rationale
1. **Bun Native Synergy:** Elysia is built from the ground up for Bun, extracting maximum raw throughput and speed.
2. **Developer Experience (DX):** The Context API and middleware chaining feel intuitive and provide clean abstraction layers for our hot/cold path routing.
3. **End-to-End Type Safety:** Using Elysia's Eden Treaty allows us to share TypeScript types directly with the frontend client without the heavy boilerplate of GraphQL or tRPC.

## Consequences
* **Positive:** Blistering fast JSON serialization and request resolution.
* **Positive:** Built-in TypeBox support makes schema validation and Dead Letter Queue routing trivial.
* **Negative:** Elysia is a newer framework; the community and third-party plugin ecosystem are smaller compared to legacy node frameworks.
