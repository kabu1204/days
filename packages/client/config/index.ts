import path from 'node:path'
import { defineConfig, type UserConfigExport } from '@tarojs/cli'

const API_TARGET = process.env.DAYS_API ?? 'http://127.0.0.1:8787'

// https://docs.taro.zone/docs/next/config
export default defineConfig<'vite'>(async (merge) => {
  const baseConfig: UserConfigExport<'vite'> = {
    projectName: 'days',
    date: '2026-11-14',
    designWidth: 375,
    deviceRatio: { 375: 2, 640: 2.34 / 2, 750: 1, 828: 1.81 / 2 },
    sourceRoot: 'src',
    outputRoot: 'dist',
    plugins: [],
    defineConstants: {},
    alias: {
      '@': path.resolve(__dirname, '..', 'src'),
    },
    copy: { patterns: [], options: {} },
    framework: 'react',
    compiler: {
      type: 'vite',
      vitePlugins: [
        {
          // MapLibre GL uses syntax newer than Taro's default build target.
          name: 'days-build-target',
          enforce: 'post',
          config: () => ({ build: { target: 'es2020' }, esbuild: { target: 'es2020' } }),
          // The map and metadata libraries are large and used by few pages;
          // they are kept out of the bundle that every page loads.
          configResolved(config: any) {
            const output = config.build.rollupOptions.output
            const original = output.manualChunks
            output.manualChunks = (id: string, api: unknown) => {
              if (/node_modules[\\/](\.pnpm[\\/])?(maplibre-gl|pmtiles|fflate|@mapbox|@maplibre)/.test(id)) return 'maplib'
              if (/node_modules[\\/](\.pnpm[\\/])?exifr/.test(id)) return 'exif-reader'
              return original(id, api)
            }
          },
        },
      ],
    },
    h5: {
      publicPath: '/',
      staticDirectory: 'static',
      router: { mode: 'hash' },
      devServer: {
        port: 10086,
        open: false,
        proxy: {
          '/api': { target: API_TARGET, changeOrigin: false },
          '/files': { target: API_TARGET, changeOrigin: false },
          '/tiles': { target: API_TARGET, changeOrigin: false },
        },
      },
      postcss: {
        // Pixel art needs fixed pixel sizes. Taro's unit conversion scales
        // sizes with the screen width, which blurs sprites and borders.
        pxtransform: { enable: false },
        autoprefixer: { enable: true, config: {} },
        cssModules: { enable: false },
      },
    },
  }
  return merge({}, baseConfig)
})
