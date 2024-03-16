import {getTypeKind, getTypeName, ModelGenerator, typeIsNullable} from "./ModelGenerator";
import {referencesModel} from "../makeIntrospectionQuery";
import dedent from "dedent";
import {indentString} from "../lib/indentString";
import { pascalCase } from "change-case";
import {IntrospectionObjectType} from "graphql/utilities/getIntrospectionQuery";

export class ModelSelectorGenerator {
  objectType: IntrospectionObjectType;

  constructor(objectType: IntrospectionObjectType) {
    this.objectType = objectType;
  }

  get modelNestedObjectFields() {
    return this.objectType.fields
      .filter(field => referencesModel(field.type))
  }

  get selectorFunctionImports() {
    return this.modelNestedObjectFields
      .map(({ type }) => {
        const modelName = getTypeName(type, { normalizeName: true, stripArrayType: true });

        // Types can have fields that reference their own type, so in that case
        // we don't want to import those functions since they'll already be declared
        if (modelName === this.objectType.name) return;

        return `import { selectFrom${modelName}, ${modelName}SelectionBuilder } from "./${modelName}Selector"`
      })
      .filter(Boolean)
      .reduce((imports, current) => {
        if (!current) return imports;
        if (!imports.includes(current)) imports.push(current);
        return imports;
      }, [] as string[])
      .join('\n');
  }

  get imports() {
    return dedent`
      import { Selection } from 'mobx-depot';
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

  get primitiveKeysVariableName() {
    return `${this.objectType.name}PrimitiveKeys`;
  }


  get proxyType() {
    const typeName = `${this.objectType.name}SelectorProxy`;
    const nestedProxyGetters = this.modelNestedObjectFields.map(({ name, type, args }) => {
      const hasArgs = args?.length > 0;
      const definition = `(${hasArgs ? `args: ${pascalCase(name)}Args, ` : ''}builder: ${getTypeName(type, { normalizeName: true, stripArrayType: true })}SelectionBuilder) => ${this.objectType.name}SelectorProxy`
      return `${name}: ${definition};`
    })

    // This makes me want to gouge my eyes out! :^)
    let type =
`export type ${typeName} = {${this.hasPrimitives ? `
  [key in typeof ${this.primitiveKeysVariableName}[number]]: ${typeName}; 
} & {
  /**
    * Adds the following fields to the selection:
${indentString(this.primitiveFields.map(({ name, type }) => `* - \`${name}\`: \`${getTypeName(type)}\``).join('\n'), 4)}
    */
  primitives: ${typeName};` : ''}${nestedProxyGetters.length > 0 ? `\n${indentString(nestedProxyGetters.join('\n'), 2)}` : ''}
}`;

    return type;
  }

  get primitiveFields() {
    return this.objectType.fields
      .filter(field => field.name !== 'id' && !referencesModel(field.type) && field.name !== 'clientMutationId')
  }

  get hasPrimitives() {
    return this.primitiveFields.length > 0;
  }

  get hasIdField() {
    return this.objectType.fields.some(field => field.name === 'id');
  }

  get proxyGenerator() {
    // TODO: DRY
    const typeName = `${this.objectType.name}SelectorProxy`;
    const selectionBuilderTypeName = `${this.objectType.name}SelectionBuilder`;

    return dedent`
      ${this.hasPrimitives ? `const ${this.primitiveKeysVariableName} = [${this.primitiveFields.map(f => `"${f.name}"`).join(', ')}] as const` : ''};
      
      export type ${selectionBuilderTypeName} = (proxy: ${typeName}) => ${typeName};
      
      export function selectFrom${this.objectType.name}(build: ${selectionBuilderTypeName}) {
        const selections: Selection[] = [
          { fieldName: '__typename' },
          ${this.hasIdField ? `{ fieldName: 'id' },` : ''}
        ];
        
        const proxy: ${typeName} = new Proxy({}, {
          get(target, prop) {
            switch (prop) {${this.hasNestedObjects ? `\n${indentString(this.proxyGeneratorNestedObjectSwitchCases, 6)}` : ''}
              ${this.hasPrimitives ? `case 'primitives':
                selections.push(...${this.primitiveKeysVariableName}.map(key => ({ fieldName: key })));   
                break;` : ''}
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

  get code() {
    const segments = [
      this.nestedObjectArgsTypes,
      this.proxyGenerator,
      this.proxyType,
    ]

    return segments.join('\n\n');
  }
}
