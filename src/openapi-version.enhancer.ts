import {config, injectable} from '@loopback/core';
import {
  OASEnhancer,
  OpenApiSpec,
} from '@loopback/openapi-v3';
import {OpenApiVersionBindings} from './keys';
import {transformOpenApiSpec} from './transform';
import {DEFAULT_CONFIG, OpenApiVersionConfig} from './types';

/**
 * OAS Enhancer that transforms the generated OpenAPI spec between
 * versions 3.0, 3.1, and 3.2.
 *
 * Handles both upgrades (3.0 -> 3.1/3.2) and compatibility downgrades
 * (3.2 -> 3.0/3.1). Downgrades are lossy: features that exist in
 * higher versions but have no equivalent in lower versions are stripped.
 *
 * Runs once at boot when the spec is assembled. The transformed
 * spec is deep-cloned and cached by LoopBack, served on subsequent
 * requests without re-processing.
 *
 * Spec references:
 * - 3.0: https://spec.openapis.org/oas/v3.0.3.html
 * - 3.1: https://spec.openapis.org/oas/v3.1.0.html
 * - 3.2: https://spec.openapis.org/oas/v3.2.0.html
 */
@injectable()
export class OpenApiVersionEnhancer implements OASEnhancer {
  name = 'openapi-version';

  constructor(
    @config({fromBinding: OpenApiVersionBindings.CONFIG, optional: true})
    private options: OpenApiVersionConfig = DEFAULT_CONFIG,
  ) {}

  modifySpec(spec: OpenApiSpec): OpenApiSpec {
    const opts = {...DEFAULT_CONFIG, ...this.options};
    return transformOpenApiSpec(
      spec as Record<string, unknown>,
      opts,
    ) as OpenApiSpec;
  }
}
