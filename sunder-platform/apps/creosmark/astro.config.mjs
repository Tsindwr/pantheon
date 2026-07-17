// @ts-check
import { defineConfig } from 'astro/config';

import react from '@astrojs/react';

// https://astro.build/config
export default defineConfig({
    site: 'https://creosmark.sunderttrpg.world',
    output: 'static',
    base: '/',
    integrations: [react()],
    vite: {
        resolve: {
            dedupe: ['react', 'react-dom', 'react/jsx-runtime', 'react/jsx-dev-runtime'],
        },
        optimizeDeps: {
            include: ['@xyflow/react'],
            exclude: ['@3d-dice/dice-box'],
        },
    },
});
