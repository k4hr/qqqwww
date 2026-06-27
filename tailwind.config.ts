import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        mario: {
          green: "#6fbe44",
          dark: "#151515",
          coal: "#202020",
          line: "#e5e5e5"
        }
      },
      boxShadow: {
        card: "0 12px 30px rgba(0,0,0,.10)"
      }
    },
  },
  plugins: [],
};
export default config;
