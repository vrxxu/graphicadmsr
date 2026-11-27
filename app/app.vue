<script setup lang="ts">
import { ru } from '@nuxt/ui/locale'

const route = useRoute()
const colorMode = useColorMode()

const links = computed(() => [
  { label: 'График отпусков', icon: 'i-lucide-chart-gantt', to: '/', active: route.path === '/' },
  { label: 'Мой календарь', icon: 'i-lucide-calendar-days', to: '/calendar', active: route.path.startsWith('/calendar') },
  { label: 'Сотрудники', icon: 'i-lucide-users', to: '/employees', active: route.path.startsWith('/employees') },
  { label: 'Подразделения', icon: 'i-lucide-network', to: '/departments', active: route.path.startsWith('/departments') },
  { label: 'Отпуска', icon: 'i-lucide-tree-palm', to: '/vacations', active: route.path.startsWith('/vacations') },
  { label: 'Печать графика', icon: 'i-lucide-printer', to: '/print', active: route.path.startsWith('/print') }
])

const isDark = computed(() => colorMode.value === 'dark')
function toggleTheme() {
  colorMode.preference = isDark.value ? 'light' : 'dark'
}
</script>

<template>
  <UApp :locale="ru">
    <div class="min-h-screen bg-zinc-50 dark:bg-zinc-950 lg:flex print:bg-white!">
      <!-- левая стенка: узкая колонка иконок, при наведении плавно раскрывается с подписями -->
      <aside class="relative hidden w-16 shrink-0 lg:block print:hidden!">
        <div
          class="group fixed inset-y-0 left-0 z-50 flex w-16 flex-col gap-6 overflow-hidden border-r border-default bg-default p-2.5 transition-[width,box-shadow] duration-300 ease-out hover:w-56 hover:shadow-2xl focus-within:w-56 focus-within:shadow-2xl"
        >
          <NuxtLink to="/" class="flex h-10 items-center gap-3 rounded-lg px-1.5" aria-label="На главную">
            <span class="grid size-7 shrink-0 place-items-center rounded-lg bg-emerald-600 text-white">
              <UIcon name="i-lucide-calendar-range" class="size-4" />
            </span>
            <span class="whitespace-nowrap text-sm font-semibold opacity-0 transition-opacity duration-200 group-hover:opacity-100 group-focus-within:opacity-100">Отпуска</span>
          </NuxtLink>

          <nav class="flex flex-col gap-1">
            <NuxtLink
              v-for="l in links"
              :key="l.to"
              :to="l.to"
              :aria-label="l.label"
              class="relative flex h-10 items-center gap-3 rounded-lg px-2.5 transition-colors duration-200"
              :class="l.active
                ? 'bg-emerald-600/10 text-emerald-700 dark:text-emerald-400'
                : 'text-muted hover:bg-elevated hover:text-highlighted'"
            >
              <span
                class="absolute -left-2.5 top-1/2 w-1 -translate-y-1/2 rounded-r-full bg-emerald-600 transition-all duration-300"
                :class="l.active ? 'h-5 opacity-100' : 'h-0 opacity-0'"
              />
              <UIcon :name="l.icon" class="size-5 shrink-0 transition-transform duration-200 group-hover:scale-105" />
              <span class="whitespace-nowrap text-sm font-medium opacity-0 transition-opacity duration-200 group-hover:opacity-100 group-focus-within:opacity-100">{{ l.label }}</span>
            </NuxtLink>
          </nav>

          <button
            type="button"
            class="mt-auto flex h-10 items-center gap-3 rounded-lg px-2.5 text-muted transition-colors duration-200 hover:bg-elevated hover:text-highlighted"
            aria-label="Сменить тему"
            @click="toggleTheme"
          >
            <ClientOnly>
              <UIcon :name="isDark ? 'i-lucide-moon' : 'i-lucide-sun'" class="size-5 shrink-0" />
              <template #fallback><span class="size-5 shrink-0" /></template>
            </ClientOnly>
            <span class="whitespace-nowrap text-sm font-medium opacity-0 transition-opacity duration-200 group-hover:opacity-100 group-focus-within:opacity-100">Сменить тему</span>
          </button>
        </div>
      </aside>

      <div class="min-w-0 flex-1">
        <!-- узкие экраны: компактная полоса сверху -->
        <header class="sticky top-0 z-40 border-b border-default bg-default/90 backdrop-blur lg:hidden print:hidden!">
          <div class="flex items-center gap-2 px-3 py-2">
            <span class="grid size-7 place-items-center rounded-lg bg-emerald-600 text-white">
              <UIcon name="i-lucide-calendar-range" class="size-4" />
            </span>
            <span class="text-sm font-semibold">Отпуска</span>
            <UColorModeButton class="ml-auto" />
          </div>
          <nav class="flex gap-1 overflow-x-auto px-3 pb-2">
            <UButton
              v-for="l in links"
              :key="l.to"
              :to="l.to"
              :icon="l.icon"
              size="sm"
              class="shrink-0"
              :color="l.active ? 'primary' : 'neutral'"
              :variant="l.active ? 'soft' : 'ghost'"
            >
              {{ l.label }}
            </UButton>
          </nav>
        </header>

        <main>
          <UContainer class="max-w-[1600px] py-5 print:max-w-none! print:p-0!">
            <NuxtPage />
          </UContainer>
        </main>
      </div>
    </div>
  </UApp>
</template>
