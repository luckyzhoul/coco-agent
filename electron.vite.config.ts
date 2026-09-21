import { defineConfig, externalizeDepsPlugin } from 'electron-vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  main: {
    build: {
      outDir: 'out/main',
      externalizeDeps: false,
      rollupOptions: {
        input: {
          index: path.resolve(__dirname, 'src/main/index.ts')
        }
      },
      commonjsOptions: {
        include: [/node_modules/]
      }
    }
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    build: {
      outDir: 'out/preload',
      rollupOptions: {
        input: {
          index: path.resolve(__dirname, 'src/main/preload.ts')
        }
      }
    }
  },
  renderer: {
    plugins: [react()],
    build: {
      outDir: 'out/renderer',
      rollupOptions: {
        input: {
          index: path.resolve(__dirname, 'src/renderer/index.html')
        }
      }
    },
    resolve: {
      alias: {
        '@shared': path.resolve(__dirname, 'src/shared'),
        '@renderer': path.resolve(__dirname, 'src/renderer')
      }
    }
  }
});
