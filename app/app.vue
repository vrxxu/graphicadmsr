<script setup lang="ts">
import { ru } from '@nuxt/ui/locale'

const route = useRoute()

const links = computed(() => [
  { label: 'График отпусков', icon: 'i-lucide-calendar-range', to: '/', active: route.path === '/' },
  { label: 'Сотрудники', icon: 'i-lucide-users', to: '/employees', active: route.path.startsWith('/employees') },
  { label: 'Подразделения', icon: 'i-lucide-network', to: '/departments', active: route.path.startsWith('/departments') },
  { label: 'Управление отпусками', icon: 'i-lucide-plane', to: '/vacations', active: route.path.startsWith('/vacations') }
])
</script>

<template>
  <UApp :locale="ru">
    <UHeader title="График отпусков" :ui="{ title: 'text-base sm:text-lg' }">
      <template #title>
        <span class="flex items-center gap-2">
          <UIcon name="i-lucide-palmtree" class="size-6 text-primary" />
          <span class="font-semibold leading-tight">
            График отпусков
            <span class="hidden sm:block text-xs font-normal text-muted">Администрация Сургутского района</span>
          </span>
        </span>
      </template>

      <UNavigationMenu :items="links" variant="link" />

      <template #right>
        <UColorModeButton />
      </template>

      <template #body>
        <UNavigationMenu :items="links" orientation="vertical" class="-mx-2.5" />
      </template>
    </UHeader>

    <UMain>
      <UContainer class="py-6 max-w-none">
        <NuxtPage />
      </UContainer>
    </UMain>
  </UApp>
</template>
