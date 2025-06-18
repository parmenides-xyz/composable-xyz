/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        background: 'hsl(var(--background))',
        'secondary-background': 'hsl(var(--secondary-background))',
        foreground: 'hsl(var(--foreground))',
        'main-foreground': 'hsl(var(--main-foreground))',
        main: 'hsl(var(--main))',
        border: 'hsl(var(--border))',
        ring: 'hsl(var(--ring))',
        overlay: 'hsl(var(--overlay))',
        'chart-1': 'var(--chart-1)',
        'chart-2': 'var(--chart-2)',
        'chart-3': 'var(--chart-3)',
        'chart-4': 'var(--chart-4)',
        'chart-5': 'var(--chart-5)',
      },
      borderRadius: {
        base: '5px',
      },
      boxShadow: {
        shadow: 'var(--shadow)',
      },
      fontWeight: {
        base: '600',
        heading: '700',
      },
    },
  },
  plugins: [],
}