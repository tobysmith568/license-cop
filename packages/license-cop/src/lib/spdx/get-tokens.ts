import { isOperator, isParenthesis, Token } from "./types/token";

export const getTokens = (input: string): Token[] => {
  const tokens: Token[] = [];
  let currentToken = "";

  // Pushes the current token to the tokens array and resets the current token
  const pushToken = () => {
    if (currentToken.length === 0) {
      return;
    }

    if (currentToken === "WITH") {
      tokens.push({
        type: "with"
      });
    } else if (isOperator(currentToken)) {
      tokens.push({
        type: "operator",
        value: currentToken
      });
    } else {
      tokens.push({
        type: "identifier",
        value: currentToken
      });
    }

    currentToken = "";
  };

  for (let i = 0; i < input.length; i++) {
    const currentChar = input[i];

    if (isParenthesis(currentChar)) {
      pushToken();

      tokens.push({
        type: "parenthesis",
        value: currentChar
      });

      continue;
    }

    if (currentChar === " ") {
      pushToken();
      continue;
    }

    currentToken += currentChar;
  }

  pushToken();
  return tokens;
};
