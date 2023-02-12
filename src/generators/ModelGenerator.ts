import dedent from "dedent";
import {IntrospectionField, IntrospectionObjectType} from "graphql/utilities/getIntrospectionQuery";
import {indentString} from "../lib/indentString";
import {referencesModel} from "../makeIntrospectionQuery";
import {isScalarType, scalarIsPrimitive} from "../generate";

export class ModelGenerator {
  modelType: IntrospectionObjectType;

  constructor(modelType: IntrospectionObjectType) {
    this.modelType = modelType;
  }

  get baseModelFileName() {
    return `${this.className(this.modelType.name, true)}.ts`;
  }

  get userEditableModelFileName() {
    return `${this.className(this.modelType.name)}.ts`;
  }

  get requiredModels() {
    return this.modelType.fields.filter(field => referencesModel(field.type));
  }

  get requiredScalars() {
    return this.modelType.fields.reduce((scalars, field) => {
      const isCustomScalar = isScalarType(field.type) && !scalarIsPrimitive(field.type);
      if (isCustomScalar) {
        const typeName = getTypeName(field.type);
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

  get scalarImports() {
    if (this.requiredScalars.length === 0) return '';

    console.log(this.requiredScalars);

    return dedent`
      import { ${this.requiredScalars.join(', ')} } from './scalars';
    `
  }

  get modelImports() {
    return this.requiredModels
      .map(model => {
        const className = this.className(getTypeName(model.type, { stripArrayType: true }));

        return `import { ${className} } from "./${className}"`
      })
      .join('\n');
  }

  get imports() {
    return dedent`
      ${this.scalarImports}
      ${this.modelImports}
    `;
  }

  className(name = this.modelType.name, base = false) {
    return `${name}${base ? 'BaseModel' : 'Model'}`;
  }

  get header() {
    return `export class ${this.className(this.modelType.name, true)} {`;
  }

  get constructorFunction() {
    // TODO: Is this okay?
    return indentString(dedent`
      constructor(init: Partial<${this.className(this.modelType.name, true)}>) {
        Object.assign(this, init);
      }
    `, 2);
  }

  get properties() {
    return this.modelType.fields
      .map(field => {
        if (!('name' in field.type)) {
          console.warn('Model field does not support name', field);
          return;
        }

        let type = getTypeName(field.type);
        if (referencesModel(field.type)) type = this.className(type, false);

        const isNullable = typeIsNullable(field.type);
        if (isNullable) type += ' | null';

        const definition = indentString(`private _${field.name}?: ${type};`, 2);
        const accessor = this.accessorMethods(field.name, type);

        return `${definition}\n${accessor}`;
      })
      .filter(Boolean)
      .reduce((acc, cur) => `${acc}${cur}\n`, '');
  }

  accessorMethods(fieldName: string, fieldType: string) {
    return indentString(dedent`
      get ${fieldName}(): ${fieldType} {
        if (this._${fieldName} === undefined) throw new Error('Property ${fieldName} is not selected');
        return this._${fieldName};
      }
      set ${fieldName}(value: ${fieldType}) {
        this._${fieldName} = value;
      }\n
    `, 2);
  }

  get footer() {
    return `}`;
  }

  get baseModelCode() {
    const segments = [
      this.imports,,
      this.header,
      this.properties,
      this.constructorFunction,
      this.footer
    ];

    return segments.join('\n');
  }

  get userEditableModelCode() {
    const baseClassName = this.className(this.modelType.name, true);
    const userEditableModelClassName = this.className(this.modelType.name, false);

    return dedent`
      import { makeAutoObservable } from 'mobx';
      import { ${baseClassName} } from './${baseClassName}';
      
      export class ${userEditableModelClassName} extends ${baseClassName} {
        constructor(init: Partial<${this.className(this.modelType.name, true)}>) {
          super(init);
          
          makeAutoObservable(this);
        }
      }
    `
  }
}

export function typeIsNonNullable(type: IntrospectionField['type']): boolean {
  return type.kind === 'NON_NULL';
}

export function typeIsNullable(type: IntrospectionField['type']): boolean {
  return !typeIsNonNullable(type);
}

type GetTypeNameOpts = {
  stripArrayType?: boolean;
}

export function getTypeName(type: IntrospectionField['type'], opts: GetTypeNameOpts = { stripArrayType: true }): string {
  let name: string | null = null;

  if (type.kind === 'NON_NULL') {
    if ('name' in type.ofType) {
      return getTypeName(type.ofType, opts);
    }
  }
  
  if (type.kind === 'LIST') {
    return `${getTypeName(type.ofType, opts)}${opts.stripArrayType ? '' : '[]'}`;
  }

  if ('name' in type && type.name != null) {
    name = type.name;
  }

  if (!name) {
    console.error(type);
    throw new Error('Unrecognized type');
  }

  return normalizeTypeName(name);
}

interface INamedType {
  name: string;
  kind: IntrospectionField['type']['kind'];
  ofType?: INamedType;
}

export function normalizeTypeName(typeName: string) {
  switch (typeName) {
    case 'String':
      return 'string';
    case 'Int':
    case 'Float':
      return 'number';
    case 'Boolean':
      return 'boolean';
    default:
      return typeName;
  }
}