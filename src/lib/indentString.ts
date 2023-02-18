/*
  This is not mobx-depot code, aside from the IndentStringOpts type.

  Original repository: https://github.com/sindresorhus/indent-string
  See license: https://github.com/sindresorhus/indent-string/blob/main/license

  I had to put the code here because for some reason I could not import it.
*/

type IndentStringOpts = {
  indent?: string;
  includeEmptyLines?: boolean;
}

export function indentString(string: string, count = 1, options: IndentStringOpts = {}) {
  const {
    indent = ' ',
    includeEmptyLines = false
  } = options;

  if (typeof string !== 'string') {
    throw new TypeError(
      `Expected \`input\` to be a \`string\`, got \`${typeof string}\``
    );
  }

  if (typeof count !== 'number') {
    throw new TypeError(
      `Expected \`count\` to be a \`number\`, got \`${typeof count}\``
    );
  }

  if (count < 0) {
    throw new RangeError(
      `Expected \`count\` to be at least 0, got \`${count}\``
    );
  }

  if (typeof indent !== 'string') {
    throw new TypeError(
      `Expected \`options.indent\` to be a \`string\`, got \`${typeof indent}\``
    );
  }

  if (count === 0) {
    return string;
  }

  const regex = includeEmptyLines ? /^/gm : /^(?!\s*$)/gm;

  return string.replace(regex, indent.repeat(count));
}
