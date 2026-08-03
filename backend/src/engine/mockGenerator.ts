import { fakerPT_BR as faker } from '@faker-js/faker';

export interface FieldDefinition {
  name: string;
  type: string; // 'string' | 'number' | 'boolean' | 'email' | 'uuid' | 'date' | 'name' | 'phone' | 'cpf' | 'address' | 'avatar' | 'price' | 'custom'
  defaultValue?: any;
}

/**
 * Inferir inteligência de Faker a partir de uma chave de objeto
 */
function generateValueByKeyName(key: string, valueHint?: any): any {
  const lowerKey = key.toLowerCase();

  // Se já houver um hint de valor e for objeto ou array recursivo
  if (valueHint !== undefined && valueHint !== null) {
    if (Array.isArray(valueHint)) {
      const templateItem = valueHint[0] || { id: faker.string.uuid(), name: faker.person.fullName() };
      const count = faker.number.int({ min: 2, max: 6 });
      return Array.from({ length: count }, () => generateMockFromTemplate(templateItem));
    }
    if (typeof valueHint === 'object') {
      return generateMockFromTemplate(valueHint);
    }
  }

  // Chaves com padrões específicos (Português & Inglês)
  if (lowerKey === 'id' || lowerKey.endsWith('_id') || lowerKey.endsWith('id')) {
    if (typeof valueHint === 'number') {
      return faker.number.int({ min: 1, max: 9999 });
    }
    return faker.string.uuid();
  }

  if (lowerKey.includes('email')) {
    return faker.internet.email().toLowerCase();
  }

  if (lowerKey.includes('cpf')) {
    return faker.string.numeric(11);
  }

  if (lowerKey.includes('nome') || lowerKey.includes('name') || lowerKey.includes('autor') || lowerKey.includes('user')) {
    if (lowerKey.includes('empresa') || lowerKey.includes('company')) return faker.company.name();
    return faker.person.fullName();
  }

  if (lowerKey.includes('telefone') || lowerKey.includes('phone') || lowerKey.includes('celular')) {
    return faker.phone.number();
  }

  if (lowerKey.includes('data') || lowerKey.includes('date') || lowerKey.includes('created') || lowerKey.includes('updated') || lowerKey.includes('at')) {
    return faker.date.recent({ days: 30 }).toISOString();
  }

  if (lowerKey.includes('nascimento') || lowerKey.includes('birth')) {
    return faker.date.birthdate({ min: 18, max: 65, mode: 'age' }).toISOString().split('T')[0];
  }

  if (lowerKey.includes('preco') || lowerKey.includes('price') || lowerKey.includes('val') || lowerKey.includes('total') || lowerKey.includes('amount')) {
    return Number(faker.commerce.price({ min: 10, max: 1500 }));
  }

  if (lowerKey.includes('avatar') || lowerKey.includes('foto') || lowerKey.includes('image') || lowerKey.includes('img') || lowerKey.includes('thumb')) {
    return faker.image.avatar();
  }

  if (lowerKey.includes('url') || lowerKey.includes('link') || lowerKey.includes('website')) {
    return faker.internet.url();
  }

  if (lowerKey.includes('status')) {
    return faker.helpers.arrayElement(['ACTIVE', 'PENDING', 'INACTIVE', 'COMPLETED']);
  }

  if (lowerKey.includes('ativo') || lowerKey.includes('active') || lowerKey.includes('is') || lowerKey.includes('has') || lowerKey.includes('enabled')) {
    return faker.datatype.boolean();
  }

  if (lowerKey.includes('endereco') || lowerKey.includes('address') || lowerKey.includes('rua') || lowerKey.includes('street')) {
    return faker.location.streetAddress();
  }

  if (lowerKey.includes('cidade') || lowerKey.includes('city')) {
    return faker.location.city();
  }

  if (lowerKey.includes('estado') || lowerKey.includes('state')) {
    return faker.location.state();
  }

  if (lowerKey.includes('cep') || lowerKey.includes('zip')) {
    return faker.location.zipCode('#####-###');
  }

  if (lowerKey.includes('pais') || lowerKey.includes('country')) {
    return faker.location.country();
  }

  if (lowerKey.includes('descricao') || lowerKey.includes('description') || lowerKey.includes('bio') || lowerKey.includes('summary')) {
    return faker.lorem.paragraph();
  }

  if (lowerKey.includes('titulo') || lowerKey.includes('title') || lowerKey.includes('subject') || lowerKey.includes('headline')) {
    return faker.lorem.sentence({ min: 3, max: 7 });
  }

  if (lowerKey.includes('categoria') || lowerKey.includes('category')) {
    return faker.commerce.department();
  }

  if (lowerKey.includes('idade') || lowerKey.includes('age') || lowerKey.includes('qtd') || lowerKey.includes('quantity') || lowerKey.includes('count')) {
    return faker.number.int({ min: 1, max: 100 });
  }

  // Fallback baseado no tipo do valor do modelo original se houver
  if (typeof valueHint === 'number') {
    return faker.number.int({ min: 1, max: 500 });
  }

  if (typeof valueHint === 'boolean') {
    return faker.datatype.boolean();
  }

  return faker.lorem.words({ min: 1, max: 3 });
}

/**
 * Gera um objeto mockado completo a partir de um objeto/modelo modelo
 */
export function generateMockFromTemplate(template: any): any {
  if (!template || typeof template !== 'object') {
    return { id: faker.string.uuid(), title: faker.lorem.sentence() };
  }

  // Se for um array de exemplo, retorna um array com N itens gerados
  if (Array.isArray(template)) {
    const sampleItem = template[0] || { id: 1, name: 'Item Example' };
    const count = faker.number.int({ min: 3, max: 8 });
    return Array.from({ length: count }, () => generateMockFromTemplate(sampleItem));
  }

  const result: Record<string, any> = {};

  for (const [key, val] of Object.entries(template)) {
    result[key] = generateValueByKeyName(key, val);
  }

  return result;
}

/**
 * Tenta parsear qualquer entrada do usuário (JSON string, objeto ou esquema simples)
 */
export function parseUserSchema(input: string | object): any {
  if (typeof input === 'object') return input;
  try {
    return JSON.parse(input);
  } catch (err) {
    // Se for string simples ou erro, retorna modelo fallback básico
    return {
      id: "uuid",
      nome: "Nome Exemplo",
      email: "email@exemplo.com",
      ativo: true,
      criadoEm: "2026-01-01T00:00:00.000Z"
    };
  }
}
