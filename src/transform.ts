import {OpenApiTransformError, OpenApiVersionConfigError} from './errors';
import {DEFAULT_CONFIG} from './types';
import type {OpenApiVersionConfig} from './types';

// Internal type for untyped spec traversal.
interface Obj {
  [key: string]: unknown;
}

const SUPPORTED_MINORS = [0, 1, 2] as const;

function isSupportedMinor(
  minor: number,
): minor is (typeof SUPPORTED_MINORS)[number] {
  return (SUPPORTED_MINORS as readonly number[]).includes(minor);
}

/**
 * Diagnostic warning emitted when features are stripped during downgrade.
 *
 * @public
 */
export interface TransformWarning {
  field: string;
  message: string;
}

/**
 * Result of a spec transformation, including the transformed spec
 * and any diagnostic warnings about lossy operations.
 *
 * @public
 */
export interface TransformResult {
  spec: Obj;
  warnings: TransformWarning[];
}

/**
 * Emit a warning only once per unique field+message combination.
 */
function warnOnce(
  warnings: TransformWarning[],
  seen: Set<string>,
  field: string,
  message: string,
): void {
  const key = `${field}:${message}`;
  if (seen.has(key)) return;
  seen.add(key);
  warnings.push({field, message});
}

/**
 * Parse and validate an OpenAPI version string.
 * Throws `OpenApiVersionConfigError` if the version is not a supported
 * format.
 *
 * @public
 */
