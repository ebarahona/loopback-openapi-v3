/**
 * Supported OpenAPI Specification target versions.
 *
 * @public
 */
export type OpenApiVersion = '3.0.0' | '3.1.0' | '3.2.0';

/**
 * Configuration for the OpenAPI version transformer.
 *
 * @public
 */
export interface OpenApiVersionConfig {
  /**
   * Target OpenAPI Specification version.
   * Defaults to '3.0.0' for backward compatibility.
   */
  version: OpenApiVersion;

  /**
   * Transform nullable fields from OAS 3.0 format (nullable: true)
   * to OAS 3.1+ format (type arrays). Defaults to true for 3.1+.
   */
  transformNullable?: boolean;
}

/**
 * Default configuration applied when no `OpenApiVersionConfig` binding
 * is provided. Targets 3.0.0 with nullable transformation enabled.
 *
 * @internal
 */
export const DEFAULT_CONFIG: OpenApiVersionConfig = {
  version: '3.0.0',
  transformNullable: true,
};
