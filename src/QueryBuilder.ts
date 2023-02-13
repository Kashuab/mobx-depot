import {LoginUserPayloadModel} from "../models/LoginUserPayloadModel";
import {selectFromLoginUserPayloadProperties} from "../models/depot/base/LoginUserPayloadProperties";
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

const keys = selectFromLoginUserPayloadProperties(data => data.user(user => user.email).clientMutationId.token);
const selection = buildSelection(keys);

console.log(selection);