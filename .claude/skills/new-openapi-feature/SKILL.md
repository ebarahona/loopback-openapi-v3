---
name: new-openapi-feature
description: Scaffold a new OpenAPI v3 transformation feature end-to-end. Use when adding a capability such as a new spec transformer, a new field strip/upgrade rule, or a new compatibility downgrade. Generates the transformer code, the unit test, and the integration test, all marked @experimental.
---

# new-openapi-feature

Scaffold a new transformation capability for `@ebarahona/loopback-openapi-v3` across the files where it must land: the transform module, its unit test, and one integration test that boots the full LB4 application.

## Plugin architecture (read this first)

This plugin ships a single OAS Enhancer registered through `@loopback/openapi-v3`'s spec-enhancer extension point:

- `OpenApiVersionEnhancer` (in `src/openapi-version.enhancer.ts`) implements `OASEnhancer` and is bound via `asSpecEnhancer` in `OpenApiVersionComponent` (`src/openapi-version.component.ts`).
- LoopBack calls `modifySpec(spec)` during OpenAPI spec assembly. The enhancer delegates to the pure function `transformOpenApiSpec()` in `src/transform.ts`.
- `transformOpenApiSpec()` is the contract surface: input is an OpenAPI 3.0 / 3.1 / 3.2 document, output is the same document mutated to the configured `version` target with a `warnings[]` array describing every lossy transformation.

Two transformation directions exist and the new feature must declare which it belongs to:

- **Upgrade** - 3.0 -> 3.1 / 3.2. Lossless. Examples: `upgradeNullable()` rewrites `{type: 'string', nullable: true}` to `{type: ['string', 'null']}`.
- **Downgrade** - 3.2 / 3.1 -> 3.0. Lossy. Must emit a `TransformWarning` once per unique `field:message` via `warnOnce()`. Examples: `strip31Features()`, `strip32Features()`.

All feature stripping is gated by version comparison (`sourceMinor`, `targetMinor`). Never strip blindly.

## Ask

Collect four answers from the contributor before writing anything:

1. **Feature name** - `lowerCamelCase`, used as the helper function name in `src/transform.ts` (e.g. `stripExtensions`, `upgradeExamples`).
2. **One-sentence description** - for the JSDoc.
3. **Direction** - `upgrade` (3.0 -> 3.1+, lossless) or `downgrade` (3.1+ -> 3.0 or 3.2 -> 3.1/3.0, lossy with warnings).
4. **Scope** - `spec-level` (touches top-level keys like `webhooks`, `jsonSchemaDialect`), `schema-level` (walks every schema via `walkAllSchemas()`), or `operation-level` (walks every operation via `forEachOperation()`).

If any answer is missing, ask. Don't guess.

## Read

- `src/transform.ts` to know the helper layout, traversal helpers (`walkAllSchemas`, `forEachOperation`), and warning conventions (`warnOnce`, `TransformWarning`).
- `src/openapi-version.enhancer.ts` to see how `transformOpenApiSpec()` is wired into the enhancer.
- `src/openapi-version.component.ts` to confirm the `asSpecEnhancer` registration.
- `src/types.ts` and `src/keys.ts` if the feature needs a new config flag or a new binding.
- `src/index.ts` to confirm the current public surface and stability conventions.
- One existing spec under `src/__tests__/` (`transform.spec.ts` for unit shape, `openapi-version.enhancer.spec.ts` for integration shape).
- LoopBack's [`loopback-core` skill](https://github.com/loopbackio/loopback-next/tree/master/skills/loopback-core), specifically its `references/extension-points-and-extensions.md` and `references/context-and-bindings.md`, before adding a new `BindingKey` / Provider or wiring an additional enhancer. Defer to that for the canonical framework patterns; use this skill only for the plugin-author conventions (stability tags, transform helper shape, warning idiom).

## Edit

### 1. `src/transform.ts`

Add the helper under the matching section comment:

- Upgrade transformer -> under `// -- Nullable transforms --` block style, before downgrade helpers.
- Spec-level downgrade -> inside `strip31Features` or `strip32Features` (or a new `strip<N>Features` if the feature is large enough to warrant its own section).
- Schema-level transformer -> a new function that takes the visitor signature `(s: Obj) => void` and is invoked from `walkAllSchemas(spec, visitor)`.
- Operation-level transformer -> a new function invoked from `forEachOperation(spec, visitor)`.

