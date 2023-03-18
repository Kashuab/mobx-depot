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

  get payloadSelectorImport() {
    return `import { ${this.payloadSelectorName}, ${this.selectionBuilderType} } from '../base/${this.fieldTypeName}BaseModel';`;
  }

  get imports() {
    return [
      "import { makeAutoObservable } from 'mobx';",
      "import { gql } from 'graphql-request';",
      "import { buildSelection } from 'mobx-depot';",
      "import { getGraphQLClient, getRootStore } from '../rootStore';",
      `import { ${this.payloadModelName} } from '../../${this.payloadModelName}';`,
      this.payloadSelectorImport,
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
    return getTypeName(this.field.type, { normalizeName: true, stripArrayType: true });
  }

  get payloadSelectorName() {
    return `selectFrom${this.fieldTypeName}`;
  }

  get selectionBuilderType() {
    return `${this.fieldTypeName}SelectionBuilder`;
  }

  get constructorFunction() {
    return indentString(
      [
        `constructor(${this.hasArgs ? `args: ${this.argumentsTypeName}, ` : ''}select: ${this.selectionBuilderType}) {`,
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
        'error: Error | null = null;',
        `data: ${this.dataTypeName} | null = null;`,
        `queryPromise: Promise<${this.dataTypeName}> | null = null;`,
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
            ${this.field.name}${this.documentVariables ? `(${this.documentVariables})` : ''} 
              \${this.selection}
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

  get setArgsMethod() {
    return indentString(dedent`
      setArgs(args: ${this.argumentsTypeName}) {
        this.args = args;
      }
    `, 2);
  }

  get setDataMethod() {
    return indentString(dedent`
      setData(data: ${this.dataTypeName} | null) {
        this.data = data;
      }
    `, 2);
  }

  get setQueryPromiseMethod() {
    return indentString(dedent`
      setQueryPromise(promise: Promise<${this.dataTypeName}> | null) {
        this.queryPromise = promise;
      }
    `, 2);
  }

  get setErrorMethod() {
    return indentString(dedent`
      setError(error: Error | null) {
        this.error = error;
      }
    `, 2);
  }

  get payloadModelName() {
    return `${this.fieldTypeName}Model`;
  }

  get dataTypeName() {
    return `${this.className}Data`;
  }

  get fieldReturnsArray() {
    // yuck
    return getTypeName(this.field.type, { normalizeName: true }).endsWith('[]');
  }

  get dataType() {
    return `type ${this.dataTypeName} = { ${this.field.name}: ${this.payloadModelName}${this.fieldReturnsArray ? '[]' : ''} };`;
  }

  get queryMethod() {
    return indentString(dedent`
      async query() {    
        this.setError(null);
        this.setLoading(true);    
        
        const promise = (async () => {
          const data = await this.__client.request(this.document${this.hasArgs ? ', this.args' : ''});
          const resolvedData = this.__rootStore.resolve(data, 'remote') as ${this.dataTypeName};
          
          this.setData(resolvedData);
          
          return resolvedData;
        })();
        
        this.setQueryPromise(promise);
        
        let result: ${this.dataTypeName} | null = null;
        
        try {
          result = await promise;
        } catch (err) {
          console.error(err);
          this.setError(err instanceof Error ? err : new Error(err as string));
        }
        
        this.setLoading(false);
        
        return result;
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
      this.dataType,
      this.header,
      this.properties,
      this.constructorFunction,
      this.documentGetter,
      this.setLoadingMethod,
      this.hasArgs && this.setArgsMethod,
      this.setDataMethod,
      this.setQueryPromiseMethod,
      this.setErrorMethod,
      this.queryMethod,
      this.footer
    ].filter(Boolean);

    return segments.join('\n');
  }
}