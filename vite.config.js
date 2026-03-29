import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: '/', // Usar barra para producción en el dominio raíz (arregla el error de pantalla en blanco en sub-rutas)
})