Helper shape:

```typescript
/**
 * <one-sentence description>.
 *
 * @experimental
 */
function <featureName>(
  spec: Obj,
  warnings: TransformWarning[],
  seen: Set<string>,
): void {
  // ...
}
```

Wire the new helper into `transformOpenApiSpec()` under the matching version-gate branch (`if (targetMinor < 2 && sourceMinor >= 2)`, etc.). Never call the helper unconditionally.

For downgrades, every removed or rewritten field must call `warnOnce(warnings, seen, '<dot.path>', '<reason because target version is 3.X.x>')`. Match the existing warning phrasing.

If the feature is large (> ~80 lines), pull it into a new file under `src/transformers/<feature-name>.ts` and import it from `transform.ts`. Keep `transform.ts` focused on the orchestration sequence.

### 2. `src/types.ts` (only if the feature exposes a new config flag)

Add a boolean option to `OpenApiVersionConfig` with TSDoc and `@experimental`. Default it in `DEFAULT_CONFIG` so existing consumers are unaffected. The flag follows the existing `transformNullable?: boolean` pattern: opt-out via `=== false`, default behavior is the new feature enabled.

### 3. `src/keys.ts` (only if the feature exposes a new injectable)

Add a `BindingKey` under `OpenApiVersionBindings` with TSDoc and `@experimental`. Type-only import the target type. Wire it from `OpenApiVersionComponent.bindings` if the feature needs a provider.

### 4. `src/index.ts` (only if the feature adds a public symbol)

Re-export the new symbol with `export type { ... }` if it's type-only. New exports default to `@experimental` per STYLE_GUIDE §9 until they have field exposure.

### 5. `src/__tests__/<feature-name>.spec.ts`

Two layers, both in the same file or split per convention of existing specs.

**Unit layer** - call `transformOpenApiSpec()` directly with a small synthetic spec:

```typescript
import {describe, it, expect} from 'vitest';
import {transformOpenApiSpec} from '../transform';

describe('<featureName>', () => {
  it('<happy path assertion>', () => {
    const result = transformOpenApiSpec(
      {openapi: '3.X.0', /* minimal spec */},
      {version: '3.Y.0'},
    );
    expect(result.spec.<field>).toBe(<expected>);
  });

  // For downgrades only:
  it('emits a warning when stripping <field>', () => {
    const result = transformOpenApiSpec(
      {openapi: '3.2.0', /* with the lossy field */},
      {version: '3.0.0'},
    );
    expect(result.warnings).toContainEqual(
      expect.objectContaining({field: '<dot.path>'}),
    );
  });
});
```

**Integration layer** - boot a real LB4 application with `OpenApiVersionComponent` and assert the assembled spec was transformed by the enhancer:

```typescript
import {Application} from '@loopback/core';
import {RestComponent} from '@loopback/rest';
import {OpenApiVersionComponent, OpenApiVersionBindings} from '..';

const app = new Application();
app.component(RestComponent);
app.component(OpenApiVersionComponent);
app.bind(OpenApiVersionBindings.CONFIG).to({version: '3.1.0'});

await app.boot();
const spec = await app.getServer(RestServer).getApiSpec();
expect(spec.openapi).toBe('3.1.0');
// + assertion specific to the new feature
```

Use `vitest`'s `describe` / `it` / `beforeAll` / `afterAll`. Match the layout of `openapi-version.enhancer.spec.ts`.

## Verify

After editing, run:

```bash
npm run lint
npm run build
```

The build must compile. If it doesn't, the scaffold is wrong - fix it before reporting.

Do NOT run `npm test` from this skill if the unit test is a stub asserting on an unimplemented helper; the test is expected to fail until the contributor fills in the body. If both layers are complete and exercising real logic, running `npm test` here is fine.

## Report

Output:

- Files created / modified, one line each.
- The next steps for the contributor: fill in any TODO stubs, verify both unit and integration tests pass, run `pre-pr-check` before opening a PR.
- A reminder that the feature is marked `@experimental` and should stay that way until the transformer has been validated against at least one real-world OpenAPI document (a downstream consumer's spec or a published reference spec such as Stripe's).
