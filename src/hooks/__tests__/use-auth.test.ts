import { describe, test, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useAuth } from "../use-auth";

// vi.hoisted ensures these are available inside vi.mock factory closures
const mocks = vi.hoisted(() => ({
  push: vi.fn(),
  signIn: vi.fn(),
  signUp: vi.fn(),
  getAnonWorkData: vi.fn(),
  clearAnonWork: vi.fn(),
  getProjects: vi.fn(),
  createProject: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mocks.push }),
}));

vi.mock("@/actions", () => ({
  signIn: mocks.signIn,
  signUp: mocks.signUp,
}));

vi.mock("@/lib/anon-work-tracker", () => ({
  getAnonWorkData: mocks.getAnonWorkData,
  clearAnonWork: mocks.clearAnonWork,
}));

vi.mock("@/actions/get-projects", () => ({
  getProjects: mocks.getProjects,
}));

vi.mock("@/actions/create-project", () => ({
  createProject: mocks.createProject,
}));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getAnonWorkData.mockReturnValue(null);
  mocks.getProjects.mockResolvedValue([]);
  mocks.createProject.mockResolvedValue({ id: "new-project-id" });
});

// ---------------------------------------------------------------------------
// Initial state
// ---------------------------------------------------------------------------

test("initial isLoading is false", () => {
  const { result } = renderHook(() => useAuth());
  expect(result.current.isLoading).toBe(false);
});

// ---------------------------------------------------------------------------
// signIn
// ---------------------------------------------------------------------------

