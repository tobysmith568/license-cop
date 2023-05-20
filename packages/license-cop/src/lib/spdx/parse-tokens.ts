import { Identifier, SpdxExpression } from "./types/spdx-expression";
import { Token, Parenthesis, Operator } from "./types/token";

export const parseTokens = (tokens: Token[], originalInput: string): SpdxExpression => {
  let index = 0;

  const throwNotValid = () => {
    throw new Error(`'${originalInput}' is not a valid SPDX expression`);
  };

  const hasMore = (): boolean => index < tokens.length;

  const getCurrentToken = (): Token | null => (hasMore() ? tokens[index] : null);

  const moveToNextToken = () => {
    if (!hasMore()) {
      throwNotValid();
    }

    index++;
  };

  const tryParseParenthesis = (operator: Parenthesis): boolean => {
    const currentToken = getCurrentToken();

    if (currentToken && currentToken.type === "parenthesis" && operator === currentToken.value) {
      moveToNextToken();
      return true;
    }

    return false;
  };

  const tryParseWithToken = (): boolean => {
    const currentToken = getCurrentToken();

    if (currentToken && currentToken.type === "with") {
      moveToNextToken();
      return true;
    }

    return false;
  };

  const tryParseOperator = (operator: Operator): Operator | undefined => {
    const currentToken = getCurrentToken();

    if (currentToken && currentToken.type === "operator" && operator === currentToken.value) {
      moveToNextToken();
      return currentToken.value;
    }

    return undefined;
  };

  const tryParseLicense = (): Identifier | undefined => {
    const currentToken = getCurrentToken();
    if (currentToken && currentToken.type === "identifier") {
      moveToNextToken();

      return {
        type: "identifier",
        value: currentToken.value
      };
    }

    return undefined;
  };

  const tryParseParenthesizedExpression = () => {
    const startsWithParenthesis = tryParseParenthesis("(");
    if (!startsWithParenthesis) {
      return undefined;
    }

    const innerExpression = tryParseExpression();

    const endsWithParenthesis = tryParseParenthesis(")");
    if (!endsWithParenthesis) {
      throwNotValid();
    }

    return innerExpression;
  };

  const binaryOperationFactory = (
    operator: Exclude<Operator, "WITH">,
    tryNextParser: () => SpdxExpression | undefined
  ) => {
    const tryParseBinaryOperation = (): SpdxExpression | undefined => {
      const left = tryNextParser();

      if (!left) {
        return undefined;
      }

      if (!tryParseOperator(operator)) {
        return left;
      }

      const right = tryParseBinaryOperation();
      if (!right) {
        return throwNotValid();
      }

      return {
        type: operator,
        expressions: [left, right]
      };
    };

    return tryParseBinaryOperation;
  };

  const tryParseWith = (): SpdxExpression | undefined => {
    const left = tryParseLicense();

    if (!left) {
      return undefined;
    }

    if (!tryParseWithToken()) {
      return left;
    }

    const right = tryParseLicense();
    if (!right) {
      return throwNotValid();
    }

    return {
      type: "WITH",
      expressions: [left.value, right.value]
    };
  };

  const parseAnd = binaryOperationFactory(
    "AND",
    () => tryParseParenthesizedExpression() || tryParseWith()
  );
  const tryParseExpression = binaryOperationFactory("OR", parseAnd);

  const node = tryParseExpression();
  if (!node || hasMore()) {
    return throwNotValid();
  }

  return node;
};
