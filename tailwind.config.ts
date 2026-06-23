import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        gold: "#D4A847",
        ink: "#0F0F0E",
      },
    },
  },
  plugins: [],
};
export default config;
