import {isModelType, makeIntrospectionQuery} from "./makeIntrospectionQuery";
import {getTypeName, ModelGenerator} from "./generators/ModelGenerator";
import {
  IntrospectionListTypeRef,
  IntrospectionNonNullTypeRef,
  IntrospectionQuery,
  IntrospectionScalarType,
  IntrospectionType
} from "graphql/utilities";
import fs from 'fs';
import {ScalarGenerator} from "./generators/ScalarGenerator";

export async function generate(url: string) {
  const query = await makeIntrospectionQuery(url);

  generateScalars(query);
  generateModels(query);
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