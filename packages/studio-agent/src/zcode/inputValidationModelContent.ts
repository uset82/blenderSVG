// Ported from ZCode (https://github.com/zai-org/ZCode)
// Commit: 29628c9acdb81b703bbd4080c207a0e7ce5e276e
// Upstream file: apps/zcode-cli/packages/core/src/tool/input-validation-model-content.ts
// Copyright 2026 Z.AI Co., Ltd. Licensed under the Apache License, Version 2.0; see ./LICENSE.
// Modifications by the Kurva authors:
// - Kept only the formatter. The projection that merges Zod runtime issues is not ported, because
// -   Kurva validates with the JSON Schema validator alone.
// - `createInputValidationModelContent` takes the tool name and JSON Schema issues directly.
// - Reformatted to this repository's style.

import type { ToolInputValidationIssue, ToolInputValidationPath } from "./toolInputValidationIssues.js";

/**
 * The tool result the model sees when its arguments do not match the tool's schema, so it can call
 * the tool again with corrected arguments.
 */
export function createInputValidationModelContent(
  toolName: string,
  issues: readonly ToolInputValidationIssue[]
): string {
  return `<tool_use_error>InputValidationError: ${formatToolInputValidationError(toolName, issues)}</tool_use_error>`;
}

function formatToolInputValidationError(toolName: string, issues: readonly ToolInputValidationIssue[]): string {
  const missingParameters = issues
    .filter((issue) => issue.code === "invalid_type" && issue.message.includes("received undefined"))
    .map((issue) => formatValidationPath(issue.path));
  const unexpectedParameters = issues.flatMap((issue) => (issue.code === "unrecognized_keys" ? issue.keys : []));
  const wrongTypes = issues.flatMap((issue) => {
    if (issue.code !== "invalid_type" || issue.message.includes("received undefined")) {
      return [];
    }
    return [
      {
        expected: issue.expected,
        param: formatValidationPath(issue.path),
        received: issue.message.match(/received (\w+)/)?.[1] ?? "unknown"
      }
    ];
  });

  const lines: string[] = [
    ...missingParameters.map((parameter) => `The required parameter \`${parameter}\` is missing`),
    ...unexpectedParameters.map((parameter) => `An unexpected parameter \`${parameter}\` was provided`),
    ...wrongTypes.map(
      ({ expected, param, received }) =>
        `The parameter \`${param}\` type is expected as \`${expected}\` but provided as \`${received}\``
    )
  ];
  if (lines.length > 0) {
    return `${toolName} failed due to the following ${lines.length > 1 ? "issues" : "issue"}:\n${lines.join("\n")}`;
  }

  return JSON.stringify(issues, (_key, value) => (typeof value === "bigint" ? value.toString() : value), 2) ?? "[]";
}

function formatValidationPath(path: ToolInputValidationPath): string {
  if (path.length === 0) return "";
  return path.reduce<string>((formatted, segment, index) => {
    if (typeof segment === "number") return `${formatted}[${segment.toString()}]`;
    return index === 0 ? segment : `${formatted}.${segment}`;
  }, "");
}
