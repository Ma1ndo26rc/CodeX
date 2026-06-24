/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      fontFamily: {
        terminal: ['"Cascadia Code"', '"JetBrains Mono"', '"SFMono-Regular"', "Consolas", "monospace"],
        display: ['"Aptos Display"', '"Segoe UI Variable"', "sans-serif"],
      },
      colors: {
        terminal: {
          ink: "#05070A",
          panel: "#0A0F14",
          panel2: "#101821",
          line: "#23313D",
          amber: "#F6B739",
          green: "#48D597",
          red: "#FF5D5D",
          cyan: "#66D9EF",
          blue: "#6AA9FF",
        },
      },
      boxShadow: {
        terminal: "0 22px 70px rgba(0, 0, 0, 0.35)",
      },
    },
  },
  plugins: [],
};
