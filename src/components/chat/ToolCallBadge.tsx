"use client";

import { Loader2 } from "lucide-react";

interface ToolInvocationData {
  toolName: string;
  toolCallId: string;
  args: unknown;
  state: "partial-call" | "call" | "result";
  result?: unknown;
}

interface ToolCallBadgeProps {
  toolInvocation: ToolInvocationData;
}

export function getToolCallLabel(
  toolName: string,
  args: Record<string, unknown>
): string {
  const path = (args.path as string) || "";

  if (toolName === "str_replace_editor") {
    const command = args.command as string;
    switch (command) {
      case "create":
        return `Creating ${path}`;
      case "str_replace":
      case "insert":
        return `Editing ${path}`;
      case "view":
        return `Reading ${path}`;
      case "undo_edit":
        return `Undoing edit on ${path}`;
      default:
        return path ? `${toolName} ${path}` : toolName;
    }
  }

  if (toolName === "file_manager") {
    const command = args.command as string;
    const newPath = args.new_path as string | undefined;
    switch (command) {
      case "rename":
        return newPath ? `Renaming ${path} → ${newPath}` : `Renaming ${path}`;
      case "delete":
        return `Deleting ${path}`;
      default:
        return path ? `${toolName} ${path}` : toolName;
    }
  }

  return toolName;
}

export function ToolCallBadge({ toolInvocation }: ToolCallBadgeProps) {
  const { toolName, args, state, result } = toolInvocation;
  const label = getToolCallLabel(
    toolName,
    (args ?? {}) as Record<string, unknown>
  );
  const isDone = state === "result" && result != null;

  return (
    <div className="inline-flex items-center gap-2 mt-2 px-3 py-1.5 bg-neutral-50 rounded-lg text-xs font-mono border border-neutral-200">
      {isDone ? (
        <div className="w-2 h-2 rounded-full bg-emerald-500" />
      ) : (
        <Loader2 className="w-3 h-3 animate-spin text-blue-600" />
      )}
      <span className="text-neutral-700">{label}</span>
    </div>
  );
}
