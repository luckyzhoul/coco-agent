/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './src/renderer/**/*.{js,ts,jsx,tsx,html}',
    './src/shared/**/*.{ts,tsx}'
  ],
  theme: {
    extend: {
      colors: {
        background: 'hsl(240 10% 3.9%)',
        foreground: 'hsl(0 0% 98%)',
        card: 'hsl(240 6% 10%)',
        'card-foreground': 'hsl(0 0% 98%)',
        border: 'hsl(240 3.7% 15.9%)',
        input: 'hsl(240 3.7% 15.9%)',
        primary: 'hsl(240 5.9% 90%)',
        'primary-foreground': 'hsl(240 5.9% 10%)',
        secondary: 'hsl(240 3.7% 15.9%)',
        muted: 'hsl(240 3.7% 15.9%)',
        'muted-foreground': 'hsl(240 5% 64.9%)',
        accent: 'hsl(240 3.7% 15.9%)'
      },
      borderRadius: {
        lg: '0.5rem',
        md: 'calc(0.5rem - 2px)',
        sm: 'calc(0.5rem - 4px)'
      }
    }
  },
  plugins: [],
  darkMode: 'class'
};
