import {IntrospectionEnumType} from "graphql/utilities";

export class EnumGenerator {
  enumType: IntrospectionEnumType;

  constructor(enumType: IntrospectionEnumType) {
    this.enumType = enumType;
  }

  get name() {
    return this.enumType.name;
  }

  get fileName() {
    return `${this.enumType.name}.ts`;
  }

  get imports() {
    return 'import { defineEnum } from "mobx-depot";';
  }

  get code() {
    return `
${this.imports}
    
export enum ${this.name} {
  ${this.enumType.enumValues.map(value => `${value.name} = '${value.name}'`).join(',\n  ')}
}

defineEnum(${this.name});
    `;
  }
}