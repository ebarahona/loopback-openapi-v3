# @ebarahona/loopback-openapi-v3

OpenAPI version compatibility enhancer for LoopBack 4. Supports emitting OpenAPI Specification (OAS) 3.0.x, 3.1.x, and 3.2.x specs from LoopBack-generated OpenAPI output, with nullable conversion and lossy downgrade diagnostics.

LoopBack 4 generates OpenAPI 3.0 specs by default. This component transforms the output to OpenAPI 3.1 or 3.2, enabling JSON Schema compatibility (3.1) and SSE streaming support (3.2). It also handles downgrading from higher versions to lower ones for backward compatibility.

## Install

```bash
npm install @ebarahona/loopback-openapi-v3
```

## Usage

```typescript
import {OpenApiVersionComponent, OpenApiVersionBindings} from '@ebarahona/loopback-openapi-v3';

const app = new RestApplication();
app.component(OpenApiVersionComponent);
app.bind(OpenApiVersionBindings.CONFIG).to({version: '3.1.0'});
```

The spec served at `/openapi.json` will output `"openapi": "3.1.0"`.

## Configuration

```typescript
app.bind(OpenApiVersionBindings.CONFIG).to({
  // Target version: '3.0.0' (default, no-op), '3.1.0', or '3.2.0'
  version: '3.1.0',

  // Transform nullable fields from 3.0 format to 3.1+ format
  // { type: 'string', nullable: true } -> { type: ['string', 'null'] }
  // Defaults to true for 3.1+
  transformNullable: true,
});
```

## Supported Versions

| Version | Status | Spec |
|---|---|---|
| 3.0.0 | Default (no-op) | [spec.openapis.org/oas/v3.0.3](https://spec.openapis.org/oas/v3.0.3.html) |
| 3.1.0 | Supported | [spec.openapis.org/oas/v3.1.0](https://spec.openapis.org/oas/v3.1.0.html) |
| 3.2.0 | Supported | [spec.openapis.org/oas/v3.2.0](https://spec.openapis.org/oas/v3.2.0.html) |

## How It Works

The component registers an OAS Enhancer that runs once at boot after LoopBack assembles the spec. The original spec is deep-cloned to prevent mutation. The transformed spec is cached by LoopBack and served on subsequent requests without re-processing.

### Upgrades (3.0 -> 3.1/3.2)

- `nullable: true` transformed to type arrays (`{ type: ['string', 'null'] }`)
- Handles nullable with `oneOf`, `anyOf`, `allOf`, and no type

### Downgrades (3.2 -> 3.0/3.1)

Downgrades are lossy. Features that have no equivalent in lower versions are stripped with diagnostic warnings.

**3.1 features stripped when targeting 3.0:**

| Feature | Field |
|---|---|
| JSON Schema dialect | `jsonSchemaDialect` |
| Webhooks | `webhooks` |
| Reusable path items | `components.pathItems` |
| SPDX license identifier | `info.license.identifier` |
| Type arrays | `type: ['string', 'null']` reverted to `nullable: true` |

**3.2 features stripped when targeting 3.0 or 3.1:**

| Feature | Field |
|---|---|
| Document identity | `$self` |
| Server name | `servers[].name` |
| QUERY HTTP method | `paths.*. query` |
| Additional HTTP methods | `paths.*.additionalOperations` |
| Tag nesting | `tags[].summary`, `.parent`, `.kind` |
| Querystring parameter | `parameters[].in: 'querystring'` converted to `'query'` |
| OAuth2 device flow | `securitySchemes.*.flows.device` |
| SSE streaming schema | `content.*.itemSchema` |
| SSE streaming encoding | `content.*.itemEncoding`, `.prefixEncoding` |
| Example formats | `examples.*.dataValue`, `.serializedValue` |
| Reusable media types | `components.mediaTypes` |
| XML text nodes | `xml.text` |

### Diagnostics

The transformer emits warnings for every stripped feature:

```typescript
import {transformOpenApiSpec} from '@ebarahona/loopback-openapi-v3';

const {spec, warnings} = transformOpenApiSpec(inputSpec, {version: '3.0.0'});
for (const w of warnings) {
  console.log(`[${w.field}] ${w.message}`);
}
// [webhooks] Removed webhooks because target version is 3.0.x (webhooks require 3.1+)
// [$self] Removed $self because target version is 3.0.x
```

### Pure Function API

The transformer is available as a standalone pure function for use outside LoopBack:

```typescript
import {transformOpenApiSpec, parseVersion} from '@ebarahona/loopback-openapi-v3';

const {spec, warnings} = transformOpenApiSpec(inputSpec, {version: '3.1.0'});
```

## Requirements

- Node.js >= 18 (for `structuredClone`)
- LoopBack 4 (`@loopback/core` >= 7.0.0)
- `@loopback/openapi-v3` >= 11.0.0
- `@loopback/rest` >= 15.0.0

## Spec References

- [OpenAPI 3.0.3](https://spec.openapis.org/oas/v3.0.3.html)
- [OpenAPI 3.1.0](https://spec.openapis.org/oas/v3.1.0.html)
- [OpenAPI 3.2.0](https://spec.openapis.org/oas/v3.2.0.html)
- [OpenAPI Specification Repository](https://github.com/OAI/OpenAPI-Specification)

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

MIT
