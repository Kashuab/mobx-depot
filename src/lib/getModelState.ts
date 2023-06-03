export function getModelState(model: object) {
  const state = {};

  for (const prop in model) {
    const typedProp = prop as keyof typeof model;
    let value;

    try {
      value = model[typedProp];
    } catch (err) {
      // Selection error
      continue;
    }

    if (typeof value !== 'function') {
      state[typedProp] = value;
    }
  }

  return state;
}