export function parseVersion(version: string): {
  major: number;
  minor: number;
  patch: number;
} {
  const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(version);
  if (!match) {
    throw new OpenApiVersionConfigError(
      `Invalid OpenAPI version: "${version}". Expected format: "3.x.x"`,
    );
  }
  const major = Number(match[1]);
  const minor = Number(match[2]);
  const patch = Number(match[3]);

  if (major !== 3) {
    throw new OpenApiVersionConfigError(
      `Unsupported OpenAPI major version: ${major}. Only version 3.x is supported.`,
    );
  }
  if (!isSupportedMinor(minor)) {
    throw new OpenApiVersionConfigError(
      `Unsupported OpenAPI minor version: 3.${minor}. Supported: 3.0.x, 3.1.x, 3.2.x`,
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
 * but have no equivalent in lower versions are stripped. Warnings are
 * emitted for each stripped feature.
 *
 * Requires Node.js 18+ for structuredClone.
 *
 * @public
 */
export function transformOpenApiSpec(
  spec: Obj,
  config: OpenApiVersionConfig = DEFAULT_CONFIG,
): TransformResult {
  if (typeof spec.openapi !== 'string') {
    throw new OpenApiTransformError(
      'Invalid OpenAPI spec: missing required string field "openapi".',
    );
  }

  const sourceVersion = parseVersion(spec.openapi);
  const targetVersion = parseVersion(config.version);

  // Deep clone to prevent mutation of the original spec.
  // Requires Node.js 18+. The package.json engines field enforces this.
  const out = structuredClone(spec);
  out.openapi = config.version;

  const sourceMinor = sourceVersion.minor;
  const targetMinor = targetVersion.minor;
  const warnings: TransformWarning[] = [];
  const warnedKeys = new Set<string>();

  if (sourceMinor === targetMinor) {
    return {spec: out, warnings};
  }

  // 3.0 -> 3.1+: upgrade nullable
  if (
    config.transformNullable !== false &&
    targetMinor >= 1 &&
    sourceMinor < 1
  ) {
    upgradeNullable(out);
  }

  // Strip 3.2 features first (before strip31 removes containers like webhooks)
  if (targetMinor < 2 && sourceMinor >= 2) {
    strip32Features(out, targetMinor, warnings, warnedKeys);
  }

  // 3.1+ -> 3.0: downgrade nullable and strip 3.1 features
  if (targetMinor < 1 && sourceMinor >= 1) {
    downgradeNullable(out, warnings, warnedKeys);
    strip31Features(out, warnings, warnedKeys);
  }

  return {spec: out, warnings};
}

// -------------------------------------------------------------------
// Nullable transforms
// -------------------------------------------------------------------

/**
 * 3.0 -> 3.1+: nullable upgrade
 *
 * Handles all nullable patterns:
 * - { type: 'string', nullable: true } -> { type: ['string', 'null'] }
 * - { nullable: true, oneOf: [...] } -> { oneOf: [..., { type: 'null' }] }
 * - { nullable: true, anyOf: [...] } -> { anyOf: [..., { type: 'null' }] }
 * - { nullable: true, allOf: [...] } -> { anyOf: [{ allOf: [...] }, { type: 'null' }] }
 * - { nullable: true } (no type/composition) -> { type: 'null' }
 */
function upgradeNullable(spec: Obj): void {
  walkAllSchemas(spec, (s: Obj) => {
    if (s.nullable !== true) return;

    delete s.nullable;

    if (typeof s.type === 'string') {
      s.type = [s.type, 'null'];
    } else if (Array.isArray(s.oneOf)) {
      (s.oneOf as Obj[]).push({type: 'null'});
    } else if (Array.isArray(s.anyOf)) {
      (s.anyOf as Obj[]).push({type: 'null'});
    } else if (Array.isArray(s.allOf)) {
      const allOf = s.allOf;
      delete s.allOf;
      s.anyOf = [{allOf}, {type: 'null'}];
    } else {
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
 *
 * Does NOT unwrap single-element composition arrays to avoid
 * metadata collision (description, title, default, etc.).
 */
function downgradeNullable(
  spec: Obj,
  warnings: TransformWarning[],
  seen: Set<string>,
): void {
  let converted = false;
  walkAllSchemas(spec, (s: Obj) => {
    // Type array with null
    if (Array.isArray(s.type)) {
      const types = s.type as string[];
      if (types.includes('null')) {
        const nonNull = types.filter(t => t !== 'null');
        s.type = nonNull.length === 1 ? nonNull[0] : nonNull;
        s.nullable = true;
        converted = true;
      }
    }

    // oneOf/anyOf with { type: 'null' } member
    for (const key of ['oneOf', 'anyOf'] as const) {
      if (!Array.isArray(s[key])) continue;
      const arr = s[key] as Obj[];
      const nullIdx = arr.findIndex(
        item =>
          typeof item === 'object' &&
          item !== null &&
          Object.keys(item).length === 1 &&
          item.type === 'null',
      );
      if (nullIdx !== -1) {
        arr.splice(nullIdx, 1);
        s.nullable = true;
        converted = true;
        // Do NOT unwrap single-element arrays to avoid metadata collision
      }
    }
  });
  if (converted) {
    warnOnce(
      warnings,
      seen,
      'nullable',
      'Converted type arrays to nullable: true for 3.0 compatibility (lossy)',
    );
  }
}

// -------------------------------------------------------------------
// 3.1 feature stripping (when targeting 3.0)
// -------------------------------------------------------------------

function strip31Features(
  spec: Obj,
  warnings: TransformWarning[],
  seen: Set<string>,
): void {
  if (spec.jsonSchemaDialect !== undefined) {
    delete spec.jsonSchemaDialect;
    warnOnce(
      warnings,
      seen,
      'jsonSchemaDialect',
      'Removed jsonSchemaDialect because target version is 3.0.x',
    );
  }

  if (spec.webhooks !== undefined) {
    delete spec.webhooks;
    warnOnce(
      warnings,
      seen,
      'webhooks',
      'Removed webhooks because target version is 3.0.x (webhooks require 3.1+)',
    );
  }

  const components = spec.components as Obj | undefined;
  if (components?.pathItems !== undefined) {
    delete components.pathItems;
    warnOnce(
      warnings,
      seen,
      'components.pathItems',
      'Removed components.pathItems because target version is 3.0.x',
    );
  }

  const info = spec.info as Obj | undefined;
  if (info) {
    const license = info.license as Obj | undefined;
    if (license?.identifier !== undefined) {
      delete license.identifier;
      warnOnce(
        warnings,
        seen,
        'info.license.identifier',
        'Removed license identifier because target version is 3.0.x (use url instead)',
      );
    }
  }
}

// -------------------------------------------------------------------
// 3.2 feature stripping (when targeting 3.0 or 3.1)
// -------------------------------------------------------------------

function strip32Features(
  spec: Obj,
  targetMinor: number,
  warnings: TransformWarning[],
  seen: Set<string>,
): void {
  if (spec.$self !== undefined) {
    delete spec.$self;
    warnOnce(
      warnings,
      seen,
      '$self',
      `Removed $self because target version is 3.${targetMinor}.x`,
    );
  }

  // jsonSchemaDialect: only strip when targeting 3.0 (3.1 supports it)
  // Already handled by strip31Features if targeting 3.0

  // Server.name (3.2 only)
  if (Array.isArray(spec.servers)) {
    for (const server of spec.servers) {
      if (server && typeof server === 'object') {
        const s = server as Obj;
        if (s.name !== undefined) {
          delete s.name;
          warnOnce(
            warnings,
            seen,
            'servers',
            `Removed server name because target version is 3.${targetMinor}.x`,
          );
        }
      }
    }
  }

  // PathItem: query method, additionalOperations
  const paths = spec.paths as Obj | undefined;
  if (paths) {
    for (const path in paths) {
      const item = paths[path];
      if (!item || typeof item !== 'object') continue;
      const pi = item as Obj;
      if (pi.query !== undefined) {
        delete pi.query;
        warnOnce(
          warnings,
          seen,
          `paths.${path}.query`,
          `Removed QUERY method because target version is 3.${targetMinor}.x`,
        );
      }
      if (pi.additionalOperations !== undefined) {
        delete pi.additionalOperations;
        warnOnce(
          warnings,
          seen,
          `paths.${path}.additionalOperations`,
          `Removed additionalOperations because target version is 3.${targetMinor}.x`,
        );
      }
    }
  }

  // Webhooks: same treatment
  const webhooks = spec.webhooks as Obj | undefined;
  if (webhooks) {
    for (const name in webhooks) {
      const item = webhooks[name];
      if (!item || typeof item !== 'object') continue;
      const pi = item as Obj;
      if (pi.query !== undefined) {
        delete pi.query;
        warnOnce(
          warnings,
          seen,
          `webhooks.${name}.query`,
          `Removed QUERY method because target version is 3.${targetMinor}.x`,
        );
      }
      if (pi.additionalOperations !== undefined) {
        delete pi.additionalOperations;
        warnOnce(
          warnings,
          seen,
          `webhooks.${name}.additionalOperations`,
          `Removed additionalOperations because target version is 3.${targetMinor}.x`,
        );
      }
    }
  }

  // Tags: summary, parent, kind
  if (Array.isArray(spec.tags)) {
    let tagWarned = false;
    for (const tag of spec.tags) {
      if (tag && typeof tag === 'object') {
        const t = tag as Obj;
        if (
          t.summary !== undefined ||
          t.parent !== undefined ||
          t.kind !== undefined
        ) {
          delete t.summary;
          delete t.parent;
          delete t.kind;
          if (!tagWarned) {
            warnOnce(
              warnings,
              seen,
              'tags',
              `Removed tag fields (summary, parent, kind) because target version is 3.${targetMinor}.x`,
            );
            tagWarned = true;
          }
        }
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
        if (flows?.device !== undefined) {
          delete flows.device;
          warnOnce(
            warnings,
            seen,
            `components.securitySchemes.${name}.flows.device`,
            `Removed OAuth2 device flow because target version is 3.${targetMinor}.x`,
          );
        }
      }
    }

    // Example fields
    const examples = components.examples as Obj | undefined;
    if (examples) {
      for (const name in examples) {
        const ex = examples[name];
        if (!ex || typeof ex !== 'object' || '$ref' in ex) continue;
        const e = ex as Obj;
        if (e.dataValue !== undefined || e.serializedValue !== undefined) {
          delete e.dataValue;
          delete e.serializedValue;
          warnOnce(
            warnings,
            seen,
            `components.examples.${name}`,
            `Removed dataValue/serializedValue because target version is 3.${targetMinor}.x`,
          );
        }
      }
    }

    // 3.2 reusable media types
    if (components.mediaTypes !== undefined) {
      delete components.mediaTypes;
      warnOnce(
        warnings,
        seen,
        'components.mediaTypes',
        `Removed components.mediaTypes because target version is 3.${targetMinor}.x`,
      );
    }
  }

  // XML Object: text field (3.2 only)
  // Walk all schemas and strip xml.text
  walkAllSchemas(spec, (schema: Obj) => {
    if (schema.xml && typeof schema.xml === 'object') {
      const xml = schema.xml as Obj;
      if (xml.text !== undefined) {
        delete xml.text;
        warnOnce(
          warnings,
          seen,
          'xml.text',
          `Removed XML text field because target version is 3.${targetMinor}.x`,
        );
      }
    }
  });

  // Per-operation: querystring param location, itemSchema, itemEncoding, prefixEncoding
  forEachOperation(spec, (op: Obj, opPath: string) => {
    // querystring -> query
    if (Array.isArray(op.parameters)) {
      for (const p of op.parameters) {
        if (p && typeof p === 'object' && !('$ref' in p)) {
          if ((p as Obj).in === 'querystring') {
            (p as Obj).in = 'query';
            warnOnce(
              warnings,
              seen,
              `${opPath}.parameters`,
              `Converted querystring parameter location to query because target version is 3.${targetMinor}.x`,
            );
          }
        }
      }
    }

    // Strip streaming media fields
    stripMediaFields(op, opPath, warnings, seen, targetMinor);
  });
}

function stripMediaFields(
  op: Obj,
  opPath: string,
  warnings: TransformWarning[],
  seen: Set<string>,
  targetMinor: number,
): void {
  const fieldsToStrip = ['itemSchema', 'itemEncoding', 'prefixEncoding'];

  function stripFromContent(content: Obj, location: string): void {
    for (const mt in content) {
      const media = content[mt];
      if (!media || typeof media !== 'object') continue;
      const m = media as Obj;
      for (const field of fieldsToStrip) {
        if (m[field] !== undefined) {
          delete m[field];
          warnOnce(
            warnings,
            seen,
            `${location}.${mt}.${field}`,
            `Removed ${field} because target version is 3.${targetMinor}.x`,
          );
        }
      }
    }
  }

  // Request body
  const reqBody = op.requestBody;
  if (reqBody && typeof reqBody === 'object' && !('$ref' in reqBody)) {
    const content = (reqBody as Obj).content as Obj | undefined;
    if (content) stripFromContent(content, `${opPath}.requestBody.content`);
  }

  // Responses
  const responses = op.responses as Obj | undefined;
  if (responses) {
    for (const code in responses) {
      const resp = responses[code];
      if (!resp || typeof resp !== 'object' || '$ref' in resp) continue;
      const content = (resp as Obj).content as Obj | undefined;
      if (content)
        stripFromContent(content, `${opPath}.responses.${code}.content`);
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
    if (
      schema.items &&
      typeof schema.items === 'object' &&
      !('$ref' in schema.items)
    ) {
      visit(schema.items as Obj);
    }

    // allOf, oneOf, anyOf, prefixItems
    for (const key of ['allOf', 'oneOf', 'anyOf', 'prefixItems']) {
      if (Array.isArray(schema[key])) {
        for (const item of schema[key] as Obj[]) {
          if (item && typeof item === 'object' && !('$ref' in item))
            visit(item);
        }
      }
    }

    // not
    if (
      schema.not &&
      typeof schema.not === 'object' &&
      !('$ref' in schema.not)
    ) {
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
      if (
        media.schema &&
        typeof media.schema === 'object' &&
        !('$ref' in media.schema)
      ) {
        visit(media.schema as Obj);
      }
      if (
        media.itemSchema &&
        typeof media.itemSchema === 'object' &&
        !('$ref' in media.itemSchema)
      ) {
        visit(media.itemSchema as Obj);
      }
    }
  }

  function visitParams(params: unknown[]): void {
    for (const p of params) {
      if (!p || typeof p !== 'object' || '$ref' in p) continue;
      const param = p as Obj;
      if (
        param.schema &&
        typeof param.schema === 'object' &&
        !('$ref' in param.schema)
      ) {
        visit(param.schema as Obj);
      }
      if (param.content && typeof param.content === 'object') {
        visitMediaContent(param.content as Obj);
      }
    }
  }

  // Component-level schemas
  const components = spec.components as Obj | undefined;
  if (components) {
    const schemas = components.schemas as Obj | undefined;
    if (schemas) {
      for (const name in schemas) {
        const s = schemas[name];
        if (s && typeof s === 'object' && !('$ref' in s)) visit(s as Obj);
      }
    }

    const params = components.parameters as Obj | undefined;
    if (params) {
      for (const name in params) {
        const p = params[name];
        if (p && typeof p === 'object' && !('$ref' in p)) {
          const param = p as Obj;
          if (
            param.schema &&
            typeof param.schema === 'object' &&
            !('$ref' in param.schema)
          ) {
            visit(param.schema as Obj);
          }
        }
      }
    }

    const reqBodies = components.requestBodies as Obj | undefined;
    if (reqBodies) {
      for (const name in reqBodies) {
        const rb = reqBodies[name];
        if (!rb || typeof rb !== 'object' || '$ref' in rb) continue;
        const content = (rb as Obj).content as Obj | undefined;
        if (content) visitMediaContent(content);
      }
    }

    const responses = components.responses as Obj | undefined;
    if (responses) {
      for (const name in responses) {
        const resp = responses[name];
        if (!resp || typeof resp !== 'object' || '$ref' in resp) continue;
        const content = (resp as Obj).content as Obj | undefined;
        if (content) visitMediaContent(content);
      }
    }

    const headers = components.headers as Obj | undefined;
    if (headers) {
      for (const name in headers) {
        const h = headers[name];
        if (!h || typeof h !== 'object' || '$ref' in h) continue;
        const header = h as Obj;
        if (
          header.schema &&
          typeof header.schema === 'object' &&
          !('$ref' in header.schema)
        ) {
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

      if (Array.isArray(pi.parameters)) {
        visitParams(pi.parameters);
      }

      const verbs = [
        'get',
        'post',
        'put',
        'patch',
        'delete',
        'options',
        'head',
        'trace',
        'query',
      ];
      for (const verb of verbs) {
        const op = pi[verb];
        if (!op || typeof op !== 'object') continue;
        const operation = op as Obj;

        if (Array.isArray(operation.parameters)) {
          visitParams(operation.parameters);
        }

        const reqBody = operation.requestBody;
        if (reqBody && typeof reqBody === 'object' && !('$ref' in reqBody)) {
          const content = (reqBody as Obj).content as Obj | undefined;
          if (content) visitMediaContent(content);
        }

        const responses = operation.responses as Obj | undefined;
        if (responses) {
          for (const code in responses) {
            const resp = responses[code];
            if (!resp || typeof resp !== 'object' || '$ref' in resp) continue;
            const content = (resp as Obj).content as Obj | undefined;
            if (content) visitMediaContent(content);
          }
        }

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

  if (spec.paths && typeof spec.paths === 'object') {
    visitPaths(spec.paths as Obj);
  }

  if (spec.webhooks && typeof spec.webhooks === 'object') {
    visitPaths(spec.webhooks as Obj);
  }
}

/**
 * Iterate every operation across paths, webhooks, and callbacks.
 * Passes the operation path string for diagnostic context.
 */
function forEachOperation(
  spec: Obj,
  visitor: (op: Obj, path: string) => void,
): void {
  const verbs = [
    'get',
    'post',
    'put',
    'patch',
    'delete',
    'options',
    'head',
    'trace',
    'query',
  ];

  function visitPathItems(pathsObj: Obj, prefix: string): void {
    for (const path in pathsObj) {
      const item = pathsObj[path];
      if (!item || typeof item !== 'object') continue;
      const pi = item as Obj;

      for (const verb of verbs) {
        const op = pi[verb];
        if (!op || typeof op !== 'object') continue;
        const opPath = `${prefix}.${path}.${verb}`;
        visitor(op as Obj, opPath);

        const callbacks = (op as Obj).callbacks as Obj | undefined;
        if (callbacks) {
          for (const cbName in callbacks) {
            const cb = callbacks[cbName];
            if (cb && typeof cb === 'object' && !('$ref' in cb)) {
              visitPathItems(cb as Obj, `${opPath}.callbacks.${cbName}`);
            }
          }
        }
      }
    }
  }

  if (spec.paths && typeof spec.paths === 'object') {
    visitPathItems(spec.paths as Obj, 'paths');
  }
  if (spec.webhooks && typeof spec.webhooks === 'object') {
    visitPathItems(spec.webhooks as Obj, 'webhooks');
  }
}
