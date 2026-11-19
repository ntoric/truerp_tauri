import type { Config } from "tailwindcss"

const NEUTRALS = {
  50: "#fafafa",
  100: "#f4f4f5",
  200: "#ebe9ea",
  300: "#dad6d7",
  400: "#a59a9c",
  500: "#6f6466",
  600: "#584e50",
  700: "#3f3638",
  800: "#2f2729",
  900: "hsl(var(--theme-950) / <alpha-value>)",
  950: "hsl(var(--theme-950) / <alpha-value>)",
}

const config: Config = {
  darkMode: ["class"],
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-poppins)', 'Poppins', 'Inter', '"Segoe UI"', 'Arial', 'sans-serif'],
      },
      colors: {
        /*
          Gooseroot warm neutrals. slate/gray are used across hundreds of
          pages, so remapping them here moves the whole app onto the kit's
          wine-tinted greys. 900/950 resolve to the accent's deepest shade
          (Deep Wine #4A0010 for Crimson), the kit's heading colour.
        */
        slate: NEUTRALS,
        gray: NEUTRALS,
        heading: 'hsl(var(--heading) / <alpha-value>)',
        tint: 'hsl(var(--theme-50) / <alpha-value>)',
        surface: {
          DEFAULT: 'hsl(var(--card) / <alpha-value>)',
          2: 'hsl(var(--surface-2) / <alpha-value>)',
        },
        success: {
          DEFAULT: 'hsl(var(--success) / <alpha-value>)',
          tint: 'hsl(var(--success-tint) / <alpha-value>)',
        },
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        blue: {
          50: "hsl(var(--theme-50))",
          100: "hsl(var(--theme-100))",
          200: "hsl(var(--theme-200))",
          300: "hsl(var(--theme-300))",
          400: "hsl(var(--theme-400))",
          500: "hsl(var(--theme-500))",
          600: "hsl(var(--theme-600))",
          700: "hsl(var(--theme-700))",
          800: "hsl(var(--theme-800))",
          900: "hsl(var(--theme-900))",
          950: "hsl(var(--theme-950))",
        },
      },
      // Driven by the Appearance → Corner style preference (see globals.css).
      borderRadius: {
        sm: "var(--r-sm)",
        DEFAULT: "var(--r-sm)",
        md: "var(--r-md)",
        lg: "var(--r-lg)",
        xl: "var(--r-xl)",
        "2xl": "var(--r-2xl)",
        "3xl": "var(--r-3xl)",
      },
      boxShadow: {
        "gr-xs": "var(--shadow-xs)",
        "gr-sm": "var(--shadow-sm)",
        "gr-md": "var(--shadow-md)",
        "gr-lg": "var(--shadow-lg)",
        "gr-accent": "var(--shadow-accent)",
      },
      backgroundImage: {
        "brand-gradient":
          "linear-gradient(135deg, hsl(var(--grad-start)) 0%, hsl(var(--grad-mid)) 45%, hsl(var(--grad-end)) 100%)",
        "brand-rail":
          "linear-gradient(180deg, hsl(var(--grad-start)) 0%, hsl(var(--grad-mid)) 45%, hsl(var(--grad-end)) 100%)",
        "button-gradient": "linear-gradient(135deg, hsl(var(--btn-start)) 0%, hsl(var(--btn-end)) 100%)",
      },
      keyframes: {
        "nav-progress": {
          "0%": { transform: "translateX(-100%)" },
          "50%": { transform: "translateX(120%)" },
          "100%": { transform: "translateX(320%)" },
        },
        // Gooseroot kit tab motion: pill pops in, underline grows from centre.
        "gr-tab-pop": {
          from: { transform: "scale(.92)" },
          to: { transform: "scale(1)" },
        },
        "gr-tab-underline": {
          from: { transform: "scaleX(0)" },
          to: { transform: "scaleX(1)" },
        },
      },
      animation: {
        "nav-progress": "nav-progress 1.1s ease-in-out infinite",
        "gr-tab-pop": "gr-tab-pop .3s cubic-bezier(.3, 1.4, .5, 1)",
        "gr-tab-underline": "gr-tab-underline .35s cubic-bezier(.2, .8, .2, 1)",
      },
    },
  },
  plugins: [],
}
export default config
