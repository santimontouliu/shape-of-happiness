import { defineConfig } from 'vite';
import tailwindcss from '@tailwindcss/vite';

// `base: './'` keeps asset paths relative so the build works on GitHub Pages
// project sites (username.github.io/repo/) as well as Vercel/Netlify roots.
export default defineConfig({
  base: './',
  plugins: [tailwindcss()],
  build: { target: 'es2022' },
});
