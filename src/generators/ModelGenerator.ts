import dedent from "dedent";
import {IntrospectionField, IntrospectionObjectType} from "graphql/utilities/getIntrospectionQuery";
import {indentString} from "../lib/indentString";
import {referencesModel} from "../makeIntrospectionQuery";
import {isScalarType, scalarIsPrimitive} from "../generate";
import {ModelSelectorGenerator} from "./ModelSelectorGenerator";

type ModelGeneratorOpts = {
  idFieldName: string;
  depotDirName: string;
}

export class ModelGenerator {
  modelType: IntrospectionObjectType;
  selectorGenerator: ModelSelectorGenerator;

  opts: ModelGeneratorOpts;

  constructor(modelType: IntrospectionObjectType, opts: ModelGeneratorOpts) {
    this.opts = opts;
    this.modelType = modelType;
    this.selectorGenerator = new ModelSelectorGenerator(this, opts);
  }

  get idFieldName() {
    return this.opts.idFieldName;
  }

  get hasIdField() {
    return this.modelType.fields.some(field => field.name === this.idFieldName);
  }

  get modelFileName() {
    return `${this.modelClassName}.ts`;
  }

  get requiredModels() {
    return this.modelType.fields.filter(field => referencesModel(field.type));
  }

  get requiredScalars() {
    return this.modelType.fields.reduce((scalars, field) => {
      const isCustomScalar = isScalarType(field.type) && !scalarIsPrimitive(field.type);

      if (isCustomScalar) {
        const typeName = getTypeName(field.type, { normalizeName: true, stripArrayType: true });
        if (scalars.includes(typeName)) return scalars;

        scalars.push(typeName);
      }

      return scalars;
    }, [] as string[]);
  }

  get scalarImports() {
    if (this.requiredScalars.length === 0) return '';

    return dedent`
      import { ${this.requiredScalars.join(', ')} } from '../scalars';
    `
  }

  get enumImports() {
    const enums = this.modelType.fields.reduce((enums, field) => {
      if (getTypeKind(field.type) === 'ENUM') {
        const typeName = getTypeName(field.type, { stripArrayType: true });
        if (enums.includes(typeName)) return enums;

        enums.push(typeName);
      }

      return enums;
    }, [] as string[]);

    if (enums.length === 0) return '';

    return dedent`
    ${enums.map(enumName => `import { ${enumName} } from '../enums/${enumName}';`).join('\n')}
    `
  }

  get modelImports() {
    return this.requiredModels
      .map(model => {
        const className = this.className(getTypeName(model.type, { stripArrayType: true }));

        return `import { ${className} } from "./${className}"`
      })
      .reduce((imports, current) => {
        if (imports.includes(current)) return imports;

        imports.push(current);

        return imports;
      }, [] as string[])
      .join('\n');
  }

  get imports() {
    return dedent`
      import { assignInstanceProperties, Selectable, WritableInstanceVariables } from 'mobx-depot';
      import { makeAutoObservable } from 'mobx';
      ${this.scalarImports}
      ${this.enumImports}
      ${this.modelImports}
    `;
  }

  className(name = this.modelType.name) {
    return `${name}Model`;
  }

  get modelClassName() {
    return this.className(this.modelType.name);
  }

  get header() {
    return `export class ${this.modelClassName} {`;
  }

  get constructorFunction() {
    return indentString(dedent`
      constructor(init: Partial<${this.propsTypeName}>, observable = true) {
        this.assign(init as any);
        
        if (observable) makeAutoObservable(this);
      }
    `, 2);
  }

  get properties() {
    const fieldProperties = this.modelType.fields
      .map(field => {
        if (!('name' in field.type)) {
          console.warn('Model field does not support name', field);
          return;
        }

        let type = getTypeName(field.type);
        if (referencesModel(field.type)) {
          const isArray = type.endsWith('[]');
          const typeNameWithoutArray = getTypeName(field.type, { stripArrayType: true });
          type = this.className(typeNameWithoutArray);

          if (isArray) type += '[]';
        }

        const isNullable = typeIsNullable(field.type);
        if (isNullable) type += ' | null';

        // `declare` here avoids conflicts in regards to tsconfig option "useDefineForClassFields"
        // See: https://github.com/microsoft/TypeScript/issues/35081
        return indentString(`@Selectable() declare ${field.name}: ${type};`, 2);
      })
      .filter(Boolean)

    return [
      indentString("private __source: 'remote' | 'local' = 'local';", 2),
      ...fieldProperties,
    ].join('\n');
  }

  get propsTypeName() {
    return `${this.modelClassName}Props`;
  }

