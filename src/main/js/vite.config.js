import { defineConfig } from 'vite';
import legacy from '@vitejs/plugin-legacy';
import { resolve } from 'path';

export default defineConfig({
  root: resolve(__dirname),
  base: '/static/',
  
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: true,
    
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.js')
      },
      output: {
        entryFileNames: 'js/[name].[hash].js',
        chunkFileNames: 'js/[name].[hash].js',
        assetFileNames: 'assets/[name].[hash].[ext]',
        
        // Create a global variable for backward compatibility
        name: 'LuckyGas',
        format: 'iife',
        globals: {
          // Define any external globals here
        }
      }
    },
    
    // Minification settings
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: false, // Keep console logs in development
        drop_debugger: true,
        pure_funcs: ['console.debug']
      },
      format: {
        comments: false
      }
    },
    
    // Target browsers
    target: 'es2015',
    
    // Optimize dependencies
    commonjsOptions: {
      transformMixedEsModules: true
    }
  },
  
  plugins: [
    // Support legacy browsers
    legacy({
      targets: ['defaults', 'not IE 11'],
      additionalLegacyPolyfills: ['regenerator-runtime/runtime'],
      renderLegacyChunks: true,
      polyfills: [
        'es.symbol',
        'es.array.filter',
        'es.promise',
        'es.promise.finally',
        'es/map',
        'es/set',
        'es.array.for-each',
        'es.object.define-properties',
        'es.object.define-property',
        'es.object.get-own-property-descriptor',
        'es.object.get-own-property-descriptors',
        'es.object.keys',
        'es.object.to-string',
        'web.dom-collections.for-each',
        'esnext.global-this',
        'esnext.string.match-all'
      ]
    })
  ],
  
  resolve: {
    alias: {
      '@': resolve(__dirname),
      '@core': resolve(__dirname, 'core'),
      '@utils': resolve(__dirname, 'utils'),
      '@state': resolve(__dirname, 'state'),
      '@api': resolve(__dirname, 'core/api'),
      '@components': resolve(__dirname, 'components'),
      '@config': resolve(__dirname, 'config')
    }
  },
  
  server: {
    port: 3000,
    open: false,
    cors: true,
    proxy: {
      // Proxy API requests to the Python backend
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
        secure: false
      },
      '/login': {
        target: 'http://localhost:8000',
        changeOrigin: true,
        secure: false
      },
      '/logout': {
        target: 'http://localhost:8000',
        changeOrigin: true,
        secure: false
      }
    }
  },
  
  optimizeDeps: {
    include: ['dompurify'],
    exclude: []
  }
});