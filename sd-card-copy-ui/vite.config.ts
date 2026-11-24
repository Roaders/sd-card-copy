import { defineConfig } from 'vite';

export default defineConfig({
    build: {
        outDir: '../dist/ui',
        emptyOutDir: true,
    },
    server: {
        // npm start in this folder serves the UI against a server running on this machine
        proxy: { '/api': 'http://localhost:3001' },
    },
});
