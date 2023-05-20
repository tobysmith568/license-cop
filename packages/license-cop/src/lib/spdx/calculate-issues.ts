import { SpdxExpression } from "./types/spdx-expression";

export const calculateIssues = (license: SpdxExpression, allowedLicenses: string[]): string[] => {
  const issues: string[] = [];

  const parseNode = (node: SpdxExpression): void => {
    switch (node.type) {
      case "identifier": {
        if (!allowedLicenses.includes(node.value)) {
          issues.push(node.value);
        }
        return;
      }

      case "AND":
      case "OR": {
        parseNode(node.expressions[0]);
        parseNode(node.expressions[1]);
        return;
      }

      case "WITH": {
        if (
          // TODO: Verify that all exceptions make licenses 'weaker'
          !allowedLicenses.includes(node.expressions[0]) ||
          !allowedLicenses.includes(`${node.expressions[0]} WITH ${node.expressions[1]}`)
        ) {
          issues.push(`${node.expressions[0]} WITH ${node.expressions[1]}`);
        }
        return;
      }

      default: {
        const _exhaustiveCheck: never = node;
        throw new Error(`Unhandled license expression type: ${_exhaustiveCheck}`);
      }
    }
  };

  parseNode(license);

  return issues;
};
