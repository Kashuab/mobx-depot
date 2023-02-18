import {request} from 'graphql-request';
import {getIntrospectionQuery, IntrospectionQuery, IntrospectionType} from "graphql/utilities";
import {IntrospectionObjectType} from "graphql/utilities/getIntrospectionQuery";

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
