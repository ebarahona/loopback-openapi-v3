import {BindingKey} from '@loopback/core';
import {OpenApiVersionConfig} from './types';

export namespace OpenApiVersionBindings {
  export const CONFIG = BindingKey.create<OpenApiVersionConfig>(
    'openapi-version.config',
  );
  export const COMPONENT = 'openapi-version.component';
}