describe("signIn", () => {
  test("passes email and password to signInAction", async () => {
    mocks.signIn.mockResolvedValue({ success: false, error: "Invalid credentials" });

    const { result } = renderHook(() => useAuth());
    await act(async () => {
      await result.current.signIn("user@test.com", "secret");
    });

    expect(mocks.signIn).toHaveBeenCalledWith("user@test.com", "secret");
  });

  test("returns the result from signInAction", async () => {
    mocks.signIn.mockResolvedValue({ success: false, error: "Invalid credentials" });

    const { result } = renderHook(() => useAuth());
    let returnValue: unknown;
    await act(async () => {
      returnValue = await result.current.signIn("user@test.com", "wrong");
    });

    expect(returnValue).toEqual({ success: false, error: "Invalid credentials" });
  });

  test("does not redirect or create projects on failure", async () => {
    mocks.signIn.mockResolvedValue({ success: false, error: "Invalid credentials" });

    const { result } = renderHook(() => useAuth());
    await act(async () => {
      await result.current.signIn("user@test.com", "wrong");
    });

    expect(mocks.push).not.toHaveBeenCalled();
    expect(mocks.createProject).not.toHaveBeenCalled();
    expect(mocks.getProjects).not.toHaveBeenCalled();
  });

  test("sets isLoading to true while in-flight, false when done", async () => {
    let resolveSignIn!: (val: unknown) => void;
    mocks.signIn.mockReturnValue(new Promise((r) => { resolveSignIn = r; }));

    const { result } = renderHook(() => useAuth());

    let promise!: Promise<unknown>;
    act(() => { promise = result.current.signIn("user@test.com", "password"); });

    expect(result.current.isLoading).toBe(true);

    await act(async () => {
      resolveSignIn({ success: false });
      await promise;
    });

    expect(result.current.isLoading).toBe(false);
  });

  test("resets isLoading to false even when signInAction throws", async () => {
    mocks.signIn.mockRejectedValue(new Error("Network error"));

    const { result } = renderHook(() => useAuth());
    await act(async () => {
      try { await result.current.signIn("user@test.com", "password"); } catch {}
    });

    expect(result.current.isLoading).toBe(false);
  });

  describe("post sign-in: anon work migration", () => {
    test("creates project from anon work and redirects when messages exist", async () => {
      mocks.signIn.mockResolvedValue({ success: true });
      mocks.getAnonWorkData.mockReturnValue({
        messages: [{ role: "user", content: "build a card" }],
        fileSystemData: { "/App.jsx": "export default () => <div/>" },
      });
      mocks.createProject.mockResolvedValue({ id: "anon-project-id" });

      const { result } = renderHook(() => useAuth());
      await act(async () => { await result.current.signIn("user@test.com", "password"); });

      expect(mocks.createProject).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: [{ role: "user", content: "build a card" }],
          data: { "/App.jsx": "export default () => <div/>" },
        })
      );
      expect(mocks.clearAnonWork).toHaveBeenCalled();
      expect(mocks.push).toHaveBeenCalledWith("/anon-project-id");
    });

    test("anon project name starts with 'Design from'", async () => {
      mocks.signIn.mockResolvedValue({ success: true });
      mocks.getAnonWorkData.mockReturnValue({
        messages: [{ role: "user", content: "hello" }],
        fileSystemData: {},
      });
      mocks.createProject.mockResolvedValue({ id: "anon-project-id" });

      const { result } = renderHook(() => useAuth());
      await act(async () => { await result.current.signIn("user@test.com", "password"); });

      const name = mocks.createProject.mock.calls[0][0].name as string;
      expect(name).toMatch(/^Design from /);
    });

    test("does not call getProjects when anon work is migrated", async () => {
      mocks.signIn.mockResolvedValue({ success: true });
      mocks.getAnonWorkData.mockReturnValue({
        messages: [{ role: "user", content: "hello" }],
        fileSystemData: {},
      });
      mocks.createProject.mockResolvedValue({ id: "anon-project-id" });

      const { result } = renderHook(() => useAuth());
      await act(async () => { await result.current.signIn("user@test.com", "password"); });

      expect(mocks.getProjects).not.toHaveBeenCalled();
    });

    test("skips anon migration when messages array is empty", async () => {
      mocks.signIn.mockResolvedValue({ success: true });
      mocks.getAnonWorkData.mockReturnValue({ messages: [], fileSystemData: {} });
      mocks.getProjects.mockResolvedValue([{ id: "existing-project-id" }]);

      const { result } = renderHook(() => useAuth());
      await act(async () => { await result.current.signIn("user@test.com", "password"); });

      expect(mocks.clearAnonWork).not.toHaveBeenCalled();
      expect(mocks.push).toHaveBeenCalledWith("/existing-project-id");
    });

    test("handles null anon work data by falling through to projects", async () => {
      mocks.signIn.mockResolvedValue({ success: true });
      mocks.getAnonWorkData.mockReturnValue(null);
      mocks.getProjects.mockResolvedValue([{ id: "existing-project-id" }]);

      const { result } = renderHook(() => useAuth());
      await act(async () => { await result.current.signIn("user@test.com", "password"); });

      expect(mocks.push).toHaveBeenCalledWith("/existing-project-id");
    });
  });

  describe("post sign-in: existing projects", () => {
    test("redirects to first (most recent) project when multiple projects exist", async () => {
      mocks.signIn.mockResolvedValue({ success: true });
      mocks.getProjects.mockResolvedValue([
        { id: "recent-project-id" },
        { id: "older-project-id" },
      ]);

      const { result } = renderHook(() => useAuth());
      await act(async () => { await result.current.signIn("user@test.com", "password"); });

      expect(mocks.push).toHaveBeenCalledWith("/recent-project-id");
      expect(mocks.createProject).not.toHaveBeenCalled();
    });

    test("redirects to only project when exactly one project exists", async () => {
      mocks.signIn.mockResolvedValue({ success: true });
      mocks.getProjects.mockResolvedValue([{ id: "only-project-id" }]);

      const { result } = renderHook(() => useAuth());
      await act(async () => { await result.current.signIn("user@test.com", "password"); });

      expect(mocks.push).toHaveBeenCalledWith("/only-project-id");
    });
  });

  describe("post sign-in: new project creation", () => {
    test("creates a new project and redirects when no anon work and no projects", async () => {
      mocks.signIn.mockResolvedValue({ success: true });
      mocks.getProjects.mockResolvedValue([]);
      mocks.createProject.mockResolvedValue({ id: "fresh-project-id" });

      const { result } = renderHook(() => useAuth());
      await act(async () => { await result.current.signIn("user@test.com", "password"); });

      expect(mocks.createProject).toHaveBeenCalledWith(
        expect.objectContaining({ messages: [], data: {} })
      );
      expect(mocks.push).toHaveBeenCalledWith("/fresh-project-id");
    });

    test("new project name matches 'New Design #N' pattern", async () => {
      mocks.signIn.mockResolvedValue({ success: true });
      mocks.getProjects.mockResolvedValue([]);
      mocks.createProject.mockResolvedValue({ id: "fresh-project-id" });

      const { result } = renderHook(() => useAuth());
      await act(async () => { await result.current.signIn("user@test.com", "password"); });

      const name = mocks.createProject.mock.calls[0][0].name as string;
      expect(name).toMatch(/^New Design #\d+$/);
    });
  });
});

