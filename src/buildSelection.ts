import {indentString} from "./lib/indentString";
import {gqlStringify} from "./lib/gqlStringify";


export type Selection = {
  fieldName: string;
  args?: { [key: string]: any };
  children?: Selection[];
};

export function buildSelection(items: Selection[]) {
  let selection = '{';

  for (const key of items) {
    selection += `\n${indentString(key.fieldName, 2)}`;

    if (key.args && Object.keys(key.args).length > 0) {
      selection += '(';

      for (const argName in key.args) {
        selection += `${argName}: ${gqlStringify(key.args[argName])}, `;
      }

      selection = selection.slice(0, -2) + ')';
    }

    if (key.children) {
      selection += `${indentString(buildSelection(key.children), 2).substring(1)}`; // Trims extra space before "{"
    }
  }

  selection += '\n}';

  return selection;
}