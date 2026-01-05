/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
        "./components/**/*.{js,ts,jsx,tsx}",
        "./services/**/*.{js,ts,jsx,tsx}",
        "./utils/**/*.{js,ts,jsx,tsx}",
        "./*.{js,ts,jsx,tsx}" // root files
    ],
    theme: {
        extend: {
            fontFamily: {
                sans: ['Nunito', 'sans-serif'],
            },
            colors: {
                cream: '#FFFDF5',
                dark: '#2D2D2D',
                sunny: '#FFD166',
                coral: '#EF476F',
                softblue: '#118AB2',
                mint: '#06D6A0',
            },
            boxShadow: {
                'pop': '4px 4px 0px 0px rgba(0,0,0,0.08)',
                'pop-hover': '6px 6px 0px 0px rgba(0,0,0,0.08)',
                'pop-sm': '2px 2px 0px 0px rgba(0,0,0,0.08)',
            },
            animation: {
                'float': 'float 3s ease-in-out infinite',
            },
            keyframes: {
                float: {
                    '0%, 100%': { transform: 'translateY(0)' },
                    '50%': { transform: 'translateY(-5px)' },
                }
            }
        },
    },
    plugins: [],
}
