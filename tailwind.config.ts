import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
      },
    },
  },
  daisyui: {
    themes: [
      {
        familyhub: {
          primary: "#9B98B0",        // Deeper Misty Lavender for better contrast
          "primary-content": "#FFFFFF", // White text on primary
          secondary: "#F1ECE3",      // Warm Sand
          "secondary-content": "#444B59", // Dark text on secondary
          accent: "#87A89A",         // Deeper Sage Green for better contrast
          "accent-content": "#FFFFFF", // White text on accent
          neutral: "#444B59",        // Slate Gray (main text color)
          "neutral-content": "#FFFFFF", // White text on neutral
          "base-100": "#FFFFFF",     // White background
          "base-200": "#F8F8F9",     // Light gray background
          "base-300": "#F0F0F1",     // Lighter gray
          info: "#7FA9C4",           // Deeper Sky Blue for better contrast
          "info-content": "#FFFFFF",  // White text on info
          success: "#87A89A",        // Sage Green
          "success-content": "#FFFFFF", // White text on success
          warning: "#E5B835",        // Deeper warm yellow
          "warning-content": "#444B59", // Dark text on warning
          error: "#D67678",          // Deeper soft red
          "error-content": "#FFFFFF", // White text on error
          "--rounded-box": "0.5rem",
          "--rounded-btn": "0.375rem",
          "--rounded-badge": "1.9rem",
          "--animation-btn": "0.25s",
          "--animation-input": "0.2s",
          "--btn-focus-scale": "0.95",
          "--border-btn": "1px",
          "--tab-border": "1px",
          "--tab-radius": "0.5rem",
        },
      },
      "light",
      "dark",
    ],
    darkTheme: "dark",
  },
  plugins: [require("daisyui")],
};
export default config;