import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        zillowBlue: "#006AFF",
        zillowSlate: "#35405A",
      },
      boxShadow: {
        soft: "0 8px 24px rgba(21, 34, 66, 0.08)",
      },
    },
  },
  plugins: [],
};

export default config;
