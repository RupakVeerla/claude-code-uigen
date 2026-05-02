import { describe, test, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { ToolCallBadge, getToolCallLabel } from "../ToolCallBadge";

vi.mock("lucide-react", () => ({
  Loader2: ({ className }: { className?: string }) => (
    <div data-testid="loader" className={className} />
  ),
}));

afterEach(() => {
  cleanup();
});

// ---------------------------------------------------------------------------
// getToolCallLabel — pure function, no DOM
// ---------------------------------------------------------------------------

describe("getToolCallLabel", () => {
  describe("str_replace_editor", () => {
    test("create → 'Creating {path}'", () => {
      expect(
        getToolCallLabel("str_replace_editor", { command: "create", path: "/App.jsx" })
      ).toBe("Creating /App.jsx");
    });

    test("str_replace → 'Editing {path}'", () => {
      expect(
        getToolCallLabel("str_replace_editor", {
          command: "str_replace",
          path: "/components/Card.jsx",
        })
      ).toBe("Editing /components/Card.jsx");
    });

    test("insert → 'Editing {path}'", () => {
      expect(
        getToolCallLabel("str_replace_editor", { command: "insert", path: "/App.jsx" })
      ).toBe("Editing /App.jsx");
    });

    test("view → 'Reading {path}'", () => {
      expect(
        getToolCallLabel("str_replace_editor", { command: "view", path: "/App.jsx" })
      ).toBe("Reading /App.jsx");
    });

    test("undo_edit → 'Undoing edit on {path}'", () => {
      expect(
        getToolCallLabel("str_replace_editor", { command: "undo_edit", path: "/App.jsx" })
      ).toBe("Undoing edit on /App.jsx");
    });

    test("unknown command with path → falls back to '{toolName} {path}'", () => {
      expect(
        getToolCallLabel("str_replace_editor", { command: "unknown", path: "/App.jsx" })
      ).toBe("str_replace_editor /App.jsx");
    });

    test("unknown command without path → falls back to toolName only", () => {
      expect(getToolCallLabel("str_replace_editor", { command: "unknown" })).toBe(
        "str_replace_editor"
      );
    });
  });

  describe("file_manager", () => {
    test("rename with new_path → 'Renaming {path} → {new_path}'", () => {
      expect(
        getToolCallLabel("file_manager", {
          command: "rename",
          path: "/old.jsx",
          new_path: "/new.jsx",
        })
      ).toBe("Renaming /old.jsx → /new.jsx");
    });

    test("rename without new_path → 'Renaming {path}'", () => {
      expect(
        getToolCallLabel("file_manager", { command: "rename", path: "/old.jsx" })
      ).toBe("Renaming /old.jsx");
    });

    test("delete → 'Deleting {path}'", () => {
      expect(
        getToolCallLabel("file_manager", { command: "delete", path: "/old.jsx" })
      ).toBe("Deleting /old.jsx");
    });

    test("unknown command → falls back to '{toolName} {path}'", () => {
      expect(
        getToolCallLabel("file_manager", { command: "unknown", path: "/old.jsx" })
      ).toBe("file_manager /old.jsx");
    });
  });

  describe("unknown tool", () => {
    test("returns raw tool name", () => {
      expect(getToolCallLabel("some_other_tool", {})).toBe("some_other_tool");
    });
  });

  describe("edge cases", () => {
    test("missing path in args does not throw", () => {
      expect(() =>
        getToolCallLabel("str_replace_editor", { command: "create" })
      ).not.toThrow();
    });

    test("missing path produces 'Creating ' (empty path)", () => {
      expect(getToolCallLabel("str_replace_editor", { command: "create" })).toBe(
        "Creating "
      );
    });
  });
});

// ---------------------------------------------------------------------------
// ToolCallBadge component — render assertions
// ---------------------------------------------------------------------------

describe("ToolCallBadge", () => {
  test("shows spinner when state is 'call'", () => {
    render(
      <ToolCallBadge
        toolInvocation={{
          toolName: "str_replace_editor",
          toolCallId: "1",
          args: { command: "create", path: "/App.jsx" },
          state: "call",
        }}
      />
    );
    expect(screen.getByTestId("loader")).toBeDefined();
  });

  test("shows spinner when state is 'partial-call'", () => {
    render(
      <ToolCallBadge
        toolInvocation={{
          toolName: "str_replace_editor",
          toolCallId: "1",
          args: { command: "create", path: "/App.jsx" },
          state: "partial-call",
        }}
      />
    );
    expect(screen.getByTestId("loader")).toBeDefined();
  });

  test("shows green dot when state is 'result' with truthy result", () => {
    const { container } = render(
      <ToolCallBadge
        toolInvocation={{
          toolName: "str_replace_editor",
          toolCallId: "1",
          args: { command: "create", path: "/App.jsx" },
          state: "result",
          result: "Success",
        }}
      />
    );
    expect(container.querySelector(".bg-emerald-500")).toBeTruthy();
  });

  test("shows spinner when state is 'result' but result is null", () => {
    render(
      <ToolCallBadge
        toolInvocation={{
          toolName: "str_replace_editor",
          toolCallId: "1",
          args: { command: "create", path: "/App.jsx" },
          state: "result",
          result: null,
        }}
      />
    );
    expect(screen.getByTestId("loader")).toBeDefined();
  });

  test("renders 'Creating /App.jsx' for str_replace_editor create", () => {
    render(
      <ToolCallBadge
        toolInvocation={{
          toolName: "str_replace_editor",
          toolCallId: "1",
          args: { command: "create", path: "/App.jsx" },
          state: "call",
        }}
      />
    );
    expect(screen.getByText("Creating /App.jsx")).toBeDefined();
  });

  test("renders 'Editing /components/Card.jsx' for str_replace", () => {
    render(
      <ToolCallBadge
        toolInvocation={{
          toolName: "str_replace_editor",
          toolCallId: "1",
          args: { command: "str_replace", path: "/components/Card.jsx" },
          state: "call",
        }}
      />
    );
    expect(screen.getByText("Editing /components/Card.jsx")).toBeDefined();
  });

  test("renders 'Deleting /old.jsx' for file_manager delete", () => {
    render(
      <ToolCallBadge
        toolInvocation={{
          toolName: "file_manager",
          toolCallId: "1",
          args: { command: "delete", path: "/old.jsx" },
          state: "call",
        }}
      />
    );
    expect(screen.getByText("Deleting /old.jsx")).toBeDefined();
  });

  test("renders 'Renaming /old.jsx → /new.jsx' for file_manager rename", () => {
    render(
      <ToolCallBadge
        toolInvocation={{
          toolName: "file_manager",
          toolCallId: "1",
          args: { command: "rename", path: "/old.jsx", new_path: "/new.jsx" },
          state: "call",
        }}
      />
    );
    expect(screen.getByText("Renaming /old.jsx → /new.jsx")).toBeDefined();
  });

  test("renders raw tool name for unknown tool", () => {
    render(
      <ToolCallBadge
        toolInvocation={{
          toolName: "unknown_tool",
          toolCallId: "1",
          args: {},
          state: "call",
        }}
      />
    );
    expect(screen.getByText("unknown_tool")).toBeDefined();
  });

  test("container has correct CSS classes", () => {
    const { container } = render(
      <ToolCallBadge
        toolInvocation={{
          toolName: "str_replace_editor",
          toolCallId: "1",
          args: { command: "create", path: "/App.jsx" },
          state: "call",
        }}
      />
    );
    const el = container.firstChild as HTMLElement;
    expect(el.className).toContain("inline-flex");
    expect(el.className).toContain("font-mono");
    expect(el.className).toContain("border-neutral-200");
  });
});