// ---------------------------------------------------------------------------
// signUp
// ---------------------------------------------------------------------------

describe("signUp", () => {
  test("passes email and password to signUpAction", async () => {
    mocks.signUp.mockResolvedValue({ success: false, error: "Email already registered" });

    const { result } = renderHook(() => useAuth());
    await act(async () => {
      await result.current.signUp("new@test.com", "password123");
    });

    expect(mocks.signUp).toHaveBeenCalledWith("new@test.com", "password123");
  });

  test("returns the result from signUpAction", async () => {
    mocks.signUp.mockResolvedValue({ success: false, error: "Email already registered" });

    const { result } = renderHook(() => useAuth());
    let returnValue: unknown;
    await act(async () => {
      returnValue = await result.current.signUp("existing@test.com", "password123");
    });

    expect(returnValue).toEqual({ success: false, error: "Email already registered" });
  });

  test("does not redirect or create projects on failure", async () => {
    mocks.signUp.mockResolvedValue({ success: false, error: "Email already registered" });

    const { result } = renderHook(() => useAuth());
    await act(async () => {
      await result.current.signUp("existing@test.com", "password123");
    });

    expect(mocks.push).not.toHaveBeenCalled();
    expect(mocks.createProject).not.toHaveBeenCalled();
  });

  test("sets isLoading to true while in-flight, false when done", async () => {
    let resolveSignUp!: (val: unknown) => void;
    mocks.signUp.mockReturnValue(new Promise((r) => { resolveSignUp = r; }));

    const { result } = renderHook(() => useAuth());

    let promise!: Promise<unknown>;
    act(() => { promise = result.current.signUp("new@test.com", "password123"); });

    expect(result.current.isLoading).toBe(true);

    await act(async () => {
      resolveSignUp({ success: false });
      await promise;
    });

    expect(result.current.isLoading).toBe(false);
  });

  test("resets isLoading to false even when signUpAction throws", async () => {
    mocks.signUp.mockRejectedValue(new Error("Network error"));

    const { result } = renderHook(() => useAuth());
    await act(async () => {
      try { await result.current.signUp("new@test.com", "password123"); } catch {}
    });

    expect(result.current.isLoading).toBe(false);
  });

  test("migrates anon work and redirects on successful sign up", async () => {
    mocks.signUp.mockResolvedValue({ success: true });
    mocks.getAnonWorkData.mockReturnValue({
      messages: [{ role: "user", content: "build a form" }],
      fileSystemData: { "/App.jsx": "..." },
    });
    mocks.createProject.mockResolvedValue({ id: "anon-signup-project" });

    const { result } = renderHook(() => useAuth());
    await act(async () => { await result.current.signUp("new@test.com", "password123"); });

    expect(mocks.clearAnonWork).toHaveBeenCalled();
    expect(mocks.push).toHaveBeenCalledWith("/anon-signup-project");
  });

  test("redirects to existing project on successful sign up with no anon work", async () => {
    mocks.signUp.mockResolvedValue({ success: true });
    mocks.getProjects.mockResolvedValue([{ id: "existing-project-id" }]);

    const { result } = renderHook(() => useAuth());
    await act(async () => { await result.current.signUp("new@test.com", "password123"); });

    expect(mocks.push).toHaveBeenCalledWith("/existing-project-id");
    expect(mocks.createProject).not.toHaveBeenCalled();
  });

  test("creates a fresh project for brand-new user with no anon work", async () => {
    mocks.signUp.mockResolvedValue({ success: true });
    mocks.getProjects.mockResolvedValue([]);
    mocks.createProject.mockResolvedValue({ id: "brand-new-project-id" });

    const { result } = renderHook(() => useAuth());
    await act(async () => { await result.current.signUp("new@test.com", "password123"); });

    expect(mocks.createProject).toHaveBeenCalledWith(
      expect.objectContaining({ messages: [], data: {} })
    );
    expect(mocks.push).toHaveBeenCalledWith("/brand-new-project-id");
  });
});
