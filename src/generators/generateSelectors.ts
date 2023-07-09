import {IntrospectionQuery} from "graphql/utilities";
import {IntrospectionObjectType} from "graphql/utilities/getIntrospectionQuery";
import {referencesObjectType} from "./generateObjectTypes";
import {ModelSelectorGenerator} from "./ModelSelectorGenerator";

export function generateSelectors(introspection: IntrospectionQuery) {
  const objectTypes = introspection.__schema.types
    .filter(referencesObjectType) as IntrospectionObjectType[];

  const selectors = objectTypes.reduce((acc, objectType) => {
    const generator = new ModelSelectorGenerator(objectType);

    return acc + `${generator.code}\n\n`;
    
  }, '');

  return selectors;
}