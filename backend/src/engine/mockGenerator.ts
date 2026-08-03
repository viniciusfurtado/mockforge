import { fakerPT_BR as faker } from '@faker-js/faker';

export type FieldPreset =
  | 'auto'
  | 'cnpj_formatted'
  | 'cnpj_numeric'
  | 'cpf_formatted'
  | 'cpf_numeric'
  | 'numeric_string'
  | 'alphanumeric_code'
  | 'uuid'
  | 'integer'
  | 'float'
  | 'email'
  | 'full_name'
  | 'company'
  | 'phone'
  | 'date_iso'
  | 'date_simple'
  | 'boolean';

/**
 * Função para gerar CNPJ formatado ou numérico
 */
function generateCNPJ(formatted: boolean = false): string {
  const n = Array.from({ length: 12 }, () => faker.number.int({ min: 0, max: 9 }));
  const d1 = faker.number.int({ min: 0, max: 9 });
  const d2 = faker.number.int({ min: 0, max: 9 });
  const digits = [...n, d1, d2].join('');

  if (!formatted) return digits;
  return digits.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
}

/**
 * Função para gerar CPF formatado ou numérico
 */
function generateCPF(formatted: boolean = false): string {
  const digits = faker.string.numeric(11);
  if (!formatted) return digits;
  return digits.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4');
}

/**
 * Executa o gerador para uma instrução explícita de override
 */
function generateValueFromPreset(preset: FieldPreset, valueHint?: any): any {
  switch (preset) {
    case 'cnpj_formatted':
      return generateCNPJ(true);
    case 'cnpj_numeric':
      return generateCNPJ(false);
    case 'cpf_formatted':
      return generateCPF(true);
    case 'cpf_numeric':
      return generateCPF(false);
    case 'numeric_string':
      return faker.string.numeric({ length: typeof valueHint === 'string' && valueHint ? valueHint.length : 6 });
    case 'alphanumeric_code':
      return faker.string.alphanumeric({ length: typeof valueHint === 'string' && valueHint ? valueHint.length : 10, casing: 'upper' });
    case 'uuid':
      return faker.string.uuid();
    case 'integer':
      return faker.number.int({ min: 100, max: 99999 });
    case 'float':
      return Number(faker.commerce.price({ min: 10, max: 2000 }));
    case 'email':
      return faker.internet.email().toLowerCase();
    case 'full_name':
      return faker.person.fullName();
    case 'company':
      return faker.company.name();
    case 'phone':
      return faker.phone.number();
    case 'date_iso':
      return faker.date.recent({ days: 30 }).toISOString();
    case 'date_simple':
      return faker.date.recent({ days: 30 }).toISOString().split('T')[0];
    case 'boolean':
      return faker.datatype.boolean();
    default:
      return undefined;
  }
}

/**
 * Inferir inteligência de Faker a partir de uma chave e modelo fornecido pelo usuário
 */
