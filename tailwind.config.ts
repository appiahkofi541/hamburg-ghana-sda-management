import type { Config } from "tailwindcss";

export default {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        navy: "#08294c",
        "navy-deep": "#041c35",
        churchblue: "#0a5dad",
        gold: "#d3a844",
        "gold-soft": "#f7edcc",
        cloud: "#f5f8fb",
      },
      boxShadow: {
        card: "0 8px 24px rgba(8, 41, 76, 0.06)",
      },
    },
  },
  plugins: [],
} satisfies Config;