  get propsType() {
    const fieldNameUnion = this.fieldNames.map(name => `'${name}'`).join(' | ');
    return dedent`
      export type ${this.propsTypeName} = Pick<${this.modelClassName}, ${fieldNameUnion}>;
    `
  }

  createSafeMethodName(name: string) {
    if (this.modelType.fields.some(field => field.name === name)) {
      return `_${name}`;
    }

    return name;
  }

  get selectedDataMethodName() {
    return this.createSafeMethodName('selectedData');
  }

  get fieldNames() {
    return this.modelType.fields.map(f => f.name).filter(name => name !== 'clientMutationId');
  }

  get selectedDataGetter() {
    return indentString(dedent`
      get ${this.selectedDataMethodName}() {
        const data: Partial<${this.propsTypeName}> = {};
        const keys: (keyof ${this.propsTypeName})[] = [${this.fieldNames.map(name => `'${name}'`).join(', ')}]
    
        keys.forEach(key => {
          try {
            data[key] = this[key] as any; // TODO: Types
          } catch (err) {
            // TODO: Check for SelectionError
          }
        });
    
        return data;
      }
    `, 2);
  }

  get footer() {
    return `}`;
  }

  get assignMethodName() {
    return this.createSafeMethodName('assign');
  }

  get assignMethod() {
    return indentString(dedent`
      ${this.assignMethodName}(data: Partial<WritableInstanceVariables<this>>) {
        assignInstanceProperties(this, data);
      }
    `, 2);
  }

  get setMethodName() {
    return this.createSafeMethodName('set');
  }

  get propertySetter() {
    return indentString(dedent`
      ${this.setMethodName}<K extends keyof WritableInstanceVariables<this>>(key: K, value: this[K]) {
        this[key] = value;
      }
    `, 2);
  }

  get setSourceMethod() {
    return indentString(dedent`
      __setSource(source: 'remote' | 'local') {
        this.__source = source;
      }
    `, 2);
  }

  get isRemoteGetterName() {
    return this.createSafeMethodName('isRemote');
  }

  get isRemoteGetter() {
    return indentString(dedent`
      get ${this.isRemoteGetterName}() {
        return this.__source === 'remote';
      }
    `, 2);
  }

  get isLocalGetterName() {
    return this.createSafeMethodName('isLocal');
  }

  get isLocalGetter() {
    return indentString(dedent`
      get ${this.isLocalGetterName}() {
        return this.__source === 'local';
      }
    `, 2);
  }

  get code() {
    const segments = [
      this.imports,
      this.propsType,
      this.header,
      this.properties,
      this.constructorFunction,
      this.selectedDataGetter,
      this.propertySetter,
      this.assignMethod,
      this.setSourceMethod,
      this.isRemoteGetter,
      this.isLocalGetter,
      this.footer,
    ];

    return segments.join('\n');
  }
}

export function arrayTypeContainsNonNullableType(type: IType): boolean {
  let listType;
  let currentType: IType | undefined = type;

  while (!listType && currentType) {
    if (currentType.kind === "LIST") {
      listType = currentType;
    } else {
      currentType = currentType.ofType;
    }
  }

  if (!listType?.ofType) return false

  return listType.ofType.kind === "NON_NULL";
}

export function typeIsNonNullable(type: IType): boolean {
  return type.kind === 'NON_NULL';
}

export function typeIsNullable(type: IType): boolean {
  return !typeIsNonNullable(type);
}

type GetTypeNameOpts = {
  stripArrayType?: boolean;
  normalizeName?: boolean;
}

interface IType {
  kind: string;
  name?: string;
  ofType?: IType;
}

export function getTypeName(type: IType, opts: GetTypeNameOpts = { stripArrayType: false, normalizeName: true }): string {
  let name: string | null = null;

  if (type.kind === 'NON_NULL') {
    if (type.ofType && 'name' in type.ofType) {
      return getTypeName(type.ofType, opts);
    }
  }
  
  if (type.kind === 'LIST' && type.ofType) {
    return `${getTypeName(type.ofType, opts)}${opts.stripArrayType ? '' : '[]'}`;
  }

  if ('name' in type && type.name != null) {
    name = type.name;
  }

  if (!name) {
    console.error(type);
    throw new Error('Unrecognized type');
  }

  return opts.normalizeName ? normalizeTypeName(name) : name;
}

export function getTypeKind(type: IType): string {
  if (type.kind === 'NON_NULL' || type.kind === 'LIST') {
    if (type.ofType) {
      return getTypeKind(type.ofType);
    }
  }

  return type.kind;
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