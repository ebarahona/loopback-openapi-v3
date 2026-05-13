import {describe, it, expect} from 'vitest';
import {OpenApiVersionEnhancer} from '../openapi-version.enhancer';
import {OpenApiSpec} from '@loopback/openapi-v3';

function createTestSpec(): OpenApiSpec {
  return {
    openapi: '3.0.0',
    info: {title: 'Test', version: '1.0.0'},
    paths: {
      '/items': {
        get: {
          operationId: 'getItems',
          parameters: [
            {
              name: 'filter',
              in: 'query',
              schema: {type: 'string', nullable: true},
            },
          ],
          responses: {
            '200': {
              description: 'OK',
              content: {
                'application/json': {
                  schema: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        id: {type: 'integer'},
                        name: {type: 'string', nullable: true},
                      },
                    },
                  },
                },
              },
            },
          },
        },
        post: {
          operationId: 'createItem',
          requestBody: {
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    name: {type: 'string'},
                    description: {type: 'string', nullable: true},
                  },
                },
              },
            },
          },
          responses: {
            '200': {description: 'Created'},
          },
        },
      },
    },
    components: {
      schemas: {
        Item: {
          type: 'object',
          properties: {
            id: {type: 'integer'},
            name: {type: 'string'},
            notes: {type: 'string', nullable: true},
          },
        },
      },
    },
  };
}

describe('OpenApiVersionEnhancer', () => {
  describe('version 3.0.0 (no-op)', () => {
    it('returns spec unchanged', () => {
      const enhancer = new OpenApiVersionEnhancer({
        version: '3.0.0',
      });
      const spec = createTestSpec();
      const result = enhancer.modifySpec(spec);
      expect(result.openapi).toBe('3.0.0');
      expect(
        (result.components?.schemas?.Item as Record<string, unknown>)
          ?.properties,
      ).toHaveProperty('notes');
      const notes = (
        (result.components?.schemas?.Item as Record<string, unknown>)
          ?.properties as Record<string, unknown>
      )?.notes as Record<string, unknown>;
      expect(notes?.nullable).toBe(true);
    });
  });

  describe('version 3.1.0', () => {
    it('updates the openapi version field', () => {
      const enhancer = new OpenApiVersionEnhancer({
        version: '3.1.0',
      });
      const result = enhancer.modifySpec(createTestSpec());
      expect(result.openapi).toBe('3.1.0');
    });

    it('transforms nullable in component schemas', () => {
      const enhancer = new OpenApiVersionEnhancer({
        version: '3.1.0',
      });
      const result = enhancer.modifySpec(createTestSpec());
      const notes = (
        (result.components?.schemas?.Item as Record<string, unknown>)
          ?.properties as Record<string, unknown>
      )?.notes as Record<string, unknown>;
      expect(notes?.type).toEqual(['string', 'null']);
      expect(notes).not.toHaveProperty('nullable');
    });

    it('transforms nullable in response schemas', () => {
      const enhancer = new OpenApiVersionEnhancer({
        version: '3.1.0',
      });
      const result = enhancer.modifySpec(createTestSpec());
      const getOp = result.paths?.['/items']?.get;
      const responseSchema = (
        getOp?.responses?.['200'] as Record<string, unknown>
      )?.content as Record<string, unknown>;
      const jsonSchema = (
        responseSchema?.['application/json'] as Record<string, unknown>
      )?.schema as Record<string, unknown>;
      const items = jsonSchema?.items as Record<string, unknown>;
      const name = (items?.properties as Record<string, unknown>)
        ?.name as Record<string, unknown>;
      expect(name?.type).toEqual(['string', 'null']);
      expect(name).not.toHaveProperty('nullable');
    });

    it('transforms nullable in request body schemas', () => {
      const enhancer = new OpenApiVersionEnhancer({
        version: '3.1.0',
      });
      const result = enhancer.modifySpec(createTestSpec());
      const postOp = result.paths?.['/items']?.post;
      const reqBody = postOp?.requestBody as Record<string, unknown>;
      const content = reqBody?.content as Record<string, unknown>;
      const jsonMedia = content?.['application/json'] as Record<
        string,
        unknown
      >;
      const schema = jsonMedia?.schema as Record<string, unknown>;
      const desc = (schema?.properties as Record<string, unknown>)
        ?.description as Record<string, unknown>;
      expect(desc?.type).toEqual(['string', 'null']);
      expect(desc).not.toHaveProperty('nullable');
    });

    it('transforms nullable in parameter schemas', () => {
      const enhancer = new OpenApiVersionEnhancer({
        version: '3.1.0',
      });
      const result = enhancer.modifySpec(createTestSpec());
      const getOp = result.paths?.['/items']?.get;
      const param = getOp?.parameters?.[0];
      if (param && !('$ref' in param)) {
        const schema = param.schema as Record<string, unknown>;
        expect(schema?.type).toEqual(['string', 'null']);
        expect(schema).not.toHaveProperty('nullable');
      }
    });

    it('skips transform when transformNullable is false', () => {
      const enhancer = new OpenApiVersionEnhancer({
        version: '3.1.0',
        transformNullable: false,
      });
      const result = enhancer.modifySpec(createTestSpec());
      expect(result.openapi).toBe('3.1.0');
      const notes = (
        (result.components?.schemas?.Item as Record<string, unknown>)
          ?.properties as Record<string, unknown>
      )?.notes as Record<string, unknown>;
      expect(notes?.nullable).toBe(true);
    });
  });

  describe('version 3.2.0', () => {
    it('updates the openapi version field', () => {
      const enhancer = new OpenApiVersionEnhancer({
        version: '3.2.0',
      });
      const result = enhancer.modifySpec(createTestSpec());
      expect(result.openapi).toBe('3.2.0');
    });

    it('transforms nullable schemas same as 3.1', () => {
      const enhancer = new OpenApiVersionEnhancer({
        version: '3.2.0',
      });
      const result = enhancer.modifySpec(createTestSpec());
      const notes = (
        (result.components?.schemas?.Item as Record<string, unknown>)
          ?.properties as Record<string, unknown>
      )?.notes as Record<string, unknown>;
      expect(notes?.type).toEqual(['string', 'null']);
    });
  });

  describe('default config', () => {
    it('defaults to 3.0.0 (no-op)', () => {
      const enhancer = new OpenApiVersionEnhancer();
      const result = enhancer.modifySpec(createTestSpec());
      expect(result.openapi).toBe('3.0.0');
    });
  });
});
