import {IntrospectionQuery} from "graphql/utilities";
import {QueryGenerator} from "./QueryGenerator";

export function generateQueries(introspection: IntrospectionQuery) {
  const queryTypeName = introspection.__schema.queryType.name;
  const queryType = introspection.__schema.types.find(type => type.name === queryTypeName);
  if (!queryType) {
    throw new Error('Expected queryType to be defined');
  }

  if (!('fields' in queryType)) {
    throw new Error('Expected queryType to have fields');
  }

  let generators = queryType.fields.map(field => new QueryGenerator(field, false, true));

  const mutationTypeName = introspection.__schema.mutationType?.name;
  const mutationType = introspection.__schema.types.find(type => type.name === mutationTypeName);

  if (mutationType) {
    if (!('fields' in mutationType)) {
      throw new Error('Expected queryType to have fields');
    }

    generators = [...generators, ...mutationType.fields.map(field => new QueryGenerator(field, true, true))];
  }

  return generators.map(gen => gen.code).join('\n\n');
}