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
import {IntrospectionObjectType} from "graphql/utilities/getIntrospectionQuery";
import {MutationGenerator} from "./generators/MutationGenerator";
import {InputObjectInterfaceGenerator} from "./generators/InputObjectInterfaceGenerator";
import {QueryGenerator} from "./generators/QueryGenerator";

export async function generate(url: string) {
  const query = await makeIntrospectionQuery(url);

  fs.writeFileSync('introspection.json', JSON.stringify(query, null, 2));

  generateScalars(query);
  generateModels(query);
  generateInputObjectInterfaces(query);
  generateMutations(query);
  generateQueries(query);
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
  if (!fs.existsSync('models')) {
    fs.mkdirSync('models');
  }

  fs.writeFileSync(`models/scalars.ts`, scalars.map(scalar => scalar.code).join('\n\n'));
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
  let typeName = getTypeName(type);

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
}

export function writeModelsToDisk(models: ModelGenerator[]) {
  if (!fs.existsSync('models')) {
    fs.mkdirSync('models');
  }

  models.forEach(model => {
    fs.writeFileSync(`models/${model.baseModelFileName}`, model.baseModelCode);
    fs.writeFileSync(`models/${model.userEditableModelFileName}`, model.userEditableModelCode)
  });
}

export function writeInputObjectInterfacesToDisk(inputObjectInterfaces: InputObjectInterfaceGenerator[]) {
  if (!fs.existsSync('models/inputs')) {
    fs.mkdirSync('models/inputs');
  }

  inputObjectInterfaces.forEach(inputObjectInterface => {
    fs.writeFileSync(`models/inputs/${inputObjectInterface.fileName}`, inputObjectInterface.code);
  });
}

export function writeMutationsToDisk(mutations: MutationGenerator[]) {
  if (!fs.existsSync('models/mutations')) {
    fs.mkdirSync('models/mutations');
  }

  mutations.forEach(mutation => {
    fs.writeFileSync(`models/mutations/${mutation.fileName}`, mutation.code);
  });
}

export function writeQueriesToDisk(queries: QueryGenerator[]) {
  if (!fs.existsSync('models/queries')) {
    fs.mkdirSync('models/queries');
  }

  queries.forEach(query => {
    fs.writeFileSync(`models/queries/${query.fileName}`, query.code);
  });
}