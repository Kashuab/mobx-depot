import {IntrospectionScalarType} from "graphql/utilities";
import dedent from "dedent";

export class ScalarGenerator {
  type: IntrospectionScalarType;

  constructor(type: IntrospectionScalarType) {
    this.type = type;
  }
  
  get typeValue() {
    return 'string';
  }

  get code() {
    return dedent`
      export type ${this.type.name} = ${this.typeValue};
    `;
  }
}