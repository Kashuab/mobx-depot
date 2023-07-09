import {
  IntrospectionListTypeRef,
  IntrospectionNonNullTypeRef,
  IntrospectionQuery,
  IntrospectionScalarType, IntrospectionTypeRef
} from "graphql/utilities";
import { getTypeName } from "./ModelGenerator";
import {indentString} from "../lib/indentString";

export function generateScalars(introspection: IntrospectionQuery) {
  const scalars = introspection.__schema.types.filter(type => {
    return referencesScalar(type) && !scalarIsPrimitive(type)
  });

  const scalarDefs = scalars.reduce((acc, scalar) => {
    return acc + `
export type ${scalar.name} = any;
    `
  }, '');

  return `
export namespace Scalars {
${indentString(scalarDefs, 2)}
}
  `
}

export function referencesScalar(type: IntrospectionTypeRef): type is IntrospectionScalarType {
  if (type.kind == 'LIST' || type.kind == 'NON_NULL') {
    if (!type.ofType) throw new Error('Expected ofType to be defined');

    return referencesScalar(type.ofType);
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
