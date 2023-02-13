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
    /*
      type LoginUserPayloadSelectorProxy = {
        [key in keyof Omit<LoginUserPayloadProperties, 'user' | 'userErrors'>]: LoginUserPayloadSelectorProxy;
      } & {
        user: (cb: (proxy: UserSelectorProxy) => unknown) => LoginUserPayloadSelectorProxy;
        userErrors: (cb: (proxy: UserErrorSelectorProxy) => unknown) => LoginUserPayloadSelectorProxy;
      }
    */
    const typeName = `${this.model.baseModelClassName}SelectorProxy`;
    const nestedObjectNameUnion = this.modelNestedObjectFields.map(({ name }) => `'${name}'`).join(' | ');
    const nestedProxyGetters = this.modelNestedObjectFields.map(({ name, type }) =>
      `${name}: (cb: (proxy: ${pascalCase(this.model.className(getTypeName(type), true))}SelectorProxy) => unknown) => ${typeName};`
    )

    let type = dedent`
      export type ${typeName} = {
        [key in keyof ${this.hasNestedObjects ? `Omit<${this.model.baseModelClassName}, ${nestedObjectNameUnion}>` : this.model.baseModelClassName}]: ${typeName}; 
      } ${nestedProxyGetters.length > 0 ? `& {
        ${nestedProxyGetters.join('\n')}
      }` : ''}
    `;

    return type;
  }

  get proxyGenerator() {
    // DRY
    const typeName = `${this.model.baseModelClassName}SelectorProxy`;

    return dedent`
      export function selectFrom${this.model.baseModelClassName}(build: (proxy: ${typeName}) => ${typeName}) {
        const selectedKeys: StringTree = [];
        
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


/*
type LoginUserPayloadSelectorProxy = {
  [key in keyof Omit<LoginUserPayloadProperties, 'user' | 'userErrors'>]: LoginUserPayloadSelectorProxy;
} & {
  user: (cb: (proxy: UserSelectorProxy) => unknown) => LoginUserPayloadSelectorProxy;
  userErrors: (cb: (proxy: UserErrorSelectorProxy) => unknown) => LoginUserPayloadSelectorProxy;
}

type StringTree = (string | StringTree)[];

export function selectFromLoginUserPayload(build: (proxy: LoginUserPayloadSelectorProxy) => LoginUserPayloadSelectorProxy) {
  const selectedKeys: StringTree = [];

  const proxy: LoginUserPayloadSelectorProxy = new Proxy(new LoginUserPayloadProperties({}), {
    get(target, prop) {
      selectedKeys.push(prop as string);

      switch (prop) {
        case 'user':
          return (buildUser: (proxy: UserSelectorProxy) => UserSelectorProxy) => {
            selectedKeys.push(selectFromUser(buildUser));
            return proxy;
          }
      }

      return proxy;
    }
  }) as unknown as LoginUserPayloadSelectorProxy;

  build(proxy);

  return selectedKeys;
}
 */