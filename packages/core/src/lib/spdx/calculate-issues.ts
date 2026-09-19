import type { SpdxExpression } from "./types/spdx-expression";

export const calculateIssues = (license: SpdxExpression, allowedLicenses: string[]): string[] => {
  const issuesOf = (node: SpdxExpression): string[] => {
    switch (node.type) {
      case "identifier": {
        return allowedLicenses.includes(node.value) ? [] : [node.value];
      }

      case "AND": {
        const leftIssues = issuesOf(node.expressions[0]);
        const rightIssues = issuesOf(node.expressions[1]);
        return [...leftIssues, ...rightIssues];
      }

      case "OR": {
        // The licensee may choose either side, so one fully-allowed side is enough
        const leftIssues = issuesOf(node.expressions[0]);
        const rightIssues = issuesOf(node.expressions[1]);

        if (leftIssues.length === 0 || rightIssues.length === 0) {
          return [];
        }

        return [...leftIssues, ...rightIssues];
      }

      case "WITH": {
        if (
          // TODO: Verify that all exceptions make licenses 'weaker'
          !allowedLicenses.includes(node.expressions[0]) ||
          !allowedLicenses.includes(`${node.expressions[0]} WITH ${node.expressions[1]}`)
        ) {
          return [`${node.expressions[0]} WITH ${node.expressions[1]}`];
        }

        return [];
      }

      default: {
        const _exhaustiveCheck: never = node;
        throw new Error(`Unhandled license expression type: ${_exhaustiveCheck}`);
      }
    }
  };

  return issuesOf(license);
};
