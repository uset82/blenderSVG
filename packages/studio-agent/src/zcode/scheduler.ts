// Ported from ZCode (https://github.com/zai-org/ZCode)
// Commit: 29628c9acdb81b703bbd4080c207a0e7ce5e276e
// Upstream file: apps/zcode-cli/packages/core/src/tool/scheduler.ts
// Copyright 2026 Z.AI Co., Ltd. Licensed under the Apache License, Version 2.0; see ./LICENSE.
// Modifications by the Kurva authors:
// - Imports helpers from ./contracts.js instead of `@zcode/contracts`.
// - `READ_ONLY_TOOLS` is empty; Kurva passes its own read-only canvas tools in.
// - Replaced non-null assertions with casts for this repository's lint rules.
// - Optional fields also accept `undefined`, for this repository's exactOptionalPropertyTypes setting.
// - Reformatted to this repository's style.

// ============================================================
// Tool Scheduler - Tool execution scheduling
// ============================================================

import type { ModelToolSideEffectScope, ToolCallId } from "./contracts.js";
import { CoreErrorType, createCoreError } from "./contracts.js";

// -----------------------------------------------
// Types
// -----------------------------------------------

export interface ToolSchedule {
  items: ToolScheduleItem[];
  parallelGroups: ToolCallId[][];
  executionOrder: ToolCallId[];
}

export interface ToolScheduleItem {
  toolCallId: ToolCallId;
  toolName?: string | undefined;
  dependencies: ToolCallId[];
  canRunParallel: boolean;
  readOnly?: boolean | undefined;
  destructive?: boolean | undefined;
  concurrentSafe?: boolean | undefined;
  sideEffectScope?: ModelToolSideEffectScope | undefined;
}

export interface ToolDependency {
  toolCallId: ToolCallId;
  toolName?: string | undefined;
  dependsOn: ToolCallId[];
  readOnly?: boolean | undefined;
  destructive?: boolean | undefined;
  concurrentSafe?: boolean | undefined;
  sideEffectScope?: ModelToolSideEffectScope | undefined;
}

// -----------------------------------------------
// Scheduler
// -----------------------------------------------

interface ToolSchedulerOptions {
  maxConcurrency?: number | undefined;
  readOnlyTools?: Set<string> | undefined;
}

const DEFAULT_MAX_CONCURRENCY = 10;

export class ToolScheduler {
  private itemsMap = new Map<ToolCallId, ToolScheduleItem>();
  private maxConcurrency: number;
  private readOnlyTools: Set<string>;

  constructor(options: ToolSchedulerOptions = {}) {
    this.maxConcurrency = options.maxConcurrency ?? DEFAULT_MAX_CONCURRENCY;
    this.readOnlyTools = options.readOnlyTools ?? READ_ONLY_TOOLS;
  }

  schedule(tools: ToolDependency[]): ToolSchedule {
    const items = tools.map((tool) => ({
      toolCallId: tool.toolCallId,
      toolName: tool.toolName,
      dependencies: tool.dependsOn,
      canRunParallel: this.canRunInParallel(tool),
      readOnly: tool.readOnly ?? (tool.toolName ? this.readOnlyTools.has(tool.toolName) : undefined),
      destructive: tool.destructive,
      concurrentSafe: tool.concurrentSafe,
      sideEffectScope: tool.sideEffectScope
    }));

    this.itemsMap = new Map(items.map((item) => [item.toolCallId, item]));

    const sorted = this.topologicalSort(items);
    const groups = this.groupByParallel(sorted);
    this.validateNoCycles(groups);

    return {
      items,
      parallelGroups: groups,
      executionOrder: groups.flat()
    };
  }

