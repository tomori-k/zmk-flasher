/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  safelist: ["message-info", "message-success", "message-error"],
  theme: {
    extend: {
      colors: {
        ink: "#172026",
        panel: "#F5F7FA",
        line: "#DDE5EC",
        mint: "#0F8B6F",
        azure: "#2F6FD6",
        coral: "#C95038",
        brass: "#9A741D",
      },
      fontFamily: {
        sans: [
          "Inter",
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "BlinkMacSystemFont",
          "Segoe UI",
          "sans-serif",
        ],
      },
      boxShadow: {
        toolbar: "0 12px 30px rgb(23 32 38 / 0.08)",
      },
    },
  },
  plugins: [],
};
