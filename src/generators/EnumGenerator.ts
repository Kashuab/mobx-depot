import {IntrospectionEnumType} from "graphql/utilities";

export class EnumGenerator {
  enumType: IntrospectionEnumType;

  constructor(enumType: IntrospectionEnumType) {
    this.enumType = enumType;
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
    
export enum ${this.enumType.name} {
  ${this.enumType.enumValues.map(value => `${value.name} = '${value.name}'`).join(',\n  ')}
}

defineEnum(${this.enumType.name});
    `;
  }
}