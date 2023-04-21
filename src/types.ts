type IfEquals<X, Y, A, B> = (<T>() => T extends X ? 1 : 2) extends (<T>() => T extends Y ? 1 : 2) ? A : B;
type WritableKeys<T> = {
  [K in keyof T as IfEquals<{ [Q in K]: T[K] }, { -readonly [Q in K]: T[K] }, K, never>]: T[K];
};
type SettableKeys<T> = {
  [K in keyof WritableKeys<T> as T[K] extends Function ? never : K]: T[K];
};

export type WritableInstanceVariables<T> = SettableKeys<{
  [K in keyof T as T[K] extends Function ? never : K]: T[K];
}>;