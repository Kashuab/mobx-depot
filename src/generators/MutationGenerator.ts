import {
  IntrospectionField,
  IntrospectionInputTypeRef,
} from "graphql/utilities/getIntrospectionQuery";
import {pascalCase} from "change-case";
import {getTypeName} from "./ModelGenerator";
import dedent from "dedent";
import {indentString} from "../lib/indentString";

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
  type: IntrospectionField;

  constructor(type: IntrospectionField) {
    this.type = type;
  }

  get fileName() {
    return `${this.className}.ts`;
  }

  get requiredInputs() {
    const dig = (typeRef: IntrospectionInputTypeRef): string => {
      if (typeRef.kind === 'NON_NULL' || typeRef.kind === 'LIST') return dig(typeRef.ofType);

      if (typeRef.kind === 'INPUT_OBJECT') {
        return typeRef.name;
      }

      throw new Error('Could not find INPUT_OBJECT in typeRef');
    }

    return this.type.args.reduce((inputObjectNames, arg) => {
      const inputObjectName = dig(arg.type);
      if (!inputObjectNames.includes(inputObjectName)) inputObjectNames.push(inputObjectName);

      return inputObjectNames;
    }, [] as string[]);
  }

  get imports() {
    return [
      "import { makeAutoObservable } from 'mobx';",
      "import { gql, GraphQLClient } from 'graphql-request';",
      ...this.requiredInputs.map(input => `import { ${input} } from '../inputs/${input}';`),
    ].join('\n');
  }

  get className() {
    return `${pascalCase(this.type.name)}Mutation`;
  }

  get header() {
    return `export class ${this.className} {`;
  }

  get argDefinitions() {
    return this.type.args.map(arg => `${arg.name}: ${getTypeName(arg.type)}`);
  }

  get constructorAssignments() {
    return this.type.args.map(arg => `this.${arg.name} = ${arg.name};`);
  }

  get constructorFunction() {
    return indentString(
      [
        `constructor(${this.argDefinitions.join(', ')}, selection: string) {`,
        indentString(this.constructorAssignments.join('\n'), 2),
        indentString("this.selection = selection;", 2),
        indentString("makeAutoObservable(this);", 2),
        '}',
      ].join('\n'),
      2,
    )
  }

  get properties() {
    return indentString(
      [
        this.argDefinitions.join(';\n'),
        'selection: string;',
        'loading = false;',
      ].join('\n'),
      2,
    )
  }

  get documentVariables() {
    // TODO: I'm building this with a Rails GQL API, so I'm not sure if this is a general solution.
    // Every mutation I've seen so far has a single argument, which is an input object. This will certainly
    // NOT be the case for all GQL APIs.
    return this.type.args.reduce((variables, arg) => {
      variables.push(`${arg.name}: $${arg.name}`);

      return variables;
    }, [] as string[]).join(', ');
  }

  get documentVariableDefinitions() {
    // TODO: Multiple argument mutations
    return this.type.args.reduce((variables, arg) => {
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
          mutation ${pascalCase(this.type.name)}(${this.documentVariableDefinitions}) {
            ${this.type.name}(${this.documentVariables}) {
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
        
        const data = await client.request(this.document, { input: this.input });
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