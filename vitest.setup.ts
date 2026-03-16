import "@testing-library/jest-dom/vitest";
import { vi } from "vitest";

vi.mock("@miden-sdk/miden-sdk", () => import("@/__tests__/mocks/miden-sdk"));
