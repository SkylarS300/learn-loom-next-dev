import { defineConfig } from "vitest/config";

export default defineConfig({
    test: {
        environment: "node",
        include: ["tests/**/*.test.{js,ts}"],
    },
    // Keep unit tests JS-only; bypass project PostCSS/Tailwind
    css: {
        postcss: {
            plugins: [],
        },
    },
});