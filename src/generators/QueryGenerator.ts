import {IntrospectionField} from "graphql/utilities/getIntrospectionQuery";
import {pascalCase} from "change-case";
import {
  arrayTypeContainsNonNullableType,
  getTypeKind,
  getTypeName,
  typeIsNonNullable,
  typeIsNullable
} from "./ModelGenerator";
import {indentString} from "../lib/indentString";
import dedent from "dedent";
import {isScalarType, scalarIsPrimitive} from "../generate";
import {referencesObjectType} from "./generateObjectTypes";
import {referencesScalar} from "./generateScalars";
import {referencesInputObjectType} from "./generateInputObjects";

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
      let typeName = getTypeName(arg.type);

      if (referencesObjectType(arg.type)) {
        typeName = `ObjectTypes.${typeName}`;
      }

      if (referencesScalar(arg.type) && !scalarIsPrimitive(arg.type)) {
        typeName = `Scalars.${typeName}`;
      }

      if (referencesInputObjectType(arg.type)) {
        typeName = `InputObjects.${typeName}`;
      }

      return `${arg.name}${optional ? '?' : ''}: ${typeName}`;
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
        `constructor(${this.hasVariables ? `variables: ${this.variablesTypeName} | null, ` : ''}select: ${this.selectionBuilderType}, options: ${this.optionsTypeName} = {}) {`,
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
        `options: ${this.optionsTypeName} = {};`,
        `promise: Promise<${this.dataTypeName} | null> | null = null;`,
        'abortController: AbortController | null = null;'
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
      let typeName = getTypeName(arg.type, { normalizeName: false, stripArrayType: false });

      const isArray = typeName.endsWith('[]');
      if (isArray) {
        const typeIsNonNullable = arrayTypeContainsNonNullableType(arg.type);
        typeName = `[${typeName.replace('[]', '')}${typeIsNonNullable ? '!' : ''}]`
      }

      let definition = `$${arg.name}: ${typeName}`;

      if (typeIsNonNullable(arg.type)) {
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
    return `${this.fieldTypeName}`;
  }

  get dataTypeName() {
    return `${this.className}Data`;
  }

  get abortMethod() {
    return indentString(dedent`
      abort() {
        this.abortController?.abort();
      }
    `, 2);
  }

  get fieldReturnsArray() {
    // yuck
    return getTypeName(this.field.type, { normalizeName: true }).endsWith('[]');
  }

  get dataType() {
    return `type ${this.dataTypeName} = { ${this.field.name}: ObjectTypes.${this.payloadModelName}${this.fieldReturnsArray ? '[]' : ''} };`;
  }

  get optionsTypeName() {
    return `${this.className}Options`;
  }

  get optionsType() {
    return `type ${this.optionsTypeName} = { cachePolicy?: CachePolicy };`;
  }

  get dispatchMethod() {
    return indentString(dedent`
      async dispatch(${this.hasVariables ? 'variables = this.variables' : ''}) {
        ${this.hasVariables ? `if (!variables) {
          throw new Error("${this.className} was dispatched without variables");
        }` : ''}
      
        this.setError(null);
        this.setLoading(true);
        this.abort();
        
        const controller = new AbortController();
        const cachePolicy = ${this.isMutationType ? '"no-cache"' : "this.options.cachePolicy"};
        
        this.abortController = controller;
        
        const promise = (async () => {
          const result = this.__client.request<${this.dataTypeName}${this.hasVariables ? `, ${this.variablesTypeName}` : ''}>(
            { document: this.document${this.hasVariables ? ', variables' : ''}, cachePolicy, signal: controller.signal },
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
          if (err instanceof DOMException && err.name === 'AbortError') {
            // Aborted from another request dispatched from the same query instance
            // Don't treat it as an error
          } else {
            console.error(err);
            this.setError(err instanceof Error ? err : new Error(err as string));
          }
        }
        
        this.abortController = null;
        this.setLoading(false);
        this.setPromise(null);
        
        return result;
      }
    `, 2);
  }

  get footer() {
    return '}';
  }

  get hook() {
    const type = this.isMutationType ? 'Mutation' : 'Query';
    const hookTypeName = `Use${this.className}Opts`;

    return dedent`

      type ${hookTypeName} = ${this.optionsTypeName} & Use${type}Opts<${this.dataTypeName}>;

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
      // this.imports,
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
      this.abortMethod,
      this.dispatchMethod,
      this.footer,
      this.writeReactUtilities && this.hook
    ].filter(Boolean);

    return segments.join('\n');
  }
}