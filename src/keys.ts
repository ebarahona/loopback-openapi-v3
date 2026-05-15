import {BindingKey} from '@loopback/core';
import type {OpenApiVersionConfig} from './types';

/**
 * Binding keys for the OpenAPI version transformer component.
 *
 * @public
 */
export namespace OpenApiVersionBindings {
  /**
   * Binding key for the component configuration.
   *
   * @public
   */
  export const CONFIG = BindingKey.create<OpenApiVersionConfig>(
    'openapi-version.config',
  );

  /**
   * Binding key for the component itself.
   *
   * @public
   */
  export const COMPONENT = 'openapi-version.component';
}
