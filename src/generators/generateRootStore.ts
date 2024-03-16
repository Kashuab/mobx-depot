import {IntrospectionQuery} from "graphql/utilities";
import {IntrospectionObjectType} from "graphql/utilities/getIntrospectionQuery";
import {referencesObjectType} from "./generateObjectTypes";
import {indentString} from "../lib/indentString";

export function generateRootStore(introspection: IntrospectionQuery) {
  const objectTypes = introspection.__schema.types
    .filter(referencesObjectType) as IntrospectionObjectType[];

  return `type ClientObjectTypes = {
${indentString(objectTypes.map(objectType => `${objectType.name}: ObjectTypes.${objectType.name};`).join('\n'), 2)}
}

let client: DepotGQLClient<ClientObjectTypes> | null = null;

export function getGraphQLClient() {
  if (!client) {
    throw new Error('GraphQL client not set, you must call initializeDepotClient in the root of your application.');
  }
  
  return client;
}

export function initializeDepotClient(url: string, opts: ConstructorParameters<typeof DepotGQLClient>[1] = {}) {
  client = new DepotGQLClient(url, opts);
  
  return client;
}`
}