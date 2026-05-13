# @ebarahona/loopback-openapi-v3

LoopBack 4 component for OpenAPI 3.1 and 3.2 spec generation.

LoopBack 4 generates OpenAPI 3.0 specs by default. This component transforms the output to 3.1 or 3.2, enabling JSON Schema compatibility (3.1) and SSE streaming support (3.2).

## Install

```bash
npm install @ebarahona/loopback-openapi-v3
```

## Usage

```typescript
import {OpenApiVersionComponent} from '@ebarahona/loopback-openapi-v3';

const app = new RestApplication();
app.component(OpenApiVersionComponent);
app.bind('openapi-version.config').to({version: '3.1.0'});
```

The spec served at `/openapi.json` will output `"openapi": "3.1.0"`.

## Configuration

```typescript
app.bind('openapi-version.config').to({
  // Target version: '3.0.0' (default, no-op), '3.1.0', or '3.2.0'
  version: '3.1.0',

  // Transform nullable fields from 3.0 format to 3.1+ format
  // { type: 'string', nullable: true } -> { type: ['string', 'null'] }
  // Defaults to true for 3.1+
  transformNullable: true,
});
```

## What It Does

The component registers an OAS Enhancer that runs once at boot after LoopBack assembles the spec. It:

1. Updates the `openapi` version field
2. Transforms `nullable: true` to type arrays (3.1+ format)
3. Recursively processes all schemas in components, paths, parameters, request bodies, and responses

No per-request overhead. The transformed spec is cached by LoopBack.

## Supported Versions

| Version | Status | Key Feature |
|---|---|---|
| 3.0.0 | Default (no-op) | Backward compatible |
| 3.1.0 | Supported | JSON Schema Draft 2020-12 superset |
| 3.2.0 | Supported | SSE streaming (itemSchema), tag nesting |

## Requirements

- LoopBack 4 (`@loopback/core` >= 6.0.0)
- `@loopback/openapi-v3` >= 10.0.0
- `@loopback/rest` >= 14.0.0
- Node.js >= 18

## License

MIT
