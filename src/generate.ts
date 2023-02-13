import {isModelType, makeIntrospectionQuery} from "./makeIntrospectionQuery";
import {getTypeName, ModelGenerator} from "./generators/ModelGenerator";
import {
  IntrospectionInputObjectType,
  IntrospectionListTypeRef,
  IntrospectionNonNullTypeRef,
  IntrospectionQuery,
  IntrospectionScalarType,
  IntrospectionType
} from "graphql/utilities";
import fs from 'fs';
import {ScalarGenerator} from "./generators/ScalarGenerator";
import {MutationGenerator} from "./generators/MutationGenerator";
import {InputObjectInterfaceGenerator} from "./generators/InputObjectInterfaceGenerator";
import {QueryGenerator} from "./generators/QueryGenerator";
import {RootStoreGenerator} from "./generators/RootStoreGenerator";

export async function generate(url: string) {
  const query = await makeIntrospectionQuery(url);

  fs.writeFileSync('introspection.json', JSON.stringify(query, null, 2));

  generateScalars(query);

  const models = generateModels(query);
  generateRootStore(models);

  generateInputObjectInterfaces(query);
  generateMutations(query);
  generateQueries(query);
}

export function generateRootStore(models: ModelGenerator[]) {
  const rootStore = new RootStoreGenerator(models);

  writeRootStoreToDisk(rootStore);
}

export function writeRootStoreToDisk(rootStore: RootStoreGenerator) {
  if (!fs.existsSync('models/depot')) {
    fs.mkdirSync('models/depot', { recursive: true });
  }

  fs.writeFileSync(`models/depot/${rootStore.fileName}`, rootStore.code);
}

export function generateQueries(query: IntrospectionQuery) {
  const queryType = query.__schema.types.find(type => type.name === 'Query');
  if (!queryType) {
    throw new Error('Expected queryType to be defined');
  }

  if (!('fields' in queryType)) {
    throw new Error('Expected queryType to have fields');
  }

  const generators = queryType.fields.map(field => new QueryGenerator(field));

  writeQueriesToDisk(generators);
}

export function generateInputObjectInterfaces(query: IntrospectionQuery) {
  const inputObjectTypes = query.__schema.types
    .filter(type => type.kind === 'INPUT_OBJECT') as IntrospectionInputObjectType[];

  const generators = inputObjectTypes.map(type => new InputObjectInterfaceGenerator(type));

  writeInputObjectInterfacesToDisk(generators);
}

export function generateMutations(query: IntrospectionQuery) {
  const mutationType = query.__schema.types.find(type => type.name === 'Mutation');
  if (!mutationType) {
    throw new Error('Expected mutationType to be defined');
  }

  if (!('fields' in mutationType)) {
    throw new Error('Expected mutationType to have fields');
  }

  const generators = mutationType.fields.map(field => new MutationGenerator(field));

  writeMutationsToDisk(generators);
}

export function generateScalars(query: IntrospectionQuery) {
  const scalarTypes = query.__schema.types
    .filter(type => isScalarType(type) && !scalarIsPrimitive(type)) as IntrospectionScalarType[];

  const generators = scalarTypes.map(type => new ScalarGenerator(type));

  writeScalarsToDisk(generators);
}

export function writeScalarsToDisk(scalars: ScalarGenerator[]) {
  if (!fs.existsSync('models/depot')) {
    fs.mkdirSync('models/depot', { recursive: true });
  }

  fs.writeFileSync(`models/depot/scalars.ts`, scalars.map(scalar => scalar.code).join('\n\n'));
}

type Kind = IntrospectionType['kind'] | 'LIST' | 'NON_NULL';

export function isScalarType(type: { kind: Kind, ofType?: { kind: Kind } }): type is { kind: 'SCALAR' } {
  if (type.kind == 'LIST' || type.kind == 'NON_NULL') {
    if (!type.ofType) throw new Error('Expected ofType to be defined');

    return isScalarType(type.ofType);
  }

  return type.kind === 'SCALAR';
}

export function scalarIsPrimitive(type: IntrospectionScalarType | IntrospectionNonNullTypeRef<IntrospectionScalarType> | IntrospectionListTypeRef<IntrospectionScalarType>) {
  let typeName = getTypeName(type, { normalizeName: true, stripArrayType: true });

  if (!typeName) {
    console.error(type);
    throw new Error('Expected typeName to be defined');
  }

  return ['string', 'number', 'boolean'].includes(typeName);
}

export function generateModels(query: IntrospectionQuery) {
  const modelGenerators = query.__schema.types
    .filter(isModelType)
    .map(type => new ModelGenerator(type));

  writeModelsToDisk(modelGenerators);

  return modelGenerators;
}

export function writeModelsToDisk(models: ModelGenerator[]) {
  if (!fs.existsSync('models/depot/base')) {
    fs.mkdirSync('models/depot/base', { recursive: true });
  }

  models.forEach(model => {
    fs.writeFileSync(`models/depot/base/${model.baseModelFileName}`, model.baseModelCode);
    fs.writeFileSync(`models/${model.userEditableModelFileName}`, model.userEditableModelCode)
  });
}

export function writeInputObjectInterfacesToDisk(inputObjectInterfaces: InputObjectInterfaceGenerator[]) {
  if (!fs.existsSync('models/depot/inputs')) {
    fs.mkdirSync('models/depot/inputs', { recursive: true });
  }

  inputObjectInterfaces.forEach(inputObjectInterface => {
    fs.writeFileSync(`models/depot/inputs/${inputObjectInterface.fileName}`, inputObjectInterface.code);
  });
}

export function writeMutationsToDisk(mutations: MutationGenerator[]) {
  if (!fs.existsSync('models/depot/mutations')) {
    fs.mkdirSync('models/depot/mutations', { recursive: true });
  }

  mutations.forEach(mutation => {
    fs.writeFileSync(`models/depot/mutations/${mutation.fileName}`, mutation.code);
  });
}

export function writeQueriesToDisk(queries: QueryGenerator[]) {
  if (!fs.existsSync('models/depot/queries')) {
    fs.mkdirSync('models/depot/queries', { recursive: true });
  }

  queries.forEach(query => {
    fs.writeFileSync(`models/depot/queries/${query.fileName}`, query.code);
  });
}