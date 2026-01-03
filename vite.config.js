import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  // 將 base 放在這裡，確保資源路徑正確
  base: '/mahjong2/',
  plugins: [react()],
})