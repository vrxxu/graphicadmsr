export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  modules: ['@nuxt/ui'],
  css: ['~/assets/css/main.css'],
  devtools: { enabled: false },
  colorMode: { preference: 'system' },
  devServer: { host: '127.0.0.1', port: 3000 },
  app: {
    head: {
      htmlAttrs: { lang: 'ru' },
      title: 'График отпусков — Администрация Сургутского района'
    }
  },
  nitro: {
    // node:sqlite встроен в Node.js >= 22.13, внешние пакеты не нужны
    externals: { external: ['node:sqlite'] }
  }
})