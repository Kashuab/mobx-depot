import {
  IntrospectionField,
  IntrospectionInputTypeRef,
} from "graphql/utilities/getIntrospectionQuery";
import {pascalCase} from "change-case";
import {getTypeKind, getTypeName} from "./ModelGenerator";
import dedent from "dedent";
import {indentString} from "../lib/indentString";
import {isScalarType, scalarIsPrimitive} from "../generate";

/*
  "name": "createBattle",
  "description": null,
  "type": {
    "kind": "OBJECT",
    "name": "CreateBattlePayload",
    "ofType": null
  },
  "isDeprecated": false,
  "deprecationReason": null,
  "args": [
    {
      "name": "input",
      "description": "Parameters for CreateBattle",
      "type": {
        "kind": "NON_NULL",
        "name": null,
        "ofType": {
          "kind": "INPUT_OBJECT",
          "name": "CreateBattleInput",
          "ofType": null
        }
      },
      "defaultValue": null
    }
  ]
 */

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
    return getTypeName(this.field.type);
  }

  get payloadModelName() {
    return `${this.fieldTypeName}Model`;
  }

  get payloadSelectorName() {
    return `selectFrom${this.fieldTypeName}Properties`;
  }

  get payloadSelectorImport() {
    return `import { ${this.payloadSelectorName} } from '../base/${this.fieldTypeName}Properties';`;
  }

  get imports() {
    return [
      "import { makeAutoObservable } from 'mobx';",
      "import { gql, GraphQLClient } from 'graphql-request';",
      "import { buildSelection } from 'mobx-depot';",
      `import { ${this.payloadModelName} } from '../../${this.payloadModelName}';`,
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

  get argDefinitions() {
    return this.field.args.map(arg => `${arg.name}: ${getTypeName(arg.type)}`);
  }

  get hasArgs() {
    return this.argDefinitions.length > 0;
  }

  get constructorFunction() {
    return indentString(
      [
        `constructor(${this.hasArgs ? `args: ${this.argumentsTypeName}, ` : ''}select: Parameters<typeof ${this.payloadSelectorName}>[0]) {`,
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
      let definition = `$${arg.name}: ${getTypeName(arg.type)}`;

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
            ${this.field.name}(${this.documentVariables}) {
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

  get mutateMethod() {
    return indentString(dedent`
      async mutate(client: GraphQLClient) {
        this.setLoading(true);
        
        const data = await client.request<${this.payloadModelName}>(this.document${this.hasArgs ? ', this.args' : ''});
        this.setLoading(false);
        
        return data;
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
      this.mutateMethod,
      this.footer
    ];

    return segments.join('\n');
  }
}