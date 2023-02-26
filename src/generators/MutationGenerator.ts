import {
  IntrospectionField,
  IntrospectionInputTypeRef,
} from "graphql/utilities/getIntrospectionQuery";
import {pascalCase} from "change-case";
import {getTypeKind, getTypeName} from "./ModelGenerator";
import dedent from "dedent";
import {indentString} from "../lib/indentString";
import {isScalarType, scalarIsPrimitive} from "../generate";

export class MutationGenerator {
  field: IntrospectionField;

  constructor(field: IntrospectionField) {
    this.field = field;
  }

  get fileName() {
    return `${this.className}.ts`;
  }

  get mutationVariableImports() {
    const imports: string[] = [];

    this.field.args.forEach(field => {
      if (getTypeKind(field.type) === 'INPUT_OBJECT') {
        imports.push(`import { ${getTypeName(field.type)} } from '../inputs/${getTypeName(field.type)}';`);
      }

      if (isScalarType(field.type) && !scalarIsPrimitive(field.type)) {
        imports.push(`import { ${getTypeName(field.type)} } from '../scalars';`);
      }
    });

    return imports;
  }

  get fieldTypeName() {
    return getTypeName(this.field.type, { normalizeName: true, stripArrayType: true });
  }

  get payloadModelName() {
    return `${this.fieldTypeName}Model`;
  }

  get payloadSelectorName() {
    return `selectFrom${this.fieldTypeName}`;
  }

  get selectionBuilderType() {
    return `${this.fieldTypeName}SelectionBuilder`;
  }

  get payloadSelectorImport() {
    return `import { ${this.payloadSelectorName}, ${this.selectionBuilderType} } from '../base/${this.fieldTypeName}BaseModel';`;
  }

  get imports() {
    return [
      "import { makeAutoObservable } from 'mobx';",
      "import { gql } from 'graphql-request';",
      "import { buildSelection } from 'mobx-depot';",
      `import { ${this.payloadModelName} } from '../../${this.payloadModelName}';`,
      "import { getGraphQLClient, getRootStore } from '../rootStore';",
      this.payloadSelectorImport,
      ...this.mutationVariableImports,
    ].join('\n');
  }

  get className() {
    return `${pascalCase(this.field.name)}Mutation`;
  }

  get header() {
    return `export class ${this.className} {`;
  }

  get argumentsTypeName() {
    return `${this.className}Arguments`;
  }

  get argumentsType() {
    if (!this.hasArgs) return '';

    return `type ${this.argumentsTypeName} = { ${this.argDefinitions.join(', ')} };`
  }

  get dataTypeName() {
    return `${this.className}Data`;
  }

  get fieldReturnsArray() {
    // yuck
    return getTypeName(this.field.type, { normalizeName: true, stripArrayType: false }).endsWith('[]');
  }

  get dataType() {
    return `type ${this.dataTypeName} = { ${this.field.name}: ${this.payloadModelName}${this.fieldReturnsArray ? '[]': ''} };`;
  }

  get argDefinitions() {
    return this.field.args.map(arg => `${arg.name}: ${getTypeName(arg.type)}`);
  }

  get hasArgs() {
    return this.argDefinitions.length > 0;
  }

  get constructorFunction() {
    return indentString(
      [
        `constructor(${this.hasArgs ? `args: ${this.argumentsTypeName}, ` : ''}select: ${this.selectionBuilderType}) {`,
        this.hasArgs && indentString('this.args = args;', 2),
        indentString(`this.selection = buildSelection(${this.payloadSelectorName}(select));`, 2),
        indentString("makeAutoObservable(this);", 2),
        '}',
      ].join('\n'),
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
        'error: Error | null = null;',
        'loading = false;',
        `data: ${this.dataTypeName} | null = null;`,
        `mutatePromise: Promise<${this.dataTypeName}> | null = null;`,
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
      let definition = `$${arg.name}: ${getTypeName(arg.type, { normalizeName: false, stripArrayType: false })}`;

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
          mutation ${pascalCase(this.field.name)}(${this.documentVariableDefinitions}) {
            ${this.field.name}(${this.documentVariables}) 
              \${this.selection}
          }
        \`
      }
    `, 2).replace(/\\/g, '');
  }

  get setArgsMethod() {
    return indentString(dedent`
      setArgs(args: ${this.argumentsTypeName}) {
        this.args = args;
      }
    `, 2);
  }

  get setLoadingMethod() {
    return indentString(dedent`
      setLoading(loading: boolean) {
        this.loading = loading;
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

  get setMutatePromiseMethod() {
    return indentString(dedent`
      setMutatePromise(promise: Promise<${this.dataTypeName}> | null) {
        this.mutatePromise = promise;
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

  get mutateMethod() {
    return indentString(dedent`
      async mutate() {    
        this.setError(null);
        this.setLoading(true);    
        
        const promise = (async () => {
          const data = await this.__client.request(this.document${this.hasArgs ? ', this.args' : ''});
          const resolvedData = this.__rootStore.resolve(data) as ${this.dataTypeName};
          
          this.setData(resolvedData);
          
          return resolvedData;
        })();
        
        this.setMutatePromise(promise);
        
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
      this.setArgsMethod,
      this.setLoadingMethod,
      this.setDataMethod,
      this.setMutatePromiseMethod,
      this.setErrorMethod,
      this.mutateMethod,
      this.footer
    ];

    return segments.join('\n');
  }
}