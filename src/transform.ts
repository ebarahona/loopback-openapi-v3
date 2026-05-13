import {OpenApiVersion, OpenApiVersionConfig, DEFAULT_CONFIG} from './types';

// Internal type for untyped spec traversal.
interface Obj {
  [key: string]: unknown;
}

/**
 * Parse and validate an OpenAPI version string.
 * Throws if the version is not a supported format.
 */
export function parseVersion(version: string): {major: number; minor: number; patch: number} {
  const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(version);
  if (!match) {
    throw new Error(
      `Invalid OpenAPI version: "${version}". Expected format: "3.x.x"`,
    );
  }
  const [, major, minor, patch] = match.map(Number);
  if (major !== 3) {
    throw new Error(
      `Unsupported OpenAPI major version: ${major}. Only version 3.x is supported.`,
    );
  }
  return {major, minor, patch};
}

/**
 * Transform an OpenAPI spec from its current version to the target version.
 *
 * Deep-clones the spec to prevent mutation of the original.
 * Handles upgrades (3.0 -> 3.1/3.2) and compatibility downgrades
 * (3.2 -> 3.0/3.1).
 *
 * Note: downgrades are lossy. Features that exist in higher versions
 * but have no equivalent in lower versions are stripped. This is a
 * compatibility downgrade, not exact semantic preservation.
 */
export function transformOpenApiSpec(
  spec: Obj,
  config: OpenApiVersionConfig = DEFAULT_CONFIG,
): Obj {
  const sourceVersion = parseVersion(spec.openapi as string);
  const targetVersion = parseVersion(config.version);

  // Deep clone to prevent mutation of the original spec
  const out = structuredClone(spec);
  out.openapi = config.version;

  const sourceMinor = sourceVersion.minor;
  const targetMinor = targetVersion.minor;

  if (sourceMinor === targetMinor) {
    return out;
  }

  // 3.0 -> 3.1+: upgrade nullable
  if (config.transformNullable !== false && targetMinor >= 1 && sourceMinor < 1) {
    upgradeNullable(out);
  }

  // 3.1+ -> 3.0: downgrade nullable
  if (targetMinor < 1 && sourceMinor >= 1) {
    downgradeNullable(out);
  }

  // Strip 3.2 features when targeting 3.0 or 3.1
  if (targetMinor < 2 && sourceMinor >= 2) {
    strip32Features(out);
  }

  return out;
}

// -------------------------------------------------------------------
// Nullable transforms
// -------------------------------------------------------------------

/**
 * 3.0 -> 3.1+: nullable upgrade
 *
 * Handles:
 * - { type: 'string', nullable: true } -> { type: ['string', 'null'] }
 * - { nullable: true, oneOf: [...] } -> { oneOf: [..., { type: 'null' }] }
 * - { nullable: true, anyOf: [...] } -> { anyOf: [..., { type: 'null' }] }
 * - { nullable: true, allOf: [...] } -> { anyOf: [{ allOf: [...] }, { type: 'null' }] }
 * - { nullable: true } (no type) -> { type: 'null' } or adds null to composition
 */
function upgradeNullable(spec: Obj): void {
  walkAllSchemas(spec, (s: Obj) => {
    if (s.nullable !== true) return;

    delete s.nullable;

    if (typeof s.type === 'string') {
      // Simple case: { type: 'string', nullable: true }
      s.type = [s.type, 'null'];
    } else if (Array.isArray(s.oneOf)) {
      // { nullable: true, oneOf: [...] } -> append { type: 'null' }
      (s.oneOf as Obj[]).push({type: 'null'});
    } else if (Array.isArray(s.anyOf)) {
      // { nullable: true, anyOf: [...] } -> append { type: 'null' }
      (s.anyOf as Obj[]).push({type: 'null'});
    } else if (Array.isArray(s.allOf)) {
      // { nullable: true, allOf: [...] } -> wrap in anyOf
      const allOf = s.allOf;
      delete s.allOf;
      s.anyOf = [{allOf}, {type: 'null'}];
    } else {
      // No type or composition: just set type to null
      s.type = 'null';
    }
  });
}