  private canRunInParallel(tool: ToolDependency): boolean {
    const hasToolName = typeof tool.toolName === "string" && tool.toolName.length > 0;
    const hasSafetyMetadata =
      tool.readOnly !== undefined ||
      tool.destructive !== undefined ||
      tool.concurrentSafe !== undefined ||
      tool.sideEffectScope !== undefined;

    if (!hasToolName && !hasSafetyMetadata) {
      return true;
    }

    const readOnly = tool.readOnly ?? (hasToolName ? this.readOnlyTools.has(tool.toolName as string) : false);
    if (tool.destructive) return false;
    if (tool.concurrentSafe === true) return true;
    if (tool.concurrentSafe === false) return false;
    if (readOnly) return true;
    return tool.sideEffectScope === "none";
  }

  private topologicalSort(items: ToolScheduleItem[]): ToolScheduleItem[] {
    const result: ToolScheduleItem[] = [];
    const remaining = new Map(items.map((item) => [item.toolCallId, item]));
    const inDegree = new Map<string, number>();

    for (const item of items) {
      inDegree.set(item.toolCallId, item.dependencies.length);
    }

    const queue = items.filter((item) => item.dependencies.length === 0).map((item) => item.toolCallId);

    while (queue.length > 0) {
      const current = queue.shift() as ToolCallId;
      const item = remaining.get(current);

      if (!item) continue;

      result.push(item);
      remaining.delete(current);

      for (const [toolId, depItem] of remaining) {
        if (depItem.dependencies.includes(current)) {
          const newDegree = (inDegree.get(toolId) ?? 0) - 1;
          inDegree.set(toolId, newDegree);
          if (newDegree === 0) {
            queue.push(toolId);
          }
        }
      }
    }

    if (remaining.size > 0) {
      throw createCoreError(CoreErrorType.InvalidStateTransition, "Circular dependency detected in tool scheduling", {
        context: {
          remaining: Array.from(remaining.keys())
        },
        recoverable: false
      });
    }

    return result;
  }

  private groupByParallel(items: ToolScheduleItem[]): ToolCallId[][] {
    if (items.length === 0) return [];

    const levels = new Map<ToolCallId, number>();
    const byLevel = new Map<number, ToolScheduleItem[]>();

    for (const item of items) {
      const dependencyLevel =
        item.dependencies.length === 0 ? -1 : Math.max(...item.dependencies.map((dep) => levels.get(dep) ?? 0));
      const level = dependencyLevel + 1;
      levels.set(item.toolCallId, level);
      const levelItems = byLevel.get(level) ?? [];
      levelItems.push(item);
      byLevel.set(level, levelItems);
    }

    const groups: ToolCallId[][] = [];
    const sortedLevels = Array.from(byLevel.keys()).sort((a, b) => a - b);

    for (const level of sortedLevels) {
      let parallelGroup: ToolCallId[] = [];

      const flushParallelGroup = () => {
        if (parallelGroup.length === 0) return;
        groups.push(parallelGroup);
        parallelGroup = [];
      };

      for (const item of byLevel.get(level) ?? []) {
        if (item.canRunParallel) {
          // Flush if current group is full
          if (parallelGroup.length >= this.maxConcurrency) {
            flushParallelGroup();
          }
          parallelGroup.push(item.toolCallId);
          continue;
        }

        flushParallelGroup();
        groups.push([item.toolCallId]);
      }

      flushParallelGroup();
    }

    return groups;
  }

  private validateNoCycles(groups: ToolCallId[][]): void {
    for (const group of groups) {
      const groupSet = new Set(group);

      for (const toolId of group) {
        const item = this.itemsMap.get(toolId);
        if (!item) continue;

        for (const dep of item.dependencies) {
          if (groupSet.has(dep)) {
            throw createCoreError(
              CoreErrorType.InvalidStateTransition,
              `Circular dependency detected: ${toolId} depends on ${dep} in same group`,
              {
                context: { toolId, dependency: dep, group },
                recoverable: false
              }
            );
          }
        }
      }
    }
  }
}

// -----------------------------------------------
// Default instance
// -----------------------------------------------

/** Kurva passes its read-only canvas tools in; there is no built-in list of ZCode tool names. */
export const READ_ONLY_TOOLS = new Set<string>();

export const defaultToolScheduler = new ToolScheduler();
