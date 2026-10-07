import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";

// jsdom exposes animation styles without AnimationEvent. Declare support before
// React loads so standard animationend events use the browser event name.
vi.hoisted(() => {
  window.AnimationEvent ??= window.Event as unknown as typeof AnimationEvent;
});

// Vitest globals are disabled, so register DOM cleanup explicitly.
afterEach(cleanup);
