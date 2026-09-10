/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './dashboard/index.html',
    './dashboard/src/**/*.{js,ts,jsx,tsx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        copilot: {
          blue: '#0969da',
          dark: '#0d1117',
          card: '#161b22',
          border: '#30363d',
          accent: '#238636',
          purple: '#8957e5',
        },
      },
    },
  },
  plugins: [],
};
