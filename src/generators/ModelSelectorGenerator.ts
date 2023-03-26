import {getTypeName, ModelGenerator} from "./ModelGenerator";
import {referencesModel} from "../makeIntrospectionQuery";
import dedent from "dedent";
import {indentString} from "../lib/indentString";
import { pascalCase } from "change-case";

type ModelSelectorGeneratorOpts = {
  idFieldName: string;
}

export class ModelSelectorGenerator {
  model: ModelGenerator;
  opts: ModelSelectorGeneratorOpts

  constructor(model: ModelGenerator, opts: ModelSelectorGeneratorOpts) {
    this.opts = opts;
    this.model = model;
  }

  get idFieldName() {
    return this.opts.idFieldName;
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

  get imports() {
    return dedent`
      import { Selection } from 'mobx-depot';
      ${this.selectorFunctionImports}
    `
  }

  get hasNestedObjects() {
    return this.modelNestedObjectFields.length > 0;
  }

  get nestedBuilderTypes() {
    return this.modelNestedObjectFields.map(({ name, type, args }) => {
      const typeName = `${pascalCase(name)}Field`;
      let definition = `((builder: ${getTypeName(type, { normalizeName: true, stripArrayType: true })}SelectionBuilder) => ${this.model.modelType.name}SelectorProxy)`;

      // This makes me sad :(
      if (args?.length) {
        definition += ` & {
${indentString(
  args.map(arg => `${arg.name}: (${arg.name}: ${getTypeName(arg.type)}) => ${typeName};`).join('\n'),
  2
)}
}`
      }

      return `type ${typeName} = ${definition};`;
    }).join('\n')
  }

  get proxyType() {
    const typeName = `${this.model.modelType.name}SelectorProxy`;
    const nestedProxyGetters = this.modelNestedObjectFields.map(({ name }) => {
      return `${name}: ${pascalCase(name)}Field;`
    })

    const omits = [
      ...this.modelNestedObjectFields.map(({ name }) => `'${name}'`),
      `'${this.model.setMethodName}'`, // Need to omit other methods from the class
      `'${this.model.assignMethodName}'`,
      `'${this.model.selectedDataMethodName}'`,
    ]

    if (this.model.hasIdField) omits.push(`'${this.idFieldName}'`);

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
    return this.model.modelType.fields
      .filter(field => field.name !== this.idFieldName && !referencesModel(field.type))
  }

  get proxyGenerator() {
    // TODO: DRY
    const typeName = `${this.model.modelType.name}SelectorProxy`;
    const selectionBuilderTypeName = `${this.model.modelType.name}SelectionBuilder`;

    return dedent`
      const primitiveKeys = [${this.primitiveFields.map(f => `"${f.name}"`).join(', ')}];
      
      export type ${selectionBuilderTypeName} = (proxy: ${typeName}) => ${typeName};
      
      export function selectFrom${this.model.modelType.name}(build: ${selectionBuilderTypeName}) {
        const selections: Selection[] = [
          { fieldName: '__typename' },
          ${this.model.hasIdField ? `{ fieldName: '${this.idFieldName}' },` : ''}
        ];
        
        const proxy: ${typeName} = new Proxy({}, {
          get(target, prop) {
            switch (prop) {${this.hasNestedObjects ? `\n${indentString(this.proxyGeneratorNestedObjectSwitchCases, 6)}` : ''}
              case 'primitives':
                selections.push(...primitiveKeys.map(key => ({ fieldName: key })));   
                break;
              default:
                selections.push({ fieldName: prop as string });
                break;
            }
            
            return proxy;
          }
        }) as unknown as ${typeName};
        
        build(proxy);
        
        return selections;
      }
    `
  }

  get proxyGeneratorNestedObjectSwitchCases() {
    return this.modelNestedObjectFields.map(({ name, type, args }) => {
      const fieldModelName = getTypeName(type, { stripArrayType: true, normalizeName: true });

      return `
        case '${name}':
          const args: Record<string, any> = {};
          
          const builder = (build: ${fieldModelName}SelectionBuilder) => {
            selections.push({ fieldName: prop as string, children: selectFrom${fieldModelName}(build), args });
            
            return proxy;
          }
          ${args?.map(({ name, type }) => {
            return `
          builder.${name} = (value: ${getTypeName(type)}) => {
            args.${name} = value;
            return builder;
          }
`;
          }).join('') || ''}
          return builder;`;
    }).join('');
  }

  get code() {
    const segments = [
      this.imports,
      this.nestedBuilderTypes,
      this.proxyType,
      this.proxyGenerator,
    ]

    return segments.join('\n\n');
  }
}
