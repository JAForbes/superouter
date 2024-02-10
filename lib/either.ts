export type Either<L, R> =
  | { type: "Either"; tag: "Left"; value: L }
  | { type: "Either"; tag: "Right"; value: R };

export const Either = {
  Left<L, R>(value: L): Either<L, R> {
    return { type: "Either", tag: "Left", value };
  },
  Right<L, R>(value: R): Either<L, R> {
    return { type: "Either", tag: "Right", value };
  },
};
