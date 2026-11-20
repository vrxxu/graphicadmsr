<script setup lang="ts">
import { ru } from '@nuxt/ui/locale'

const route = useRoute()

const links = computed(() => [
  { label: 'График отпусков', icon: 'i-lucide-calendar-range', to: '/', active: route.path === '/' },
  { label: 'Мой календарь', icon: 'i-lucide-calendar-days', to: '/calendar', active: route.path.startsWith('/calendar') },
  { label: 'Сотрудники', icon: 'i-lucide-users', to: '/employees', active: route.path.startsWith('/employees') },
  { label: 'Подразделения', icon: 'i-lucide-network', to: '/departments', active: route.path.startsWith('/departments') },
  { label: 'Управление отпусками', icon: 'i-lucide-plane', to: '/vacations', active: route.path.startsWith('/vacations') }
])

// дата только на клиенте, чтобы не ловить расхождение при гидратации
const dateLabel = ref('')
onMounted(() => {
  dateLabel.value = new Date().toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
})
</script>

<template>
  <UApp :locale="ru">
    <!-- левая панель с иконками (десктоп) -->
    <aside class="rail hidden lg:flex">
      <NuxtLink to="/" class="brand" aria-label="График отпусков">
        <UIcon name="i-lucide-palmtree" class="size-6" />
      </NuxtLink>

      <nav class="flex flex-col items-center gap-2 mt-6">
        <UTooltip
          v-for="l in links"
          :key="l.to"
          :text="l.label"
          :content="{ side: 'right', sideOffset: 14 }"
        >
          <NuxtLink :to="l.to" class="rail-link" :class="{ 'is-active': l.active }" :aria-label="l.label">
            <UIcon :name="l.icon" class="size-5" />
          </NuxtLink>
        </UTooltip>
      </nav>

      <div class="mt-auto">
        <UColorModeButton color="neutral" variant="ghost" class="fx-pop" />
      </div>
    </aside>

    <div class="shell">
      <!-- верхняя строка: заголовок отдельно, навигации в ней больше нет -->
      <header class="topbar">
        <div class="lg:hidden">
          <NuxtLink to="/" class="brand brand-sm" aria-label="График отпусков">
            <UIcon name="i-lucide-palmtree" class="size-5" />
          </NuxtLink>
        </div>
        <div class="min-w-0">
          <h1 class="topbar-title">График отпусков</h1>
          <p class="topbar-sub">Администрация Сургутского района</p>
        </div>

        <div class="ml-auto flex items-center gap-3">
          <span v-if="dateLabel" class="date-chip hidden sm:inline-flex">
            <UIcon name="i-lucide-calendar" class="size-4 text-primary" />
            {{ dateLabel }}
          </span>
          <div class="lg:hidden"><UColorModeButton color="neutral" variant="ghost" /></div>
        </div>
      </header>

      <!-- навигация для планшетов и телефонов -->
      <div class="lg:hidden">
      <nav class="mobile-nav">
        <NuxtLink v-for="l in links" :key="l.to" :to="l.to" class="mobile-link" :class="{ 'is-active': l.active }">
          <UIcon :name="l.icon" class="size-4" />
          {{ l.label }}
        </NuxtLink>
      </nav>
      </div>

      <main class="px-4 sm:px-8 pb-10 pt-2">
        <NuxtPage />
      </main>
    </div>
  </UApp>
</template>
