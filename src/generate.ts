import {introspectSchema, makeIntrospectionQuery} from "./makeIntrospectionQuery";
import {getTypeName } from "./generators/ModelGenerator";
import {
  IntrospectionListTypeRef,
  IntrospectionNonNullTypeRef,
  IntrospectionQuery,
  IntrospectionScalarType,
  IntrospectionType
} from "graphql/utilities";
import {readFileSync, writeFileSync} from 'fs';
import {generateObjectTypes} from "./generators/generateObjectTypes";
import {generateScalars} from "./generators/generateScalars";
import {generateEnums} from "./generators/generateEnums";
import {generateInputObjects} from "./generators/generateInputObjects";
import {generateRootStore} from "./generators/generateRootStore";
import {generateSelectors} from "./generators/generateSelectors";
import {generateQueries} from "./generators/generateQueries";

type GenerateOpts = {
  url: string;
  out: string;
  include: string[] | null;
  exclude: string[] | null;
  writeReactUtilities: boolean;
  idFieldName: string;
}

export async function generate(opts: GenerateOpts) {
  const { url, out } = opts;
  
  const introspection = await (async () => {
    if (url.startsWith('http')) {
      return await makeIntrospectionQuery(url);
    } else if (url.endsWith('.graphql')) {
      return await introspectSchema(url);
    } else if (url.endsWith('.json')) {
      const query = JSON.parse(readFileSync(url, 'utf-8')) as { data: IntrospectionQuery } | IntrospectionQuery;

      if ('data' in query) return query.data;
      if ('__schema' in query) return query;

      throw new Error(`Unable to get introspection from JSON file`);
    } else {
      throw new Error(`Unsupported source: ${url}`);
    }
  })();

  const objectTypes = generateObjectTypes(introspection);
  const scalars = generateScalars(introspection);
  const enums = generateEnums(introspection);
  const inputs = generateInputObjects(introspection);
  const rootStoreScaffolding = generateRootStore(introspection);
  const selectors = generateSelectors(introspection);
  const queries = generateQueries(introspection);

  const imports = `
import { CachePolicy, buildSelection, DepotGQLClient, Selection, UseQueryOpts, useQuery, UseMutationOpts, useMutation } from 'mobx-depot';
import { makeAutoObservable } from 'mobx';
`

  writeFileSync(
    out,
    [imports, rootStoreScaffolding, scalars, enums, objectTypes, inputs, selectors, queries].join('\n\n'),
    'utf-8'
  );
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