function generateValueByKeyName(key: string, valueHint?: any, overrides?: Record<string, FieldPreset>, currentPath: string = ''): any {
  const keyPath = currentPath ? `${currentPath}.${key}` : key;

  // Se houver um override manual cadastrado pelo usuário para este campo
  if (overrides && overrides[keyPath] && overrides[keyPath] !== 'auto') {
    const overrideVal = generateValueFromPreset(overrides[keyPath], valueHint);
    if (overrideVal !== undefined) return overrideVal;
  }

  // 1. Tratamento recursivo para Objetos e Arrays
  if (valueHint !== undefined && valueHint !== null) {
    if (Array.isArray(valueHint)) {
      const templateItem = valueHint[0] || { id: faker.string.uuid(), name: faker.person.fullName() };
      const count = valueHint.length > 0 ? valueHint.length : faker.number.int({ min: 1, max: 3 });
      return Array.from({ length: count }, () => generateMockFromTemplate(templateItem, overrides, keyPath));
    }
    if (typeof valueHint === 'object') {
      return generateMockFromTemplate(valueHint, overrides, keyPath);
    }
  }

  const lowerKey = key.toLowerCase();
  const isOriginalNumber = typeof valueHint === 'number';
  const isOriginalBoolean = typeof valueHint === 'boolean';

  // CNPJ
  if (lowerKey.includes('cnpj')) {
    return generateCNPJ(false);
  }

  // CPF
  if (lowerKey.includes('cpf')) {
    return generateCPF(false);
  }

  // UUID, Senha, Token
  if (
    lowerKey.includes('senha') ||
    lowerKey.includes('password') ||
    lowerKey.includes('token') ||
    lowerKey.includes('secret') ||
    lowerKey.includes('uuid') ||
    (typeof valueHint === 'string' && valueHint.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-/i))
  ) {
    return faker.string.uuid();
  }

  // IDs
  if (lowerKey === 'id' || lowerKey.endsWith('_id') || lowerKey.endsWith('id')) {
    if (isOriginalNumber) {
      return faker.number.int({ min: 1, max: 99999 });
    }
    return faker.string.uuid();
  }

  // Datas
  const isDateField =
    lowerKey.includes('data') ||
    lowerKey.includes('date') ||
    lowerKey.includes('created') ||
    lowerKey.includes('updated') ||
    lowerKey.includes('timestamp') ||
    lowerKey.includes('nascimento') ||
    lowerKey.includes('birth') ||
    lowerKey.includes('expires');

  if (isDateField) {
    if (lowerKey.includes('nascimento') || lowerKey.includes('birth')) {
      return faker.date.birthdate({ min: 18, max: 65, mode: 'age' }).toISOString().split('T')[0];
    }
    return faker.date.recent({ days: 30 }).toISOString();
  }

  // Se o valor de origem for Number
  if (isOriginalNumber) {
    if (lowerKey.includes('agencia') || lowerKey.includes('agency')) {
      return faker.number.int({ min: 1000, max: 9999 });
    }
    if (lowerKey.includes('posto')) {
      return faker.number.int({ min: 100, max: 9999 });
    }
    if (lowerKey.includes('bdn') || lowerKey.includes('codigo') || lowerKey.includes('code') || lowerKey.includes('num')) {
      return faker.number.int({ min: 10000, max: 9999999 });
    }
    if (lowerKey.includes('preco') || lowerKey.includes('price') || lowerKey.includes('valor') || lowerKey.includes('val') || lowerKey.includes('total') || lowerKey.includes('amount')) {
      return Number(faker.commerce.price({ min: 10, max: 2000 }));
    }
    return faker.number.int({ min: 100, max: 99999 });
  }

  // Booleans
  if (isOriginalBoolean || lowerKey.includes('ativo') || lowerKey.includes('active') || lowerKey.startsWith('is') || lowerKey.startsWith('has')) {
    return faker.datatype.boolean();
  }

  // E-mail
  if (lowerKey.includes('email')) {
    return faker.internet.email().toLowerCase();
  }

  // Nomes
  if (lowerKey.includes('nome') || lowerKey.includes('name') || lowerKey.includes('autor') || lowerKey.includes('user')) {
    if (lowerKey.includes('empresa') || lowerKey.includes('company')) return faker.company.name();
    return faker.person.fullName();
  }

  // Telefones
  if (lowerKey.includes('telefone') || lowerKey.includes('phone') || lowerKey.includes('celular')) {
    return faker.phone.number();
  }

  // Códigos de Pedido / GTV
  if (lowerKey.includes('pedido') || lowerKey.includes('order') || lowerKey.includes('gtv') || lowerKey.includes('transacao') || lowerKey.includes('protocolo')) {
    return faker.string.alphanumeric({ length: typeof valueHint === 'string' && valueHint ? valueHint.length : 10, casing: 'upper' });
  }

  // Fallback padrão se for String
  return faker.lorem.words({ min: 1, max: 3 });
}

/**
 * Gera um objeto mockado completo a partir de um modelo/template e overrides de campos
 */
export function generateMockFromTemplate(template: any, overrides?: Record<string, FieldPreset>, currentPath: string = ''): any {
  if (!template || typeof template !== 'object') {
    return { id: faker.string.uuid(), title: faker.lorem.sentence() };
  }

  if (Array.isArray(template)) {
    const sampleItem = template[0] || { id: 1, name: 'Item Example' };
    const count = template.length > 0 ? template.length : faker.number.int({ min: 1, max: 3 });
    return Array.from({ length: count }, () => generateMockFromTemplate(sampleItem, overrides, currentPath));
  }

  const result: Record<string, any> = {};

  for (const [key, val] of Object.entries(template)) {
    result[key] = generateValueByKeyName(key, val, overrides, currentPath);
  }

  return result;
}

/**
 * Extrai a lista plana de todos os campos de um modelo JSON
 */
export function extractFieldsFromSchema(template: any, parentPath: string = ''): Array<{ path: string; key: string; sampleValue: any; detectedType: string }> {
  if (!template || typeof template !== 'object') return [];

  const targetObj = Array.isArray(template) ? template[0] : template;
  if (!targetObj || typeof targetObj !== 'object') return [];

  let fields: Array<{ path: string; key: string; sampleValue: any; detectedType: string }> = [];

  for (const [key, val] of Object.entries(targetObj)) {
    const currentPath = parentPath ? `${parentPath}.${key}` : key;
    let detectedType: string = typeof val;

    if (val === null) detectedType = 'null';
    else if (Array.isArray(val)) detectedType = 'array';

    fields.push({
      path: currentPath,
      key,
      sampleValue: val,
      detectedType
    });

    if (val !== null && typeof val === 'object') {
      const nested = extractFieldsFromSchema(val, currentPath);
      fields = fields.concat(nested);
    }
  }

  return fields;
}

/**
 * Parsear entrada do usuário
 */
export function parseUserSchema(input: string | object): any {
  if (typeof input === 'object') return input;
  try {
    return JSON.parse(input);
  } catch (err) {
    return {
      id: "uuid",
      nome: "Nome Exemplo",
      email: "email@exemplo.com",
      ativo: true,
      criadoEm: "2026-01-01T00:00:00.000Z"
    };
  }
}
