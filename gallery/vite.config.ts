import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  base: '/zallery/',
  plugins: [react()],
  resolve: {
    dedupe: [
      '@deck.gl/core',
      '@deck.gl/react',
      '@luma.gl/core',
      '@luma.gl/engine',
      '@luma.gl/webgl',
      '@luma.gl/shadertools',
    ],
    alias: {
      // Force single copies of deck.gl/luma.gl
      '@deck.gl/core': path.resolve('./node_modules/@deck.gl/core'),
      '@luma.gl/core': path.resolve('./node_modules/@luma.gl/core'),
      '@luma.gl/engine': path.resolve('./node_modules/@luma.gl/engine'),
      '@luma.gl/webgl': path.resolve('./node_modules/@luma.gl/webgl'),
      '@luma.gl/shadertools': path.resolve('./node_modules/@luma.gl/shadertools'),
    },
  },
  optimizeDeps: {
    include: ['ome-zarr.js'],
  },
})
