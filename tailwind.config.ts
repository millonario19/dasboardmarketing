import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        surface: "var(--surface-1)",
        page: "var(--page-plane)",
        "ink-primary": "var(--text-primary)",
        "ink-secondary": "var(--text-secondary)",
        "ink-muted": "var(--text-muted)",
        gridline: "var(--gridline)",
        baseline: "var(--baseline)",
        series1: "var(--series-1)",
        series2: "var(--series-2)",
        series3: "var(--series-3)",
        good: "var(--status-good)",
      },
    },
  },
  plugins: [],
};
export default config;
