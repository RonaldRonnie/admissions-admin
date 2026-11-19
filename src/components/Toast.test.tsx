import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ToastProvider, useToast } from "./Toast";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let toast: ReturnType<typeof useToast>;
function Grab() {
  toast = useToast();
  return null;
}

describe("toasts", () => {
  let container: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;

  beforeEach(() => {
    vi.useFakeTimers();
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    act(() =>
      root.render(
        <ToastProvider>
          <Grab />
        </ToastProvider>,
      ),
    );
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.useRealTimers();
  });

  it("clears a success message after a few seconds", () => {
    act(() => toast.success("Saved."));
    expect(container.textContent).toContain("Saved.");
    act(() => vi.advanceTimersByTime(4100));
    expect(container.textContent).not.toContain("Saved.");
  });

  it("keeps an error until it is dismissed", () => {
    act(() => toast.error(new Error("Nope.")));
    act(() => vi.advanceTimersByTime(60_000));
    expect(container.textContent).toContain("Nope.");
  });
});
