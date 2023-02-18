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

  get proxyTypeImports() {
    return this.modelNestedObjectFields.map(({ type }) => {
      const className = pascalCase(this.model.className(getTypeName(type, { normalizeName: true, stripArrayType: true }), true));
      return `import { ${className}SelectorProxy } from "./${className}"`
    }).join('\n');
  }

  get selectorFunctionImports() {
    return this.modelNestedObjectFields.map(({ type }) => {
      const className = pascalCase(this.model.className(getTypeName(type, { normalizeName: true, stripArrayType: true }), true));
      return `import { selectFrom${className} } from "./${className}"`
    }).join('\n');
  }

  get hasNestedObjects() {
    return this.modelNestedObjectFields.length > 0;
  }

  get proxyType() {
    const typeName = `${this.model.baseModelClassName}SelectorProxy`;
    const nestedProxyGetters = this.modelNestedObjectFields.map(({ name, type }) =>
      `${name}: (cb: (proxy: ${pascalCase(this.model.className(getTypeName(type), true))}SelectorProxy) => unknown) => ${typeName};`
    )

    const omits = this.modelNestedObjectFields.map(({ name }) => `'${name}'`);

    // TODO: Opinionated ID field name
    if (this.model.hasIdField) omits.push("'id'");

    const keyofType = omits.length > 0 ? `Omit<${this.model.baseModelClassName}, ${omits.join(' | ')}>` : this.model.baseModelClassName;

    let type = dedent`
      export type ${typeName} = {
        [key in keyof ${keyofType}]: ${typeName}; 
      } ${nestedProxyGetters.length > 0 ? `& {
        ${nestedProxyGetters.join('\n')}
      }` : ''}
    `;

    return type;
  }

  get proxyGenerator() {
    // TODO: DRY
    const typeName = `${this.model.baseModelClassName}SelectorProxy`;

    // TODO: Opinionated 'id' field name
    return dedent`
      export function selectFrom${this.model.baseModelClassName}(build: (proxy: ${typeName}) => ${typeName}) {
        const selectedKeys: StringTree = ['__typename'${this.model.hasIdField ? ", 'id'" : ''}];
        
        const proxy: ${typeName} = new Proxy(new ${this.model.baseModelClassName}({}), {
          get(target, prop) {
            selectedKeys.push(prop as string);
            ${this.hasNestedObjects ? indentString(this.proxyGeneratorNestedObjectSwitch, 6) : ''}
            return proxy;
          }
        }) as unknown as ${typeName};
        
        build(proxy);
        
        return selectedKeys;
      }
    `
  }

  get proxyGeneratorNestedObjectSwitch() {
    const cases = this.modelNestedObjectFields.map(({ name, type }) => {
      const fieldModelName = pascalCase(this.model.className(getTypeName(type), true));
      const selectorProxyName = `${fieldModelName}SelectorProxy`;

      return `
        case '${name}':
          return (build: (proxy: ${selectorProxyName}) => ${selectorProxyName}) => {
            selectedKeys.push(selectFrom${fieldModelName}(build));
            return proxy;
          }`;
    }).join('');

    return `
      switch (prop) {${cases}
      }
    `;
  }

  get stringTreeType() {
    return dedent`
      type StringTree = (string | StringTree)[];
    `;
  }

  get code() {
    const segments = [
      this.selectorFunctionImports,
      this.proxyTypeImports,
      this.proxyType,
      this.stringTreeType,
      this.proxyGenerator,
    ]

    return segments.join('\n\n');
  }
}
