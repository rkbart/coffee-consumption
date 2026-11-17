/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        ink: "#221a15",
        "ink-soft": "#463a30",
        muted: "#85766a",
        line: "#e8dfd2",
        "line-strong": "#d9cdbb",
        accent: "#a85b2b",
        "accent-dark": "#8a471f",
        "accent-soft": "#f4e5d7",
        green: "#3f6b52",
        "green-soft": "#e6efe7",
        red: "#a6412f",
        "red-soft": "#f8e5df",
        surface: "#fffcf8",
        "surface-2": "#f3ece1",
        bg: "#f5f0e8",
      },
      fontFamily: {
        sans: ["Inter", "-apple-system", "BlinkMacSystemFont", '"Segoe UI"', "sans-serif"],
        serif: ['"Fraunces"', '"Iowan Old Style"', "Georgia", "serif"],
      },
      borderRadius: {
        DEFAULT: "14px",
        sm: "8px",
        md: "12px",
        lg: "16px",
        full: "9999px",
      },
      spacing: {
        "14": "14px",
        "16": "16px",
      },
    },
    corePlugins: {
      preflight: false,
    },
  },
  plugins: [],
}
