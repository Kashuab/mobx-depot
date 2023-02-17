import {IntrospectionField, IntrospectionInputTypeRef} from "graphql/utilities/getIntrospectionQuery";
import {pascalCase} from "change-case";
import {getTypeName, typeIsNullable} from "./ModelGenerator";
import {indentString} from "../lib/indentString";
import dedent from "dedent";
import {isScalarType, scalarIsPrimitive} from "../generate";


// TODO: DRY this up. Very similar to MutationGenerator
export class QueryGenerator {
  field: IntrospectionField;
  
  constructor(field: IntrospectionField) {
    this.field = field;
  }

  get fileName() {
    return `${this.className}.ts`;
  }

  get queryArgumentImports() {
    const imports: string[] = [];

    this.field.args.forEach(field => {
      if (field.type.kind === 'INPUT_OBJECT') {
        imports.push(`import { ${field.type.name} } from '../inputs/${field.type.name}';`);
      }

      if (isScalarType(field.type) && !scalarIsPrimitive(field.type)) {
        imports.push(`import { ${getTypeName(field.type)} } from '../scalars';`);
      }
    });

    return imports;
  }

  get imports() {
    return [
      "import { makeAutoObservable } from 'mobx';",
      "import { gql } from 'graphql-request';",
      "import { buildSelection } from 'mobx-depot';",
      "import { getGraphQLClient, getRootStore } from '../rootStore';",
      `import { ${this.payloadModelName} } from '../../${this.payloadModelName}';`,
      `import { ${this.payloadSelectorName} } from '../base/${this.fieldTypeName}Properties';`,
      ...this.queryArgumentImports,
    ].join('\n');
  }

  get className() {
    return `${pascalCase(this.field.name)}Query`;
  }

  get header() {
    return `export class ${this.className} {`;
  }

  get argDefinitions() {
    return this.field.args.map(arg => {
      const optional = typeIsNullable(arg.type);
      return `${arg.name}${optional ? '?' : ''}: ${getTypeName(arg.type)}`;
    });
  }

  get hasArgs() {
    return this.argDefinitions.length > 0;
  }

  get constructorAssignments() {
    return this.field.args.map(arg => `this.${arg.name} = ${arg.name};`);
  }

  get argumentsTypeName() {
    return `${this.className}Arguments`;
  }

  get argumentsType() {
    if (!this.hasArgs) return '';

    return `type ${this.argumentsTypeName} = { ${this.argDefinitions.join(', ')} };`
  }

  get fieldTypeName() {
    return getTypeName(this.field.type);
  }

  get payloadSelectorName() {
    return `selectFrom${this.fieldTypeName}Properties`;
  }

  get constructorFunction() {
    return indentString(
      [
        `constructor(${this.hasArgs ? `args: ${this.argumentsTypeName}, ` : ''}select: Parameters<typeof ${this.payloadSelectorName}>[0]) {`,
        this.hasArgs && indentString("this.args = args;", 2),
        indentString(`this.selection = buildSelection(${this.payloadSelectorName}(select));`, 2),
        indentString("makeAutoObservable(this);", 2),
        '}',
      ].filter(Boolean).join('\n'),
      2,
    )
  }

  get properties() {
    return indentString(
      [
        '__rootStore = getRootStore();',
        '__client = getGraphQLClient();',
        this.hasArgs && `args: ${this.argumentsTypeName};`,
        'selection: string;',
        'loading = false;',
      ].filter(Boolean).join('\n'),
      2,
    )
  }

  get documentVariables() {
    // TODO: I'm building this with a Rails GQL API, so I'm not sure if this is a general solution.
    // Every mutation I've seen so far has a single argument, which is an input object. This will certainly
    // NOT be the case for all GQL APIs.
    return this.field.args.reduce((variables, arg) => {
      variables.push(`${arg.name}: $${arg.name}`);

      return variables;
    }, [] as string[]).join(', ');
  }

  get documentVariableDefinitions() {
    // TODO: Multiple argument mutations
    return this.field.args.reduce((variables, arg) => {
      let definition = `$${arg.name}: ${getTypeName(arg.type, { normalizeName: false })}`;

      if (arg.type.kind === 'NON_NULL') {
        definition += '!';
      }

      variables.push(definition);

      return variables;
    }, [] as string[]).join(', ');
  }

  get documentGetter() {
    return indentString(dedent`
      get document() {
        return gql\`
          query ${pascalCase(this.field.name)}${this.documentVariableDefinitions ? `(${this.documentVariableDefinitions})` : ''} {
            ${this.field.name}${this.documentVariables ? `(${this.documentVariables})` : ''} {
              \${this.selection}
            }
          }
        \`
      }
    `, 2).replace(/\\/g, '');
  }

  get setLoadingMethod() {
    return indentString(dedent`
      setLoading(loading: boolean) {
        this.loading = loading;
      }
    `, 2);
  }

  get payloadModelName() {
    return `${this.fieldTypeName}Model`;
  }

  get queryMethod() {
    return indentString(dedent`
      async query() {
        this.setLoading(true);
        
        const data = await this.__client.request<{ ${this.field.name}: ${this.payloadModelName} }>(this.document${this.hasArgs ? ', this.args' : ''});
        this.setLoading(false);
        
        return this.__rootStore.resolve(data);
      }
    `, 2);
  }

  get footer() {
    return '}';
  }

  get code() {
    const segments = [
      this.imports,
      this.argumentsType,
      this.header,
      this.properties,
      this.constructorFunction,
      this.documentGetter,
      this.setLoadingMethod,
      this.queryMethod,
      this.footer
    ];

    return segments.join('\n');
  }
}