# @ebarahona/loopback-openapi-v3

OpenAPI version compatibility enhancer for LoopBack 4. Transforms LoopBack-generated OpenAPI 3.0 specs into OAS 3.1 or 3.2 at boot, handles nullable conversion both ways, and emits structured warnings for lossy downgrades.

```bash
npm install @ebarahona/loopback-openapi-v3
```

> Part of the [`@ebarahona/loopback-*` plugin portfolio](https://github.com/ebarahona/loopback-plugins). See the [portfolio roadmap](https://github.com/ebarahona/loopback-plugins/blob/main/ROADMAP.md) for sibling plugins (`loopback-connector-mongodb`, `loopback-transport-core`, planned `loopback-graphql`) and the shared infrastructure they use.

LoopBack 4 emits OpenAPI 3.0 by default. This component registers an OAS Enhancer that runs during spec generation and rewrites the document to the target version. Upgrades convert `{type, nullable}` to `{type: [type, 'null']}` and emit 3.1+ idioms. Downgrades strip fields that have no 3.0 equivalent and emit a `TransformWarning` for each one. The enhancer is pure and deterministic, so LoopBack's spec cache reuses the result on subsequent requests.

## What This Provides

| Export                                | Purpose                                                                |
| ------------------------------------- | ---------------------------------------------------------------------- |
| `OpenApiVersionComponent`             | LoopBack 4 component that registers the enhancer                       |
| `OpenApiVersionEnhancer`              | OAS Enhancer wired into `@loopback/openapi-v3` spec generation         |
| `OpenApiVersionBindings`              | Typed `BindingKey` namespace (`CONFIG`)                                |
| `OpenApiVersion`                      | Version literal type (`'3.0.0' \| '3.1.0' \| '3.2.0'`)                 |
| `OpenApiVersionConfig`                | Component config type (target version, nullable transform flag)        |
| `transformOpenApiSpec(spec, config?)` | Pure transform function, usable outside LoopBack                       |
| `parseVersion(version)`               | Parses `'3.1.0'` into `{major, minor, patch}`                          |
| `TransformResult`                     | `{spec, warnings}` returned by `transformOpenApiSpec`                  |
| `TransformWarning`                    | Structured warning describing a stripped or rewritten field            |
| `OpenApiVersionError`                 | Base class for every error thrown by this package                      |
| `OpenApiVersionConfigError`           | Thrown when component config is invalid                                |
| `OpenApiTransformError`               | Thrown when the input spec cannot be transformed                       |
| `OpenApiDowngradeError`               | Thrown when a downgrade target cannot represent required source fields |

## Install

```bash
npm install @ebarahona/loopback-openapi-v3
```

## Usage

### Component path (recommended)

```typescript
import {RestApplication} from '@loopback/rest';
import {
  OpenApiVersionComponent,
  OpenApiVersionBindings,
} from '@ebarahona/loopback-openapi-v3';

const app = new RestApplication();
app.component(OpenApiVersionComponent);
app.bind(OpenApiVersionBindings.CONFIG).to({
  version: '3.1.0',
  transformNullable: true,
});
```

The spec served at `/openapi.json` is rewritten to `"openapi": "3.1.0"`, with nullable fields converted to type arrays. LoopBack caches the transformed spec; the enhancer does not re-run per request.

### Pure-function path (standalone)

`transformOpenApiSpec` is exported for use outside a LoopBack application (build-time tooling, tests, fixture generation):

```typescript
import {transformOpenApiSpec} from '@ebarahona/loopback-openapi-v3';

const {spec, warnings} = transformOpenApiSpec(inputSpec, {
  version: '3.1.0',
});

for (const w of warnings) {
  console.warn(`[${w.field}] ${w.message}`);
}
```

The input spec is deep-cloned with `structuredClone`; the original is never mutated.

## Configuration

`OpenApiVersionBindings.CONFIG` accepts an `OpenApiVersionConfig`:

| Field               | Type                            | Default   | Purpose                                                                                                |
| ------------------- | ------------------------------- | --------- | ------------------------------------------------------------------------------------------------------ |
| `version`           | `'3.0.0' \| '3.1.0' \| '3.2.0'` | `'3.0.0'` | Target OAS version. `'3.0.0'` is a no-op pass-through.                                                 |
| `transformNullable` | `boolean`                       | `true`    | Rewrite `{type, nullable: true}` to `{type: [type, 'null']}` on upgrade, and the reverse on downgrade. |

Invalid configurations (unrecognized version, non-boolean flag) throw `OpenApiVersionConfigError` synchronously when the component binds.

## Supported versions

| Version | Status        | Spec                                                                      |
| ------- | ------------- | ------------------------------------------------------------------------- |
| 3.0.0   | Default no-op | [spec.openapis.org/oas/v3.0.3](https://spec.openapis.org/oas/v3.0.3.html) |
| 3.1.0   | Supported     | [spec.openapis.org/oas/v3.1.0](https://spec.openapis.org/oas/v3.1.0.html) |
| 3.2.0   | Supported     | [spec.openapis.org/oas/v3.2.0](https://spec.openapis.org/oas/v3.2.0.html) |

### Upgrades (3.0 -> 3.1 / 3.2)

- `nullable: true` rewritten to type arrays (`{type: ['string', 'null']}`).
- Handles nullable combined with `oneOf`, `anyOf`, `allOf`, and schemas without an explicit `type`.

### Downgrades (3.2 -> 3.0 / 3.1)

Downgrades are lossy. Features that have no equivalent in lower versions are stripped, and a `TransformWarning` is emitted for each one.

**3.1 features stripped when targeting 3.0:**

| Feature                 | Field                                          |
| ----------------------- | ---------------------------------------------- |
| JSON Schema dialect     | `jsonSchemaDialect`                            |
| Webhooks                | `webhooks`                                     |
| Reusable path items     | `components.pathItems`                         |
| SPDX license identifier | `info.license.identifier`                      |
| Type arrays             | `type: ['string', 'null']` -> `nullable: true` |

**3.2 features stripped when targeting 3.0 or 3.1:**

| Feature                 | Field                                         |
| ----------------------- | --------------------------------------------- |
| Document identity       | `$self`                                       |
| Server name             | `servers[].name`                              |
| QUERY HTTP method       | `paths.*.query`                               |
| Additional HTTP methods | `paths.*.additionalOperations`                |
| Tag nesting             | `tags[].summary`, `.parent`, `.kind`          |
| Querystring parameter   | `parameters[].in: 'querystring'` -> `'query'` |
| OAuth2 device flow      | `securitySchemes.*.flows.device`              |
| SSE streaming schema    | `content.*.itemSchema`                        |
| SSE streaming encoding  | `content.*.itemEncoding`, `.prefixEncoding`   |
| Example formats         | `examples.*.dataValue`, `.serializedValue`    |
| Reusable media types    | `components.mediaTypes`                       |
| XML text nodes          | `xml.text`                                    |

When a required source field cannot be expressed in the target version (for example a 3.2 spec that depends on `$self` referenced elsewhere in the document), the transform raises `OpenApiDowngradeError` instead of silently dropping the reference.

## Typed errors

This package throws four typed error classes, all derived from `OpenApiVersionError`. Catch the base class for a category check, or the specific subclass for fine-grained handling.

- `OpenApiVersionError`: abstract base. Every error thrown by this package extends it.
- `OpenApiVersionConfigError`: invalid component configuration. Thrown synchronously when the component binds or when `transformOpenApiSpec` is called with an unsupported target version.
- `OpenApiTransformError`: input spec is structurally invalid (missing `openapi` field, unparseable version string, cyclic schema references).
- `OpenApiDowngradeError`: a downgrade target cannot represent a load-bearing source field. The error includes the offending field path and the source/target version pair.

## Stability

Every export listed in [What This Provides](#what-this-provides) is tagged `@public` from v1.0 onward. The public-API surface is audited by the `/lb4-public-api-audit` skill before every release; experimental additions are tagged `@experimental` until at least one real consumer has exercised the surface.

## Requirements

- Node.js >= 20.19.0 (for `structuredClone` and the package's engines field)
- LoopBack 4 application

Peer dependencies: `@loopback/core` (>=7.0.0 <8.0.0), `@loopback/openapi-v3` (>=11.0.0 <12.0.0), `@loopback/rest` (>=15.0.0 <16.0.0).

## Spec references

- [OpenAPI 3.0.3](https://spec.openapis.org/oas/v3.0.3.html)
- [OpenAPI 3.1.0](https://spec.openapis.org/oas/v3.1.0.html)
- [OpenAPI 3.2.0](https://spec.openapis.org/oas/v3.2.0.html)
- [OpenAPI Specification Repository](https://github.com/OAI/OpenAPI-Specification)

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). Help-wanted topics with measurable acceptance criteria are listed in [HELP_WANTED.md](HELP_WANTED.md).

## License

MIT