/**
 * 3.1+ -> 3.0: nullable downgrade
 *
 * Handles:
 * - { type: ['string', 'null'] } -> { type: 'string', nullable: true }
 * - { oneOf: [..., { type: 'null' }] } -> { nullable: true, oneOf: [...] }
 * - { anyOf: [..., { type: 'null' }] } -> { nullable: true, anyOf: [...] }
 */
function downgradeNullable(spec: Obj): void {
  walkAllSchemas(spec, (s: Obj) => {
    // Type array with null
    if (Array.isArray(s.type)) {
      const types = s.type as string[];
      if (types.includes('null')) {
        const nonNull = types.filter(t => t !== 'null');
        s.type = nonNull.length === 1 ? nonNull[0] : nonNull;
        s.nullable = true;
      }
    }

    // oneOf/anyOf with { type: 'null' } member
    for (const key of ['oneOf', 'anyOf'] as const) {
      if (!Array.isArray(s[key])) continue;
      const arr = s[key] as Obj[];
      const nullIdx = arr.findIndex(
        item => typeof item === 'object' && item !== null &&
          Object.keys(item).length === 1 && item.type === 'null',
      );
      if (nullIdx !== -1) {
        arr.splice(nullIdx, 1);
        s.nullable = true;
        // Unwrap single-element arrays
        if (arr.length === 1) {
          const remaining = arr[0];
          delete s[key];
          Object.assign(s, remaining);
        }
      }
    }
  });
}

// -------------------------------------------------------------------
// 3.2 feature stripping
// -------------------------------------------------------------------

function strip32Features(spec: Obj): void {
  // Root-level 3.2 fields
  delete spec.$self;
  delete spec.jsonSchemaDialect;

  // PathItem: query method, additionalOperations
  const paths = spec.paths as Obj | undefined;
  if (paths) {
    for (const path in paths) {
      const item = paths[path];
      if (!item || typeof item !== 'object') continue;
      const pi = item as Obj;
      delete pi.query;
      delete pi.additionalOperations;
    }
  }

  // Webhooks: same treatment as paths
  const webhooks = spec.webhooks as Obj | undefined;
  if (webhooks) {
    for (const name in webhooks) {
      const item = webhooks[name];
      if (!item || typeof item !== 'object') continue;
      const pi = item as Obj;
      delete pi.query;
      delete pi.additionalOperations;
    }
  }

  // Tags: summary, parent, kind
  if (Array.isArray(spec.tags)) {
    for (const tag of spec.tags) {
      if (tag && typeof tag === 'object') {
        const t = tag as Obj;
        delete t.summary;
        delete t.parent;
        delete t.kind;
      }
    }
  }

  // Components
  const components = spec.components as Obj | undefined;
  if (components) {
    // OAuth2 device flow
    const schemes = components.securitySchemes as Obj | undefined;
    if (schemes) {
      for (const name in schemes) {
        const scheme = schemes[name];
        if (!scheme || typeof scheme !== 'object' || '$ref' in scheme) continue;
        const flows = (scheme as Obj).flows as Obj | undefined;
        if (flows) delete flows.device;
      }
    }

    // Example fields
    const examples = components.examples as Obj | undefined;
    if (examples) {
      for (const name in examples) {
        const ex = examples[name];
        if (!ex || typeof ex !== 'object' || '$ref' in ex) continue;
        const e = ex as Obj;
        delete e.dataValue;
        delete e.serializedValue;
      }
    }

    // 3.2 reusable media types
    delete components.mediaTypes;
  }

  // Per-operation: querystring param location, itemSchema
  forEachOperation(spec, (op: Obj) => {
    // querystring -> query
    if (Array.isArray(op.parameters)) {
      for (const p of op.parameters) {
        if (p && typeof p === 'object' && !('$ref' in p)) {
          if ((p as Obj).in === 'querystring') (p as Obj).in = 'query';
        }
      }
    }

    // Strip itemSchema from all media types
    stripItemSchema(op);
  });
}

function stripItemSchema(op: Obj): void {
  // Request body
  const reqBody = op.requestBody;
  if (reqBody && typeof reqBody === 'object' && !('$ref' in reqBody)) {
    const content = (reqBody as Obj).content as Obj | undefined;
    if (content) {
      for (const mt in content) {
        const media = content[mt];
        if (media && typeof media === 'object') delete (media as Obj).itemSchema;
      }
    }
  }

  // Responses
  const responses = op.responses as Obj | undefined;
  if (responses) {
    for (const code in responses) {
      const resp = responses[code];
      if (!resp || typeof resp !== 'object' || '$ref' in resp) continue;
      const content = (resp as Obj).content as Obj | undefined;
      if (!content) continue;
      for (const mt in content) {
        const media = content[mt];
        if (media && typeof media === 'object') delete (media as Obj).itemSchema;
      }
    }
  }
}

