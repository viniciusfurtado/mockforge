import { generateMockFromTemplate, parseUserSchema } from './mockGenerator';

export interface WorkspaceForSpec {
  id: string;
  name: string;
  apiKey?: string | null;
}

export interface EndpointForSpec {
  name: string;
  path: string;
  method: string;
  mode: string;
  statusCode: number;
  schema: string;
  staticResponse?: string | null;
  fieldOverrides?: string | null;
  errorRate: number;
}

const ALL_METHOD_VERBS = ['get', 'post', 'put', 'patch', 'delete'];

/**
 * Infere um JSON Schema (subset OpenAPI 3.0) recursivamente a partir de um valor de exemplo.
 */
export function inferJsonSchema(value: any): any {
  if (value === null || value === undefined) {
    return { nullable: true };
  }
  if (Array.isArray(value)) {
    return { type: 'array', items: value.length > 0 ? inferJsonSchema(value[0]) : {} };
  }
  if (typeof value === 'object') {
    const properties: Record<string, any> = {};
    for (const [key, val] of Object.entries(value)) {
      properties[key] = inferJsonSchema(val);
    }
    return { type: 'object', properties };
  }
  if (typeof value === 'number') {
    return { type: Number.isInteger(value) ? 'integer' : 'number' };
  }
  if (typeof value === 'boolean') {
    return { type: 'boolean' };
  }
  return { type: 'string' };
}

function resolveSchemaAndExample(ep: EndpointForSpec): { schemaSource: any; example: any } {
  if (ep.mode === 'static') {
    let staticBody: any;
    try {
      staticBody = JSON.parse(ep.staticResponse || '{}');
    } catch {
      staticBody = { message: ep.staticResponse || 'Static mock response' };
    }
    return { schemaSource: staticBody, example: staticBody };
  }

  const schemaObj = parseUserSchema(ep.schema);
  let fieldOverrides = {};
  try {
    if (ep.fieldOverrides) fieldOverrides = JSON.parse(ep.fieldOverrides);
  } catch {}

  const example = generateMockFromTemplate(schemaObj, fieldOverrides);
  return { schemaSource: schemaObj, example };
}

function buildOperation(ep: EndpointForSpec, parameters: any[]): any {
  const { schemaSource, example } = resolveSchemaAndExample(ep);

  const responses: Record<string, any> = {
    [String(ep.statusCode)]: {
      description: ep.name || 'Resposta mockada',
      content: {
        'application/json': { schema: inferJsonSchema(schemaSource), example }
      }
    }
  };

  if (ep.errorRate > 0) {
    responses['500'] = {
      description: 'Erro simulado (Chaos Engineering)',
      content: {
        'application/json': {
          schema: {
            type: 'object',
            properties: {
              error: { type: 'string' },
              message: { type: 'string' },
              statusCode: { type: 'integer' }
            }
          },
          example: {
            error: 'Simulated Server Error (Chaos)',
            message: `Esta falha foi gerada artificialmente devido à taxa de erro configurada (${ep.errorRate}%).`,
            statusCode: 500
          }
        }
      }
    };
  }

  const operation: any = { summary: ep.name, responses };
  if (parameters.length > 0) operation.parameters = parameters;
  return operation;
}

/**
 * Monta um documento OpenAPI 3.0.3 a partir dos endpoints cadastrados em um workspace.
 */
export function buildOpenApiSpec(workspace: WorkspaceForSpec, endpoints: EndpointForSpec[], baseUrl: string): any {
  const paths: Record<string, any> = {};

  for (const ep of endpoints) {
    const openApiPath = ep.path.trim().replace(/:([a-zA-Z0-9_]+)/g, '{$1}');
    const paramNames = (ep.path.match(/:[a-zA-Z0-9_]+/g) || []).map((p: string) => p.substring(1));
    const parameters = paramNames.map((name: string) => ({
      name,
      in: 'path',
      required: true,
      schema: { type: 'string' }
    }));

    const operation = buildOperation(ep, parameters);
    const verbs = ep.method === 'ALL' ? ALL_METHOD_VERBS : [ep.method.toLowerCase()];

    if (!paths[openApiPath]) paths[openApiPath] = {};
    for (const verb of verbs) {
      paths[openApiPath][verb] = operation;
    }
  }

  const spec: any = {
    openapi: '3.0.3',
    info: { title: workspace.name, version: '1.0.0' },
    servers: [{ url: baseUrl }],
    paths
  };

  if (workspace.apiKey) {
    spec.components = {
      securitySchemes: {
        ApiKeyAuth: { type: 'apiKey', in: 'header', name: 'X-Api-Key' }
      }
    };
    spec.security = [{ ApiKeyAuth: [] }];
  }

  return spec;
}
