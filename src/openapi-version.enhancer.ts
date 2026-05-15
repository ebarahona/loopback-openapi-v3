import {config, injectable} from '@loopback/core';
import {OASEnhancer, OpenApiSpec} from '@loopback/openapi-v3';
import debugFactory from 'debug';
import {OpenApiVersionBindings} from './keys';
import {transformOpenApiSpec} from './transform';
import {DEFAULT_CONFIG, OpenApiVersionConfig} from './types';

const debug = debugFactory('loopback:openapi-version');

/**
 * OAS Enhancer that transforms the generated OpenAPI spec between
 * versions 3.0, 3.1, and 3.2.
 *
 * Handles both upgrades (3.0 -> 3.1/3.2) and compatibility downgrades
 * (3.2 -> 3.0/3.1). Downgrades are lossy: features that exist in
 * higher versions but have no equivalent in lower versions are stripped.
 * Warnings are logged for each stripped feature.
 *
 * Runs when LoopBack assembles the OpenAPI spec. The transformed
 * spec is returned to LoopBack for caching/serving according to the
 * application's OpenAPI configuration.
 *
 * Spec references:
 * - 3.0: https://spec.openapis.org/oas/v3.0.3.html
 * - 3.1: https://spec.openapis.org/oas/v3.1.0.html
 * - 3.2: https://spec.openapis.org/oas/v3.2.0.html
 *
 * @public
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
    debug(
      'configured target OpenAPI version: %s (transformNullable=%s)',
      opts.version,
      opts.transformNullable !== false,
    );
    const result = transformOpenApiSpec(spec as Record<string, unknown>, opts);

    if (result.warnings.length > 0) {
      debug(
        'emitted %d OpenAPI compatibility warnings',
        result.warnings.length,
      );
      for (const w of result.warnings) {
        debug('warning [%s]: %s', w.field, w.message);
      }
    }

    return result.spec as OpenApiSpec;
  }
}
