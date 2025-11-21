import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // FE gọi /vngeo/... -> forward sang https://provinces.open-api.vn/api/...
      '/vngeo': {
        target: 'https://provinces.open-api.vn',
        changeOrigin: true,
        // proxy HTTPS chuẩn → KHÔNG cần secure:false
        rewrite: (path) => path.replace(/^\/vngeo/, '/api'),
      },
    },
  },
})
