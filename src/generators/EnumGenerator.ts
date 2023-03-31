import {IntrospectionEnumType} from "graphql/utilities";

export class EnumGenerator {
  enumType: IntrospectionEnumType;

  constructor(enumType: IntrospectionEnumType) {
    this.enumType = enumType;
  }

  get fileName() {
    return `${this.enumType.name}.ts`;
  }

  get code() {
    return `
export enum ${this.enumType.name} {
  ${this.enumType.enumValues.map(value => `${value.name} = '${value.name}'`).join(',\n  ')}
}
    `;
  }
}