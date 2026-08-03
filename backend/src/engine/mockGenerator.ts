import { fakerPT_BR as faker } from '@faker-js/faker';

/**
 * Inferir inteligência de Faker a partir de uma chave e modelo fornecido pelo usuário
 */
function generateValueByKeyName(key: string, valueHint?: any): any {
  const lowerKey = key.toLowerCase();

  // 1. Tratamento recursivo para Objetos e Arrays
  if (valueHint !== undefined && valueHint !== null) {
    if (Array.isArray(valueHint)) {
      const templateItem = valueHint[0] || { id: faker.string.uuid(), name: faker.person.fullName() };
      // Respeitar quantidade do exemplo ou gerar de 1 a 3 itens (para não poluir)
      const count = valueHint.length > 0 ? valueHint.length : faker.number.int({ min: 1, max: 3 });
      return Array.from({ length: count }, () => generateMockFromTemplate(templateItem));
    }
    if (typeof valueHint === 'object') {
      return generateMockFromTemplate(valueHint);
    }
  }

  const isOriginalNumber = typeof valueHint === 'number';
  const isOriginalBoolean = typeof valueHint === 'boolean';

  // 2. HEURÍSTICAS DE DOMÍNIO ESPECÍFICO

  // CNPJ
  if (lowerKey.includes('cnpj')) {
    return faker.string.numeric(14);
  }

  // CPF
  if (lowerKey.includes('cpf')) {
    return faker.string.numeric(11);
  }

  // UUID, Senha, Token, Hash, Secret
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

  // Datas e Timestamps (Garantir busca por palavras inteiras para evitar falsos positivos como 'atendimento')
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

  // Agência, Posto, BDN e Códigos Numéricos
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
    if (lowerKey.includes('idade') || lowerKey.includes('age') || lowerKey.includes('qtd') || lowerKey.includes('quantity') || lowerKey.includes('count')) {
      return faker.number.int({ min: 1, max: 100 });
    }
    // Caso padrão para qualquer atributo que era NUMBER no modelo original
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

  // Códigos de Pedido / GTV / Transação (Strings)
  if (lowerKey.includes('pedido') || lowerKey.includes('order') || lowerKey.includes('gtv') || lowerKey.includes('transacao') || lowerKey.includes('protocolo')) {
    return faker.string.alphanumeric({ length: 10, casing: 'upper' });
  }

  // Preço/Valor em String
  if (lowerKey.includes('preco') || lowerKey.includes('price') || lowerKey.includes('valor')) {
    return Number(faker.commerce.price({ min: 10, max: 2000 }));
  }

  // Mídia / Imagens
  if (lowerKey.includes('avatar') || lowerKey.includes('foto') || lowerKey.includes('image') || lowerKey.includes('img') || lowerKey.includes('thumb')) {
    return faker.image.avatar();
  }

  // URLs
  if (lowerKey.includes('url') || lowerKey.includes('link') || lowerKey.includes('website')) {
    return faker.internet.url();
  }

  // Status
  if (lowerKey.includes('status')) {
    return faker.helpers.arrayElement(['ACTIVE', 'PENDING', 'INACTIVE', 'COMPLETED']);
  }

  // Endereço
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

  if (lowerKey.includes('descricao') || lowerKey.includes('description') || lowerKey.includes('bio')) {
    return faker.lorem.paragraph();
  }

  if (lowerKey.includes('titulo') || lowerKey.includes('title') || lowerKey.includes('subject')) {
    return faker.lorem.sentence({ min: 3, max: 6 });
  }

  // Fallback padrão se for String
  return faker.lorem.words({ min: 1, max: 3 });
}

/**
 * Gera um objeto mockado completo a partir de um modelo/template
 */
export function generateMockFromTemplate(template: any): any {
  if (!template || typeof template !== 'object') {
    return { id: faker.string.uuid(), title: faker.lorem.sentence() };
  }

  if (Array.isArray(template)) {
    const sampleItem = template[0] || { id: 1, name: 'Item Example' };
    const count = template.length > 0 ? template.length : faker.number.int({ min: 1, max: 3 });
    return Array.from({ length: count }, () => generateMockFromTemplate(sampleItem));
  }

  const result: Record<string, any> = {};

  for (const [key, val] of Object.entries(template)) {
    result[key] = generateValueByKeyName(key, val);
  }

  return result;
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
