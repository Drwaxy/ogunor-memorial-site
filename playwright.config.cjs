const { defineConfig } = require('@playwright/test');
module.exports = defineConfig({ testDir: './tests', testMatch: '**/*.spec.cjs', workers: 1, use: { baseURL: 'http://127.0.0.1:8001', browserName: 'chromium', channel: 'msedge' } });
