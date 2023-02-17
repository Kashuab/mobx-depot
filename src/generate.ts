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
import { resolve } from 'path';

type GenerateOpts = {
  url: string;
  outDir: string;
}

export async function generate(opts: GenerateOpts) {
  const { url, outDir } = opts;
  
  const query = await makeIntrospectionQuery(url);

  // fs.writeFileSync('introspection.json', JSON.stringify(query, null, 2));

  generateScalars(query);

  const models = generateModels(query);
  generateRootStore(models);

  generateInputObjectInterfaces(query);
  generateMutations(query);
  generateQueries(query);

  function generateRootStore(models: ModelGenerator[]) {
    const rootStore = new RootStoreGenerator(models);
  
    writeRootStoreToDisk(rootStore);
  }
  
  function generateQueries(query: IntrospectionQuery) {
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
  
  function generateInputObjectInterfaces(query: IntrospectionQuery) {
    const inputObjectTypes = query.__schema.types
      .filter(type => type.kind === 'INPUT_OBJECT') as IntrospectionInputObjectType[];
  
    const generators = inputObjectTypes.map(type => new InputObjectInterfaceGenerator(type));
  
    writeInputObjectInterfacesToDisk(generators);
  }
  
  function generateMutations(query: IntrospectionQuery) {
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
  
  function generateScalars(query: IntrospectionQuery) {
    const scalarTypes = query.__schema.types
      .filter(type => isScalarType(type) && !scalarIsPrimitive(type)) as IntrospectionScalarType[];
  
    const generators = scalarTypes.map(type => new ScalarGenerator(type));
  
    writeScalarsToDisk(generators);
  }
  
  function generateModels(query: IntrospectionQuery) {
    const modelGenerators = query.__schema.types
      .filter(isModelType)
      .map(type => new ModelGenerator(type));
  
    writeModelsToDisk(modelGenerators);
  
    return modelGenerators;
  }

  function withOutDir(path: string) {
    return resolve(outDir, path);
  }

  function writeScalarsToDisk(scalars: ScalarGenerator[]) {
    if (!fs.existsSync(withOutDir('depot'))) {
      fs.mkdirSync(withOutDir('depot'), { recursive: true });
    }

    fs.writeFileSync(withOutDir(`depot/scalars.ts`), scalars.map(scalar => scalar.code).join('\n\n'));
  }
  
  function writeModelsToDisk(models: ModelGenerator[], force = false) {
    if (!fs.existsSync(withOutDir('depot/base'))) {
      fs.mkdirSync(withOutDir('depot/base'), { recursive: true });
    }
  
    models.forEach(model => {
      fs.writeFileSync(withOutDir(`depot/base/${model.baseModelFileName}`), model.baseModelCode);

      const userEditablePath = withOutDir(`${model.userEditableModelFileName}`);
      if (!force && fs.existsSync(userEditablePath)) {
        return;
      }

      fs.writeFileSync(userEditablePath, model.userEditableModelCode)
    });
  }
  
  function writeInputObjectInterfacesToDisk(inputObjectInterfaces: InputObjectInterfaceGenerator[]) {
    if (!fs.existsSync(withOutDir('depot/inputs'))) {
      fs.mkdirSync(withOutDir('depot/inputs'), { recursive: true });
    }
  
    inputObjectInterfaces.forEach(inputObjectInterface => {
      fs.writeFileSync(withOutDir(`depot/inputs/${inputObjectInterface.fileName}`), inputObjectInterface.code);
    });
  }
  
  function writeMutationsToDisk(mutations: MutationGenerator[]) {
    if (!fs.existsSync(withOutDir('depot/mutations'))) {
      fs.mkdirSync(withOutDir('depot/mutations'), { recursive: true });
    }
  
    mutations.forEach(mutation => {
      fs.writeFileSync(withOutDir(`depot/mutations/${mutation.fileName}`), mutation.code);
    });
  }
  
  function writeQueriesToDisk(queries: QueryGenerator[]) {
    if (!fs.existsSync(withOutDir('depot/queries'))) {
      fs.mkdirSync(withOutDir('depot/queries'), { recursive: true });
    }
  
    queries.forEach(query => {
      fs.writeFileSync(withOutDir(`depot/queries/${query.fileName}`), query.code);
    });
  }

  function writeRootStoreToDisk(rootStore: RootStoreGenerator) {
    if (!fs.existsSync(withOutDir('depot'))) {
      fs.mkdirSync(withOutDir('depot'), { recursive: true });
    }

    fs.writeFileSync(withOutDir(`depot/${rootStore.fileName}`), rootStore.code);
  }
}

type Kind = IntrospectionType['kind'] | 'LIST' | 'NON_NULL';

/*
  There are a lot of functions spread out that answer questions about the introspection query.
  I'm wondering if we should implement some sort of Introspection class to encapsulate this logic.
*/

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
