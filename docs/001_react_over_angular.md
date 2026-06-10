# ADR 001: React over Angular for Frontend UI

**Date:** 2026-06-10  
**Status:** Accepted

## Context

Watchtower is a real-time observability dashboard that ingests high-volume logs via
Server-Sent Events (SSE). The UI must handle thousands of DOM nodes without jitter,
support complex state across two modes (live streaming vs. historical querying), and
ship as a polished resume project with clean architectural documentation.

Two candidates were evaluated: React (with TanStack Query) and Angular (v17+).

## Decision

We will use **React** with **TanStack Query** for the frontend.

## Rationale

1. **Familiarity and execution speed:** React is the framework I know best. For a
   solo resume project, shipping a complete, well-reasoned product matters more than
   using an unfamiliar framework as a learning exercise. Angular's DI system, zone.js,
   and template syntax would add friction orthogonal to the core engineering challenges
   (SSE ingestion, log virtualization, state management).

2. **TanStack Query handles both data modes cleanly:** Historical log queries map
   directly to `useInfiniteQuery` for cursor-based pagination. Live SSE streams can
   be integrated into the query cache via `queryClient.setQueryData`, giving a single
   mental model for both modes rather than two separate data-fetching strategies.

3. **Virtual scrolling is a solved problem in React:** Libraries like TanStack Virtual
   handle 10,000+ in-memory log rows without layout thrash. This is not a meaningful
   differentiator for Angular's CDK.

4. **Ecosystem fit:** Component libraries (shadcn/ui, Radix), data grid options
   (AG Grid's React wrapper is first-class), and tooling are all mature and
   well-documented in the React ecosystem.

## Rejected Alternative: Angular

Angular's RxJS-native model is genuinely well-suited for stream processing pipelines.
However, RxJS introduces significant abstraction overhead for a solo developer, and
the same streaming behavior is achievable in React without it. The productivity cost
of learning Angular's templating system and Signals model during active development
outweighs the architectural benefits for this project's scope.

## Consequences

- **Positive:** Faster development velocity due to existing familiarity with React
  and TanStack Query.
- **Positive:** Access to the full React ecosystem — shadcn/ui, TanStack Virtual,
  AG Grid React — without adapter friction.
- **Neutral:** SSR via TanStack Start is available but not a primary driver;
  Watchtower is auth-gated so SEO is irrelevant. Server functions and type-safe
  routing are the more meaningful wins if TanStack Start is adopted.
- **Negative:** Loses the RxJS operator pipeline model for stream composition.
  Observable chains (`filter`, `bufferTime`, `distinctUntilChanged`) are more
  expressive than equivalent imperative React code for complex stream transformations.
