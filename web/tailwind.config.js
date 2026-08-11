/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        navy: {
          DEFAULT: "#12161F",
          panel: "#1C2230",
          line: "#2A3143",
        },
        paper: "#F5EFE1",
        ink: "#1B1712",
        amber: {
          DEFAULT: "#E2892E",
          dark: "#B96A1C",
        },
        sage: "#5B8265",
        rust: "#B24B3C",
        violet: "#6E6A9E",
        slate: {
          warm: "#7C7566",
        },
      },
      fontFamily: {
        display: ["Space Grotesk", "sans-serif"],
        body: ["IBM Plex Sans", "sans-serif"],
        mono: ["IBM Plex Mono", "monospace"],
      },
    },
  },
  plugins: [],
}
