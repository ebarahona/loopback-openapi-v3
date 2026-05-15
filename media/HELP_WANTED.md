# Help Wanted

This project ships an OpenAPI 3.x compatibility enhancer, but conformance
coverage, performance baselines, and reverse-direction tooling all have
gaps. Contributions on the topics below have outsize value: they turn a
working transform into a verifiable one.

## Conformance test corpus

Directory: `src/__tests__/conformance/`

Current state:

- A handful of hand-rolled fixtures cover the most common nullable and
  downgrade cases
- No automated validation against the published OAS 3.1 / 3.2 JSON
  Schemas

Needed:

- Vendor the published [OpenAPI 3.1](https://spec.openapis.org/oas/v3.1.0.html)
  and 3.2 JSON Schemas into `src/__tests__/conformance/schema/`
- Validate every transform output against the target version's schema
  with `ajv` (already a dev dep candidate)
- Cover the canonical examples from `OAI/OpenAPI-Specification` for each
  version, transformed in every direction

## Performance baseline for large specs

Directory: `bench/`

Current state:

- No benchmarks; no published numbers

Needed:

- Spec fixtures with 100, 500, 1000, and 5000 paths
- Benchmarks for upgrade (3.0 -> 3.1, 3.0 -> 3.2) and downgrade
  (3.2 -> 3.0, 3.1 -> 3.0)
- Heap-delta measurement for the cloned working spec, since
  `structuredClone` is the dominant cost for large inputs
- A published baseline JSON in `bench/baseline.json` so PRs can detect
  regressions via CI

## Round-trip fidelity

Directory: `src/__tests__/round-trip/`

Current state:

- Forward transforms are tested in isolation; round-trip stability is
  not asserted

Needed:

- For every fixture in the conformance corpus, assert that
  3.0 -> 3.1 -> 3.0 produces a document semantically equivalent to the
  original (modulo documented lossy fields)
- A diff helper that knows about the documented lossy fields and ignores
  them when comparing round-tripped specs
- Failure output that pinpoints the first divergence rather than
  dumping the whole document

## OAS 3.2 feature coverage

Reference: [spec.openapis.org/oas/v3.2.0](https://spec.openapis.org/oas/v3.2.0.html)

Current state:

- Downgrade strips the documented 3.2 features
- Upgrade from 3.1 to 3.2 is a near no-op; the new 3.2 idioms (webhooks
  fan-out, oneOf inheritance via `$dynamicRef`, querystring parameters,
  reusable media types) are not actively emitted

Needed, as the 3.2 spec stabilizes:

- Emit `paths.*.query` and `paths.*.additionalOperations` when source
  3.1 documents declare the equivalent via extension fields
- Synthesize `components.mediaTypes` for repeated content blocks
- Translate `parameters[].in: 'query'` to `'querystring'` where the
  3.2 stylization is preferred

Spec stability is a hard prerequisite; track [OAI/OpenAPI-Specification
issues](https://github.com/OAI/OpenAPI-Specification/issues) tagged
`3.2.0` before landing.

## `transformOpenApiClient` reverse helper

Module: `src/transform-client.ts` (new)

Current state:

- The package transforms server-side specs; consumer-side tooling that
  needs 3.0 from a 3.1+ source has to roll its own downgrade

Needed:

- A `transformOpenApiClient(spec, config)` helper specialized for the
  client-generation case: stricter than `transformOpenApiSpec` about
  schema fidelity, deliberately lossy about server-only fields
  (`webhooks`, `$self`, etc.)
- Targeted warnings that call out fields a code generator would have
  used but no longer can
- Shared internals with `transformOpenApiSpec` so the downgrade table
  stays in one place

## How to contribute

1. Pick one item from the list above.
2. Open an issue describing your approach so we can align scope.
3. Submit a PR following [CONTRIBUTING.md](./CONTRIBUTING.md).
4. Performance PRs must include: methodology, raw numbers, hardware
   spec (CPU, RAM, Node version, OS), and at least 5 runs to demonstrate
   stability.
