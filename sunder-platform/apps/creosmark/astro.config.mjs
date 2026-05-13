// @ts-check
import { defineConfig } from 'astro/config';

import react from '@astrojs/react';

// https://astro.build/config
export default defineConfig({
    site: 'https://tsindwr.github.io',
    output: 'static',
    base: '/creosmark',
    integrations: [react()],
    vite: {
        optimizeDeps: {
            include: ['@xyflow/react'],
        },
    },
});