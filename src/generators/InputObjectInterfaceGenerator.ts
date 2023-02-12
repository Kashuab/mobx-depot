import {IntrospectionInputObjectType} from "graphql/utilities";
import {getTypeKind, getTypeName} from "./ModelGenerator";
import dedent from "dedent";
import {indentString} from "../lib/indentString";
import {isScalarType, scalarIsPrimitive} from "../generate";
import {IntrospectionInputValue} from "graphql/utilities/getIntrospectionQuery";

export class InputObjectInterfaceGenerator {
  type: IntrospectionInputObjectType;

  constructor(type: IntrospectionInputObjectType) {
    this.type = type;
  }

  // TODO: Dry this up with ModelGenerator
  get requiredScalars() {
    return this.type.inputFields.reduce((scalars, field) => {
      const isCustomScalar = isScalarType(field.type) && !scalarIsPrimitive(field.type);
      if (isCustomScalar) {
        const typeName = getTypeName(field.type, { stripArrayType: true });
        if (scalars.includes(typeName)) return scalars;

        if (!typeName) {
          console.error(field.type);
          throw new Error(`How is this a scalar?`);
        }

        scalars.push(typeName);
      }

      return scalars;
    }, [] as string[]);
  }

  get requiredInputs() {
    return this.type.inputFields.reduce((inputs, field) => {
      const isInput = getTypeKind(field.type) === 'INPUT_OBJECT';

      if (isInput) {
        const typeName = getTypeName(field.type, { stripArrayType: true });
        if (inputs.includes(typeName)) return inputs;

        inputs.push(typeName);
      }

      return inputs;
    }, [] as string[]);
  }

  get scalarImports() {
    if (this.requiredScalars.length === 0) return '';

    return dedent`
      import { ${this.requiredScalars.join(', ')} } from '../scalars';
    `
  }

  get inputImports() {
    if (this.requiredInputs.length === 0) return '';

    return this.requiredInputs.map(input => {
      return `import { ${input} } from './${input}';`;
    }).join('\n')
  }

  get imports() {
    if (!this.scalarImports && !this.inputImports) return '';

    return dedent`
      ${this.inputImports}
      ${this.scalarImports}
    `;
  }

  get interfaceName() {
    return this.type.name;
  }

  get fileName() {
    return `${this.interfaceName}.ts`;
  }

  get properties() {
    return this.type.inputFields
      .filter(field => field.name !== "clientMutationId")
      .map(field => {
        const typeName = getTypeName(field.type);
        const optionalFlag = field.type.kind === 'NON_NULL' ? '' : '?';

        return indentString(`${field.name}${optionalFlag}: ${typeName};`, 2);
      })
      .join('\n');
  }

  get header() {
    return `export interface ${this.interfaceName} {`;
  }

  get footer() {
    return '}';
  }

  get code() {
    const segments = [
      this.imports,
      this.header,
      this.properties,
      this.footer,
    ].filter(Boolean);

    return segments.join('\n');
  }
}