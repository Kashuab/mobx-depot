import {indentString} from "./lib/indentString";

type StringTree = (string | StringTree)[];

export function buildSelection(keys: StringTree) {
  let selection = '{';

  for (const key of keys) {
    if (typeof key === 'string') {
      selection += indentString(`\n${key}`, 2);
    } else {
      selection += `${indentString(buildSelection(key), 2)}`;
    }
  }

  selection += '\n}';

  return selection;
}