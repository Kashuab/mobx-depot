import dedent from "dedent";
import {IntrospectionField, IntrospectionObjectType} from "graphql/utilities/getIntrospectionQuery";
import {indentString} from "../lib/indentString";
import {referencesModel} from "../makeIntrospectionQuery";
import {isScalarType, scalarIsPrimitive} from "../generate";
import {ModelSelectorGenerator} from "./ModelSelectorGenerator";

type ModelGeneratorOpts = {
  idFieldName: string;
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

  get baseModelFileName() {
    return `${this.baseModelClassName}.ts`;
  }

  get userEditableModelFileName() {
    return `${this.userEditableModelClassName}.ts`;
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

  get modelImports() {
    return this.requiredModels
      .map(model => {
        const className = this.className(getTypeName(model.type, { stripArrayType: true }));

        return `import { ${className} } from "../../${className}"`
      })
      .join('\n');
  }

  get imports() {
    return dedent`
      import { getRootStore } from '../rootStore';
      import { assignInstanceProperties, Selectable } from 'mobx-depot';
      ${this.scalarImports}
      ${this.modelImports}
    `;
  }

  className(name = this.modelType.name, base = false) {
    return `${name}${base ? 'BaseModel' : 'Model'}`;
  }

  get baseModelClassName() {
    return this.className(this.modelType.name, true);
  }

  get userEditableModelClassName() {
    return this.className(this.modelType.name, false);
  }

  get header() {
    return `export class ${this.baseModelClassName} {`;
  }

  get constructorFunction() {
    // TODO: Is Partial ideal here? I think it could include functions, which is not ideal
    return indentString(dedent`
      constructor(init: Partial<${this.baseModelClassName}>) {
        this.assign(init);
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
          type = this.className(typeNameWithoutArray, false);

          if (isArray) type += '[]';
        }

        const isNullable = typeIsNullable(field.type);
        if (isNullable) type += ' | null';

        return indentString(`@Selectable() ${field.name}!: ${type};`, 2);
      })
      .filter(Boolean)

    return [
      indentString(`store = getRootStore();`, 2),
      ...fieldProperties,
    ].join('\n');
  }

  get selectedDataGetter() {
    return indentString(dedent`
      get selectedData() {
        const data: Partial<this> = {};
        const keys: (keyof this)[] = [${this.modelType.fields.map(f => `'${f.name}'`).join(', ')}]
    
        keys.forEach(key => {
          try {
            data[key] = this[key];
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

  get baseModelWarning() {
    return dedent`
      // To add your own functionality, go to ${this.userEditableModelFileName}
    `;
  }

  get assignMethod() {
    return indentString(dedent`
      assign(data: Partial<${this.baseModelClassName}>) {
        assignInstanceProperties(this, data);
      }
    `, 2);
  }

  get propertySetter() {
    return indentString(dedent`
      set<K extends keyof this>(key: K, value: this[K]) {
        this[key] = value;
      }
    `, 2);
  }

  get ensureSelectedMethod() {
    return indentString(dedent`
      ensureSelected<K extends keyof this>(key: K): asserts this is this & { [k in K]: this[k] }
        if (this[key] === undefined) throw new Error(\`Property \${key} is not selected\`);
      }
    `, 2).replace(/\\/g, '');
  }

  get baseModelCode() {
    const segments = [
      this.baseModelWarning,
      this.imports,
      this.header,
      this.properties,
      this.constructorFunction,
      this.selectedDataGetter,
      this.propertySetter,
      this.assignMethod,
      this.footer,
      this.selectorGenerator.code,
    ];

    return segments.join('\n');
  }

  get userEditableModelCode() {
    return dedent`
      import { makeModelObservable } from 'mobx-depot';
      import { ${this.baseModelClassName} } from './depot/base/${this.baseModelClassName}';
      
      export class ${this.userEditableModelClassName} extends ${this.baseModelClassName} {
        constructor(init: Partial<${this.userEditableModelClassName}> = {}) {
          super(init);
          
          makeModelObservable(this);
        }
      }
    `
  }
}

export function typeIsNonNullable(type: { kind: string }): boolean {
  return type.kind === 'NON_NULL';
}

export function typeIsNullable(type: { kind: string }): boolean {
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