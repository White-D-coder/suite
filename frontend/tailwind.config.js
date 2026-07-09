import tailwindAnimate from "tailwindcss-animate";

/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ["class"],
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: { "2xl": "1400px" },
    },
    extend: {
      colors: {
        /* ── shadcn bridge (hsl var) ── */
        border:      "hsl(var(--border))",
        input:       "hsl(var(--input))",
        ring:        "hsl(var(--ring))",
        background:  "hsl(var(--background))",
        foreground:  "hsl(var(--foreground))",
        primary: {
          DEFAULT:    "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT:    "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT:    "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT:    "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT:    "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT:    "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT:    "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },

        /* ── Design token surfaces (CSS var) ── */
        "surface-page":   "var(--surface-page)",
        "surface-card":   "var(--surface-card)",
        "surface-muted":  "var(--surface-muted)",
        "surface-info":   "var(--surface-info)",
        "surface-sunken": "var(--surface-sunken)",

        /* ── Borders ── */
        "border-subtle":  "var(--border-subtle)",
        "border-default": "var(--border-default)",
        "border-strong":  "var(--border-strong)",

        /* ── Text ── */
        "text-primary":   "var(--text-primary)",
        "text-secondary": "var(--text-secondary)",
        "text-tertiary":  "var(--text-tertiary)",
        "text-link":      "var(--text-link)",

        /* ── Accent primary (sky blue) ── */
        "ap":       "var(--accent-primary)",
        "ap-hover": "var(--accent-primary-hover)",
        "ap-fg":    "var(--accent-primary-fg)",

        /* ── Accent secondary (sage) ── */
        "as":       "var(--accent-secondary)",
        "as-hover": "var(--accent-secondary-hover)",
        "as-fg":    "var(--accent-secondary-fg)",

        /* ── Accent warning (rose) ── */
        "aw":       "var(--accent-warning)",
        "aw-hover": "var(--accent-warning-hover)",
        "aw-fg":    "var(--accent-warning-fg)",

        /* ── Status ── */
        "status-online":   "var(--status-online)",
        "status-offline":  "var(--status-offline)",
        "status-idle":     "var(--status-idle)",
        "status-neutral":  "var(--status-neutral)",
      },
      borderRadius: {
        sm:   "var(--radius-sm)",
        md:   "var(--radius-md)",
        lg:   "var(--radius-lg)",
        pill: "var(--radius-pill)",
        /* keep defaults working */
        DEFAULT: "var(--radius-md)",
      },
      boxShadow: {
        "t-sm": "var(--shadow-sm)",
        "t-md": "var(--shadow-md)",
        "t-lg": "var(--shadow-lg)",
      },
      width: {
        sidebar:      "var(--sidebar-width)",
        "sidebar-rail": "var(--sidebar-rail-width)",
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to:   { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to:   { height: "0" },
        },
        "dot-pulse": {
          "0%, 100%": { opacity: "1" },
          "50%":      { opacity: "0.3" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up":   "accordion-up 0.2s ease-out",
        "dot-pulse":      "dot-pulse 1.4s ease-in-out infinite",
      },
    },
  },
  plugins: [tailwindAnimate],
};
