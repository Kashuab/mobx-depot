import {IntrospectionField} from "graphql/utilities/getIntrospectionQuery";
import {pascalCase} from "change-case";
import {getTypeKind, getTypeName, typeIsNullable} from "./ModelGenerator";
import {indentString} from "../lib/indentString";
import dedent from "dedent";
import {isScalarType, scalarIsPrimitive} from "../generate";

export class QueryGenerator {
  field: IntrospectionField;
  isMutationType: boolean;
  writeReactUtilities: boolean;
  
  constructor(field: IntrospectionField, isMutationType: boolean, writeReactUtilities: boolean) {
    this.field = field;
    this.isMutationType = isMutationType;
    this.writeReactUtilities = writeReactUtilities;
  }

  get fileName() {
    return `${this.className}.ts`;
  }

  // TODO: This needs to be tested in regards to scalars and enums
  get variableImports() {
    const imports: string[] = [];

    this.field.args.forEach(field => {
      const fieldTypeName = getTypeName(field.type, { normalizeName: true, stripArrayType: true });

      if (getTypeKind(field.type) === 'INPUT_OBJECT') {
        imports.push(`import { ${fieldTypeName} } from '../inputs/${getTypeName(field.type)}';`);
      }

      if (isScalarType(field.type) && !scalarIsPrimitive(field.type)) {
        imports.push(`import { ${fieldTypeName} } from '../scalars';`);
      }

      if (getTypeKind(field.type) === 'ENUM') {
        imports.push(`import { ${fieldTypeName} } from '../enums/${fieldTypeName}';`);
      }
    });

    return imports;
  }

  get payloadSelectorImport() {
    return `import { ${this.payloadSelectorName}, ${this.selectionBuilderType} } from '../base/selectors/${this.fieldTypeName}Selector';`;
  }

  get imports() {
    return [
      "import { makeAutoObservable } from 'mobx';",
      `import { buildSelection, CachePolicy, use${this.isMutationType ? 'Mutation' : 'Query'}, Use${this.isMutationType ? 'Mutation' : 'Query'}Opts } from 'mobx-depot';`,
      "import { getGraphQLClient } from '../rootStore';",
      `import { ${this.payloadModelName} } from '../../${this.payloadModelName}';`,
      this.payloadSelectorImport,
      ...this.variableImports,
    ].join('\n');
  }

  get className() {
    return `${pascalCase(this.field.name)}${this.isMutationType ? 'Mutation' : 'Query'}`;
  }

  get header() {
    return `export class ${this.className} {`;
  }

  get variableDefinitions() {
    return this.field.args.map(arg => {
      const optional = typeIsNullable(arg.type);
      return `${arg.name}${optional ? '?' : ''}: ${getTypeName(arg.type)}`;
    });
  }

  get hasVariables() {
    return this.variableDefinitions.length > 0;
  }

  get constructorAssignments() {
    return this.field.args.map(arg => `this.${arg.name} = ${arg.name};`);
  }

  get variablesTypeName() {
    return `${this.className}Variables`;
  }

  get variablesType() {
    if (!this.hasVariables) return '';

    return `type ${this.variablesTypeName} = { ${this.variableDefinitions.join(', ')} };`
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
        `constructor(${this.hasVariables ? `variables: ${this.variablesTypeName} | null, ` : ''}select: ${this.selectionBuilderType}, options: Options = {}) {`,
        indentString("this.options = options;", 2),
        this.hasVariables && indentString("this.variables = variables;", 2),
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
        '__client = getGraphQLClient();',
        this.hasVariables && `variables: ${this.variablesTypeName} | null;`,
        'selection: string;',
        'loading = false;',
        'error: Error | null = null;',
        `data: ${this.dataTypeName} | null = null;`,
        'options: Options = {};',
        `promise: Promise<${this.dataTypeName} | null> | null = null;`,
      ].filter(Boolean).join('\n'),
      2,
    )
  }

  get documentVariables() {
    // TODO: I'm building this with a Rails GQL API, so I'm not sure if this is a general solution.
    // Every mutation I've seen so far has a single variable, which is an input object. This will certainly
    // NOT be the case for all GQL APIs.
    return this.field.args.reduce((variables, arg) => {
      variables.push(`${arg.name}: $${arg.name}`);

      return variables;
    }, [] as string[]).join(', ');
  }

  get documentVariableDefinitions() {
    // TODO: Multiple variable mutations
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
        return \`
          ${this.isMutationType ? 'mutation' : 'query'} ${pascalCase(this.field.name)}${this.documentVariableDefinitions ? `(${this.documentVariableDefinitions})` : ''} {
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

  get setVariablesMethod() {
    return indentString(dedent`
      setVariables(variables: ${this.variablesTypeName}) {
        this.variables = variables;
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

  get setPromiseMethod() {
    return indentString(dedent`
      setPromise(promise: Promise<${this.dataTypeName} | null> | null) {
        this.promise = promise;
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

  get optionsType() {
    return `type Options = { cachePolicy?: CachePolicy };`;
  }

  get dispatchMethod() {
    return indentString(dedent`
      async dispatch(${this.hasVariables ? 'variables = this.variables' : ''}) {
        ${this.hasVariables ? `if (!variables) {
          throw new Error("${this.className} was dispatched without variables");
        }` : ''}
      
        this.setError(null);
        this.setLoading(true);
        
        const cachePolicy = ${this.isMutationType ? '"no-cache"' : "this.options.cachePolicy"};
        
        const promise = (async () => {
          const result = this.__client.request<${this.dataTypeName}${this.hasVariables ? `, ${this.variablesTypeName}` : ''}>(
            { document: this.document${this.hasVariables ? ', variables' : ''}, cachePolicy },
          );
          
          let resultData: ${this.dataTypeName} | null = null;
          
          for await (const data of result) {
            resultData = data as ${this.dataTypeName} | null;
            
            this.setData(resultData);
          }
          
          return resultData;
        })();
        
        this.setPromise(promise);
        
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

  get hook() {
    const type = this.isMutationType ? 'Mutation' : 'Query';
    const hookTypeName = `Use${this.className}${type}Opts`;

    return dedent`

      type ${hookTypeName} = Options & Use${type}Opts<${this.dataTypeName}>;

      export function use${this.className}(${this.hasVariables ? `variables: ${this.variablesTypeName} | null, ` : ''}select: ${this.selectionBuilderType}, opts: ${hookTypeName} = {}) {
        return use${type}(
          () => new ${this.className}(${this.hasVariables ? 'variables, ' : ''}select, opts),
          opts
        )
      }
    `;
  }

  get code() {
    const segments = [
      this.imports,
      this.optionsType,
      this.variablesType,
      this.dataType,
      this.header,
      this.properties,
      this.constructorFunction,
      this.documentGetter,
      this.setLoadingMethod,
      this.hasVariables && this.setVariablesMethod,
      this.setDataMethod,
      this.setPromiseMethod,
      this.setErrorMethod,
      this.dispatchMethod,
      this.footer,
      this.writeReactUtilities && this.hook
    ].filter(Boolean);

    return segments.join('\n');
  }
}