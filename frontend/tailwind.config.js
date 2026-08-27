/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#eef4ff",
          100: "#d9e6ff",
          200: "#b3ccff",
          300: "#80a8ff",
          400: "#4d7fff",
          500: "#2456f5",
          600: "#1a3fd1",
          700: "#1730a3",
          800: "#152a80",
          900: "#152668",
        },
      },
    },
  },
  plugins: [],
};
