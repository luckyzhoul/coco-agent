/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './src/renderer/**/*.{js,ts,jsx,tsx,html}',
    './src/shared/**/*.{ts,tsx}'
  ],
  theme: {
    extend: {
      colors: {
        background: '#F8F4EC',
        foreground: '#3D3A36',
        card: '#F0E8DA',
        'card-foreground': '#3D3A36',
        border: '#E6DDCE',
        input: '#EDE5D6',
        primary: '#3D3A36',
        'primary-foreground': '#F8F4EC',
        secondary: '#F0E8DA',
        'secondary-foreground': '#3D3A36',
        muted: '#EDE5D6',
        'muted-foreground': '#8B857B',
        accent: '#E8DFD0',
        'accent-foreground': '#3D3A36',
        'chat-user': '#E8DFD0',
        'chat-assistant': '#FDFBF6'
      },
      fontFamily: {
        sans: ['-apple-system', 'BlinkMacSystemFont', '"PingFang SC"', '"Microsoft YaHei"', '"Segoe UI"', 'Roboto', 'sans-serif']
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
