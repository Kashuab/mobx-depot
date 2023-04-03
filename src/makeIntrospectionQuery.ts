import {request} from 'graphql-request';
import {buildSchema, getIntrospectionQuery, IntrospectionQuery, IntrospectionType} from "graphql/utilities";
import {IntrospectionObjectType} from "graphql/utilities/getIntrospectionQuery";
import {readFileSync} from "fs";
import {graphql} from "graphql/graphql";

export async function introspectSchema(filePath: string) {
  const schemaText = readFileSync(filePath, 'utf-8');
  const schema = buildSchema(schemaText);
  const query = await graphql({ schema, source: getIntrospectionQuery() });

  if (!('data' in query)) {
    console.error(query);
    throw new Error(`Failed to introspect ${filePath}`);
  }

  return query.data as unknown as IntrospectionQuery;
}

export async function makeIntrospectionQuery(url: string) {
  const data: IntrospectionQuery = await request(url, getIntrospectionQuery());

  return data;
}

interface IModelType {
  kind: string;
  name?: string;
  ofType?: IModelType;
}

export function isModelType(type: IntrospectionType): type is IntrospectionObjectType {
  return referencesModel(type) && 'fields' in type;
}

export function referencesModel(type: IModelType): boolean {
  if ((type.kind === 'NON_NULL' || type.kind === 'LIST') && type.ofType) {
    return referencesModel(type.ofType);
  }

  const conditions = [
    type.kind === 'OBJECT',
    !type.name?.startsWith('__'),
    type.name !== 'Query',
    type.name !== 'Mutation',
    type.name !== 'Subscription',
  ];

  return conditions.every(condition => condition);
}
