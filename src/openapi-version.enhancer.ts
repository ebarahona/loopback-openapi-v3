import {config, injectable} from '@loopback/core';
import {
  mergeOpenAPISpec,
  OASEnhancer,
  OpenApiSpec,
} from '@loopback/openapi-v3';
import {OpenApiVersionBindings} from './keys';
import {DEFAULT_CONFIG, OpenApiVersionConfig} from './types';

/**
 * OAS Enhancer that transforms the generated OpenAPI 3.0 spec to
 * the configured target version (3.1 or 3.2).
 *
 * Runs once at boot when the spec is assembled. The transformed
 * spec is cached by LoopBack and served on subsequent requests
 * without re-processing.
 */
@injectable()
export class OpenApiVersionEnhancer implements OASEnhancer {
  name = 'openapi-version';

  constructor(
    @config({fromBinding: OpenApiVersionBindings.CONFIG, optional: true})
    private options: OpenApiVersionConfig = DEFAULT_CONFIG,
  ) {}

  modifySpec(spec: OpenApiSpec): OpenApiSpec {
    const {version, transformNullable} = {
      ...DEFAULT_CONFIG,
      ...this.options,
    };

    if (version === '3.0.0') {
      return spec;
    }

    const transformed = {...spec, openapi: version};

    if (transformNullable && this.isVersion31OrHigher(version)) {
      this.transformNullableSchemas(transformed);
    }

    return transformed;
  }

  private isVersion31OrHigher(version: string): boolean {
    const [major, minor] = version.split('.').map(Number);
    return major >= 3 && minor >= 1;
  }

  /**
   * Transform OAS 3.0 nullable schemas to OAS 3.1+ type arrays.
   *
   * 3.0: { type: 'string', nullable: true }
   * 3.1+: { type: ['string', 'null'] }
   */
  private transformNullableSchemas(spec: OpenApiSpec): void {
    const schemas = spec.components?.schemas;
    if (!schemas) return;

    for (const name in schemas) {
      const schema = schemas[name];
      if (schema && !('$ref' in schema)) {
        this.transformSchema(schema);
      }
    }

    this.transformPathSchemas(spec);
  }

  private transformPathSchemas(spec: OpenApiSpec): void {
    if (!spec.paths) return;

    for (const path in spec.paths) {
      const pathItem = spec.paths[path];
      if (!pathItem) continue;

      const verbs = [
        'get', 'post', 'put', 'patch', 'delete',
        'options', 'head', 'trace',
      ] as const;

      for (const verb of verbs) {
        const operation = pathItem[verb];
        if (!operation) continue;

        // Transform request body schemas
        if (operation.requestBody && !('$ref' in operation.requestBody)) {
          for (const mediaType in operation.requestBody.content) {
            const media = operation.requestBody.content[mediaType];
            if (media.schema && !('$ref' in media.schema)) {
              this.transformSchema(media.schema);
            }
          }
        }

        // Transform response schemas
        if (operation.responses) {
          for (const code in operation.responses) {
            const response = operation.responses[code];
            if (!response || '$ref' in response) continue;
            if (!response.content) continue;
            for (const mediaType in response.content) {
              const media = response.content[mediaType];
              if (media.schema && !('$ref' in media.schema)) {
                this.transformSchema(media.schema);
              }
            }
          }
        }

        // Transform parameter schemas
        if (operation.parameters) {
          for (const param of operation.parameters) {
            if ('$ref' in param) continue;
            if (param.schema && !('$ref' in param.schema)) {
              this.transformSchema(param.schema);
            }
          }
        }
      }
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private transformSchema(schema: Record<string, unknown>): void {
    if (schema.nullable === true && typeof schema.type === 'string') {
      schema.type = [schema.type, 'null'];
      delete schema.nullable;
    }

    // Recurse into nested schemas
    if (schema.properties && typeof schema.properties === 'object') {
      for (const prop in schema.properties as Record<string, unknown>) {
        const propSchema = (schema.properties as Record<string, unknown>)[prop];
        if (propSchema && typeof propSchema === 'object' && !('$ref' in propSchema)) {
          this.transformSchema(propSchema as Record<string, unknown>);
        }
      }
    }

    // Recurse into items (array schemas)
    if (schema.items && typeof schema.items === 'object' && !('$ref' in schema.items)) {
      this.transformSchema(schema.items as Record<string, unknown>);
    }

    // Recurse into allOf/oneOf/anyOf
    for (const key of ['allOf', 'oneOf', 'anyOf'] as const) {
      if (Array.isArray(schema[key])) {
        for (const item of schema[key] as Record<string, unknown>[]) {
          if (item && typeof item === 'object' && !('$ref' in item)) {
            this.transformSchema(item);
          }
        }
      }
    }
  }
}