// -------------------------------------------------------------------
// Traversal helpers
// -------------------------------------------------------------------

/**
 * Walk every schema location in the spec:
 * - components.schemas
 * - components.parameters (schema field)
 * - components.requestBodies (content schemas)
 * - components.responses (content schemas)
 * - components.headers (schema field)
 * - paths.*.operations.parameters
 * - paths.*.operations.requestBody.content.*.schema
 * - paths.*.operations.responses.*.content.*.schema
 * - paths.*.parameters (path-level)
 * - webhooks (same structure as paths)
 * - callbacks (same structure as paths)
 *
 * Uses a WeakSet to prevent infinite loops on circular references.
 */
function walkAllSchemas(spec: Obj, visitor: (schema: Obj) => void): void {
  const visited = new WeakSet<object>();

  function visit(schema: Obj): void {
    if (visited.has(schema)) return;
    visited.add(schema);

    visitor(schema);

    // properties
    if (schema.properties && typeof schema.properties === 'object') {
      const props = schema.properties as Obj;
      for (const key in props) {
        const p = props[key];
        if (p && typeof p === 'object' && !('$ref' in p)) visit(p as Obj);
      }
    }

    // items
    if (schema.items && typeof schema.items === 'object' && !('$ref' in schema.items)) {
      visit(schema.items as Obj);
    }

    // allOf, oneOf, anyOf, prefixItems
    for (const key of ['allOf', 'oneOf', 'anyOf', 'prefixItems']) {
      if (Array.isArray(schema[key])) {
        for (const item of schema[key] as Obj[]) {
          if (item && typeof item === 'object' && !('$ref' in item)) visit(item);
        }
      }
    }

    // not
    if (schema.not && typeof schema.not === 'object' && !('$ref' in schema.not)) {
      visit(schema.not as Obj);
    }

    // additionalProperties
    if (
      schema.additionalProperties &&
      typeof schema.additionalProperties === 'object' &&
      !('$ref' in schema.additionalProperties)
    ) {
      visit(schema.additionalProperties as Obj);
    }
  }

  function visitMediaContent(content: Obj): void {
    for (const mt in content) {
      const media = content[mt] as Obj | undefined;
      if (!media || typeof media !== 'object') continue;
      if (media.schema && typeof media.schema === 'object' && !('$ref' in media.schema)) {
        visit(media.schema as Obj);
      }
      // 3.2 itemSchema
      if (media.itemSchema && typeof media.itemSchema === 'object' && !('$ref' in media.itemSchema)) {
        visit(media.itemSchema as Obj);
      }
    }
  }

  function visitParams(params: unknown[]): void {
    for (const p of params) {
      if (!p || typeof p !== 'object' || '$ref' in p) continue;
      const param = p as Obj;
      if (param.schema && typeof param.schema === 'object' && !('$ref' in param.schema)) {
        visit(param.schema as Obj);
      }
      // Parameter-level content
      if (param.content && typeof param.content === 'object') {
        visitMediaContent(param.content as Obj);
      }
    }
  }

  // Component-level schemas
  const components = spec.components as Obj | undefined;
  if (components) {
    // components.schemas
    const schemas = components.schemas as Obj | undefined;
    if (schemas) {
      for (const name in schemas) {
        const s = schemas[name];
        if (s && typeof s === 'object' && !('$ref' in s)) visit(s as Obj);
      }
    }

    // components.parameters
    const params = components.parameters as Obj | undefined;
    if (params) {
      for (const name in params) {
        const p = params[name];
        if (p && typeof p === 'object' && !('$ref' in p)) {
          const param = p as Obj;
          if (param.schema && typeof param.schema === 'object' && !('$ref' in param.schema)) {
            visit(param.schema as Obj);
          }
        }
      }
    }

    // components.requestBodies
    const reqBodies = components.requestBodies as Obj | undefined;
    if (reqBodies) {
      for (const name in reqBodies) {
        const rb = reqBodies[name];
        if (!rb || typeof rb !== 'object' || '$ref' in rb) continue;
        const content = (rb as Obj).content as Obj | undefined;
        if (content) visitMediaContent(content);
      }
    }

    // components.responses
    const responses = components.responses as Obj | undefined;
    if (responses) {
      for (const name in responses) {
        const resp = responses[name];
        if (!resp || typeof resp !== 'object' || '$ref' in resp) continue;
        const content = (resp as Obj).content as Obj | undefined;
        if (content) visitMediaContent(content);
      }
    }

    // components.headers
    const headers = components.headers as Obj | undefined;
    if (headers) {
      for (const name in headers) {
        const h = headers[name];
        if (!h || typeof h !== 'object' || '$ref' in h) continue;
        const header = h as Obj;
        if (header.schema && typeof header.schema === 'object' && !('$ref' in header.schema)) {
          visit(header.schema as Obj);
        }
      }
    }
  }

  // Path-level and operation-level schemas
  function visitPaths(pathsObj: Obj): void {
    for (const path in pathsObj) {
      const item = pathsObj[path];
      if (!item || typeof item !== 'object') continue;
      const pi = item as Obj;

      // Path-level parameters
      if (Array.isArray(pi.parameters)) {
        visitParams(pi.parameters);
      }

      // Operations
      const verbs = ['get', 'post', 'put', 'patch', 'delete', 'options', 'head', 'trace', 'query'];
      for (const verb of verbs) {
        const op = pi[verb];
        if (!op || typeof op !== 'object') continue;
        const operation = op as Obj;

        // Operation parameters
        if (Array.isArray(operation.parameters)) {
          visitParams(operation.parameters);
        }

        // Request body
        const reqBody = operation.requestBody;
        if (reqBody && typeof reqBody === 'object' && !('$ref' in reqBody)) {
          const content = (reqBody as Obj).content as Obj | undefined;
          if (content) visitMediaContent(content);
        }

        // Responses
        const responses = operation.responses as Obj | undefined;
        if (responses) {
          for (const code in responses) {
            const resp = responses[code];
            if (!resp || typeof resp !== 'object' || '$ref' in resp) continue;
            const content = (resp as Obj).content as Obj | undefined;
            if (content) visitMediaContent(content);
          }
        }

        // Callbacks (contain path items)
        const callbacks = operation.callbacks as Obj | undefined;
        if (callbacks) {
          for (const cbName in callbacks) {
            const cb = callbacks[cbName];
            if (cb && typeof cb === 'object' && !('$ref' in cb)) {
              visitPaths(cb as Obj);
            }
          }
        }
      }
    }
  }

  // paths
  if (spec.paths && typeof spec.paths === 'object') {
    visitPaths(spec.paths as Obj);
  }

  // webhooks (same structure as paths)
  if (spec.webhooks && typeof spec.webhooks === 'object') {
    visitPaths(spec.webhooks as Obj);
  }
}

/**
 * Iterate every operation across paths, webhooks, and callbacks.
 */
function forEachOperation(spec: Obj, visitor: (op: Obj) => void): void {
  const verbs = ['get', 'post', 'put', 'patch', 'delete', 'options', 'head', 'trace', 'query'];

  function visitPathItems(pathsObj: Obj): void {
    for (const path in pathsObj) {
      const item = pathsObj[path];
      if (!item || typeof item !== 'object') continue;
      const pi = item as Obj;

      for (const verb of verbs) {
        const op = pi[verb];
        if (!op || typeof op !== 'object') continue;
        visitor(op as Obj);

        // Recurse into callbacks
        const callbacks = (op as Obj).callbacks as Obj | undefined;
        if (callbacks) {
          for (const cbName in callbacks) {
            const cb = callbacks[cbName];
            if (cb && typeof cb === 'object' && !('$ref' in cb)) {
              visitPathItems(cb as Obj);
            }
          }
        }
      }
    }
  }

  if (spec.paths && typeof spec.paths === 'object') {
    visitPathItems(spec.paths as Obj);
  }
  if (spec.webhooks && typeof spec.webhooks === 'object') {
    visitPathItems(spec.webhooks as Obj);
  }
}
