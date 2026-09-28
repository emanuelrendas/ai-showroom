import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// Vitest globals are disabled, so register DOM cleanup explicitly.
afterEach(cleanup);
