export type OpenApiVersion = '3.0.0' | '3.1.0' | '3.2.0';

export interface OpenApiVersionConfig {
  /**
   * Target OpenAPI specification version.
   * Defaults to '3.0.0' for backward compatibility.
   */
  version: OpenApiVersion;

  /**
   * Transform nullable fields from OAS 3.0 format (nullable: true)
   * to OAS 3.1+ format (type arrays). Defaults to true for 3.1+.
   */
  transformNullable?: boolean;
}

export const DEFAULT_CONFIG: OpenApiVersionConfig = {
  version: '3.0.0',
  transformNullable: true,
};
