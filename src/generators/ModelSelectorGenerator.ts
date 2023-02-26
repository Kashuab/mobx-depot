import {getTypeName, ModelGenerator} from "./ModelGenerator";
import {referencesModel} from "../makeIntrospectionQuery";
import {pascalCase} from "change-case";
import dedent from "dedent";
import {indentString} from "../lib/indentString";

export class ModelSelectorGenerator {
  model: ModelGenerator;

  constructor(model: ModelGenerator) {
    this.model = model;
  }

  get modelNestedObjectFields() {
    return this.model.modelType.fields
      .filter(field => referencesModel(field.type))
  }

  get selectorFunctionImports() {
    return this.modelNestedObjectFields.map(({ type }) => {
      const modelName = getTypeName(type, { normalizeName: true, stripArrayType: true });
      return `import { selectFrom${modelName}, ${modelName}SelectionBuilder } from "./${modelName}BaseModel"`
    }).join('\n');
  }

  get hasNestedObjects() {
    return this.modelNestedObjectFields.length > 0;
  }

  get proxyType() {
    const typeName = `${this.model.modelType.name}SelectorProxy`;
    const nestedProxyGetters = this.modelNestedObjectFields.map(({ name, type }) =>
      `${name}: (builder: ${getTypeName(type, { normalizeName: true, stripArrayType: true })}SelectionBuilder) => ${typeName};`
    )

    const omits = [
      ...this.modelNestedObjectFields.map(({ name }) => `'${name}'`),
      "'set'", // Need to omit other methods from the class
      "'assign'",
      "'selectedData'",
      "'store'",
    ]

    // TODO: Opinionated ID field name
    if (this.model.hasIdField) omits.push("'id'");

    // This makes me want to gouge my eyes out! :^)
    let type =
`export type ${typeName} = {
  [key in keyof Omit<${this.model.baseModelClassName}, ${omits.join(' | ')}>]: ${typeName}; 
} & {
  /**
    * Adds the following fields to the selection:
${indentString(this.primitiveFields.map(({ name, type }) => `* - \`${name}\`: \`${getTypeName(type)}\``).join('\n'), 4)}
    */
  primitives: ${typeName};${nestedProxyGetters.length > 0 ? `\n${indentString(nestedProxyGetters.join('\n'), 2)}` : ''}
}`;

    return type;
  }

  get primitiveFields() {
    return this.model.modelType.fields // TODO: Opinionated 'id' field name
      .filter(field => field.name !== 'id' && !referencesModel(field.type))
  }

  get proxyGenerator() {
    // TODO: DRY
    const typeName = `${this.model.modelType.name}SelectorProxy`;
    const selectionBuilderTypeName = `${this.model.modelType.name}SelectionBuilder`;

    // TODO: Opinionated 'id' field name
    return dedent`
      const primitiveKeys = [${this.primitiveFields.map(f => `"${f.name}"`).join(', ')}];
      
      export type ${selectionBuilderTypeName} = (proxy: ${typeName}) => ${typeName};
      
      export function selectFrom${this.model.modelType.name}(build: ${selectionBuilderTypeName}) {
        const selectedKeys: StringTree = ['__typename'${this.model.hasIdField ? ", 'id'" : ''}];
        
        const proxy: ${typeName} = new Proxy({}, {
          get(target, prop) {
            switch (prop) {${this.hasNestedObjects ? `\n${indentString(this.proxyGeneratorNestedObjectSwitchCases, 6)}` : ''}
              case 'primitives':
                selectedKeys.push(...primitiveKeys);   
                break;
              default:
                selectedKeys.push(prop as string);
                break;
            }
            
            return proxy;
          }
        }) as unknown as ${typeName};
        
        build(proxy);
        
        return selectedKeys;
      }
    `
  }

  get proxyGeneratorNestedObjectSwitchCases() {
    return this.modelNestedObjectFields.map(({ name, type }) => {
      const fieldModelName = getTypeName(type, { stripArrayType: true, normalizeName: true });

      return `
        case '${name}':
          return (build: ${fieldModelName}SelectionBuilder) => {
            selectedKeys.push(prop as string, selectFrom${fieldModelName}(build));
            return proxy;
          }`;
    }).join('');
  }

  get stringTreeType() {
    return dedent`
      type StringTree = (string | StringTree)[];
    `;
  }

  get code() {
    const segments = [
      this.selectorFunctionImports,
      this.proxyType,
      this.stringTreeType,
      this.proxyGenerator,
    ]

    return segments.join('\n\n');
  }
}
