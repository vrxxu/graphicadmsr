<script setup lang="ts">
const props = withDefaults(defineProps<{ name: string, size?: 'sm' | 'md' | 'lg' }>(), { size: 'md' })

const PALETTE = [
  'bg-blue-100 text-blue-700 dark:bg-blue-400/20 dark:text-blue-200',
  'bg-emerald-100 text-emerald-700 dark:bg-emerald-400/20 dark:text-emerald-200',
  'bg-rose-100 text-rose-700 dark:bg-rose-400/20 dark:text-rose-200',
  'bg-violet-100 text-violet-700 dark:bg-violet-400/20 dark:text-violet-200',
  'bg-amber-100 text-amber-800 dark:bg-amber-400/20 dark:text-amber-200',
  'bg-sky-100 text-sky-700 dark:bg-sky-400/20 dark:text-sky-200'
]

const initials = computed(() => {
  const parts = props.name.trim().split(/\s+/)
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase()
})
// цвет закрепляется за человеком: одно и то же имя — всегда один и тот же оттенок
const tone = computed(() => {
  let h = 0
  for (const ch of props.name) h = (h * 31 + ch.charCodeAt(0)) >>> 0
  return PALETTE[h % PALETTE.length]
})
</script>

<template>
  <span
    class="grid shrink-0 place-items-center rounded-full font-semibold"
    :class="[tone, size === 'sm' ? 'size-6 text-[9px]' : size === 'lg' ? 'size-14 text-lg' : 'size-8 text-[11px]']"
    aria-hidden="true"
  >{{ initials }}</span>
</template>
