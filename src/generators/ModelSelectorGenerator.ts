import {getTypeKind, getTypeName, ModelGenerator, typeIsNullable} from "./ModelGenerator";
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
    return this.modelNestedObjectFields
      .map(({ type }) => {
        const modelName = getTypeName(type, { normalizeName: true, stripArrayType: true });
        return `import { selectFrom${modelName}, ${modelName}SelectionBuilder } from "./${modelName}Selector"`
      })
      .reduce((imports, current) => {
        if (!imports.includes(current)) imports.push(current);
        return imports;
      }, [] as string[])
      .join('\n');
  }

  get imports() {
    return dedent`
      import { Selection } from 'mobx-depot';
      import { ${this.model.baseModelClassName} } from '../${this.model.baseModelClassName}';
      ${this.selectorFunctionImports}
      ${this.nestedObjectArgsImports}
    `
  }

  get hasNestedObjects() {
    return this.modelNestedObjectFields.length > 0;
  }

  get nestedObjectArgsImports() {
    return this.modelNestedObjectFields
      .reduce((imports, { args }) => {
        if (!args?.length) return imports;

        args.forEach(arg => {
          let importStatement;

          if (getTypeKind(arg.type) === 'ENUM') {
            const typeName = getTypeName(arg.type, { normalizeName: true, stripArrayType: true });
            const importStatement = `import { ${typeName} } from '../../enums/${typeName}'`;

            if (!imports.includes(importStatement)) imports.push(importStatement);
          }
        })

        return imports;
      }, [] as string[])
      .filter(Boolean)
      .join('\n');
  }

  get nestedObjectArgsTypes() {
    return this.modelNestedObjectFields.map(({name, type, args}) => {
      if (!args?.length) return null;

      const typeName = `${pascalCase(name)}Args`;
      return `
type ${typeName} = {
${indentString(args.map(arg => `${arg.name}${typeIsNullable(arg.type) ? '?' : ''}: ${getTypeName(arg.type)};`).join('\n'), 2)}
}`
    }).filter(Boolean).join('\n');
  }


  get proxyType() {
    const typeName = `${this.model.modelType.name}SelectorProxy`;
    const nestedProxyGetters = this.modelNestedObjectFields.map(({ name, type, args }) => {
      const hasArgs = args?.length > 0;
      const definition = `(${hasArgs ? `args: ${pascalCase(name)}Args, ` : ''}builder: ${getTypeName(type, { normalizeName: true, stripArrayType: true })}SelectionBuilder) => ${this.model.modelType.name}SelectorProxy`
      return `${name}: ${definition};`
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
      const primitiveKeys: string[] = [${this.primitiveFields.map(f => `"${f.name}"`).join(', ')}];
      
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
      const hasArgs = args?.length > 0;

      return `
        case '${name}': {
          return (${hasArgs ? `args: ${pascalCase(name)}Args, ` : ''}build: ${fieldModelName}SelectionBuilder) => {
            selections.push({ fieldName: prop as string, children: selectFrom${fieldModelName}(build)${hasArgs ? ', args' : ''} });
            return proxy;
          }
        }`;
    }).join('');
  }

  get fileName() {
    return `${this.model.modelType.name}Selector.ts`;
  }

  get code() {
    const segments = [
      this.imports,
      this.nestedObjectArgsTypes,
      this.proxyType,
      this.proxyGenerator,
    ]

    return segments.join('\n\n');
  }
}
