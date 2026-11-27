<script setup lang="ts">
import type { Department } from '#shared/types'

const toast = useToast()
const { departments, employees, tree, refresh } = useSchedule()

const countOwn = computed(() => {
  const m = new Map<number, number>()
  for (const e of employees.value) m.set(e.departmentId, (m.get(e.departmentId) ?? 0) + 1)
  return m
})
const flat = computed(() => flatten(tree.value))
const maxDepth = computed(() => flat.value.reduce((m, n) => Math.max(m, n.depth + 1), 0))
const totalIn = (n: DeptNode) => subtreeIds(n).reduce((s, id) => s + (countOwn.value.get(id) ?? 0), 0)

// ---------- форма ----------
const formOpen = ref(false)
const editing = ref<Department | null>(null)
const form = reactive({ name: '', parentId: 0 })
const saving = ref(false)

// недопустимые родители при редактировании: само подразделение и его потомки
const parentItems = computed(() => {
  const blocked = new Set<number>()
  if (editing.value) {
    const node = findNode(tree.value, editing.value.id)
    if (node) subtreeIds(node).forEach(i => blocked.add(i))
  }
  return [
    { label: '— без родителя (корневое) —', value: 0 },
    ...flat.value.filter(n => !blocked.has(n.id)).map(n => ({ label: `${'— '.repeat(n.depth)}${n.name}`, value: n.id }))
  ]
})

function openForm(dep: Department | null, parentId = 0) {
  editing.value = dep
  form.name = dep?.name ?? ''
  form.parentId = dep ? (dep.parentId ?? 0) : parentId
  formOpen.value = true
}

async function save() {
  if (!form.name.trim()) return toast.add({ title: 'Укажите название', color: 'error' })
  saving.value = true
  try {
    const body = { name: form.name, parentId: form.parentId || null }
    if (editing.value) await $fetch(`/api/departments/${editing.value.id}`, { method: 'PUT', body })
    else await $fetch('/api/departments', { method: 'POST', body })
    toast.add({ title: 'Сохранено', color: 'success' })
    formOpen.value = false
    await refresh()
  } catch (e) {
    toast.add({ title: 'Не удалось сохранить', description: errorMessage(e), color: 'error' })
  } finally {
    saving.value = false
  }
}

async function remove(dep: Department) {
  try {
    await $fetch(`/api/departments/${dep.id}`, { method: 'DELETE' })
    toast.add({ title: 'Подразделение удалено', color: 'success' })
    await refresh()
  } catch (e) {
    toast.add({ title: 'Удаление невозможно', description: errorMessage(e), color: 'error' })
  }
}

// ---------- сброс демо-данных ----------
const resetOpen = ref(false)
async function reset() {
  try {
    await $fetch('/api/reset', { method: 'POST' })
    toast.add({ title: 'Демонстрационные данные восстановлены', color: 'success' })
    resetOpen.value = false
    await refresh()
  } catch (e) {
    toast.add({ title: 'Ошибка', description: errorMessage(e), color: 'error' })
  }
}
</script>

<template>
  <div class="space-y-4">
    <!-- заголовок -->
    <div class="flex flex-wrap items-end gap-x-4 gap-y-1">
      <div class="min-w-0">
        <h1 class="text-lg font-semibold truncate">Организационная структура</h1>
        <p class="text-sm text-muted truncate">Подразделения и количество сотрудников в них</p>
      </div>
      <div class="ml-auto flex items-center gap-2">
        <UButton color="neutral" variant="outline" icon="i-lucide-database-backup" @click="resetOpen = true">Сбросить демо-данные</UButton>
        <UButton icon="i-lucide-plus" @click="openForm(null)">Добавить подразделение</UButton>
      </div>
    </div>

    <!-- сводка -->
    <div class="grid grid-cols-2 gap-2.5 md:grid-cols-3">
      <div class="rounded-xl border border-default bg-default px-3.5 py-2.5">
        <div class="text-xs text-muted">Подразделений</div>
        <div class="mt-0.5 text-xl font-semibold tabular-nums">{{ flat.length }}</div>
      </div>
      <div class="rounded-xl border border-default bg-default px-3.5 py-2.5">
        <div class="text-xs text-muted">Сотрудников</div>
        <div class="mt-0.5 text-xl font-semibold tabular-nums">{{ employees.length }}</div>
      </div>
      <div class="col-span-2 rounded-xl border border-default bg-default px-3.5 py-2.5 md:col-span-1">
        <div class="text-xs text-muted">Уровней вложенности</div>
        <div class="mt-0.5 text-xl font-semibold tabular-nums">{{ maxDepth }}</div>
      </div>
    </div>

    <section class="overflow-hidden rounded-2xl border border-default bg-default">
      <ul class="divide-y divide-default">
        <li
          v-for="n in flat"
          :key="n.id"
          class="group flex items-center gap-3 py-2.5 pr-3 transition-colors hover:bg-elevated/60"
          :style="{ paddingLeft: `${16 + n.depth * 24}px` }"
        >
          <UIcon :name="n.children.length ? 'i-lucide-folder-tree' : 'i-lucide-folder'" class="size-4 shrink-0 text-primary" />
          <div class="min-w-0">
            <div class="truncate text-[13px] font-medium">{{ n.name }}</div>
            <div class="text-xs text-muted">
              Сотрудников: {{ countOwn.get(n.id) ?? 0 }}
              <template v-if="n.children.length"> · с вложенными: {{ totalIn(n) }}</template>
            </div>
          </div>
          <div class="ml-auto flex shrink-0 gap-1 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100 pointer-coarse:opacity-100">
            <UButton icon="i-lucide-printer" color="neutral" variant="ghost" size="sm" aria-label="Печать графика подразделения" :to="{ path: '/print', query: { dept: n.id } }" />
            <UButton icon="i-lucide-folder-plus" color="neutral" variant="ghost" size="sm" aria-label="Добавить вложенное" @click="openForm(null, n.id)" />
            <UButton icon="i-lucide-pencil" color="neutral" variant="ghost" size="sm" aria-label="Изменить" @click="openForm(departments.find(d => d.id === n.id)!)" />
            <UButton icon="i-lucide-trash-2" color="error" variant="ghost" size="sm" aria-label="Удалить" @click="remove(departments.find(d => d.id === n.id)!)" />
          </div>
        </li>
      </ul>
    </section>

    <UModal v-model:open="formOpen" :title="editing ? 'Редактирование подразделения' : 'Новое подразделение'">
      <template #body>
        <UForm :state="form" class="space-y-4" @submit="save">
          <UFormField label="Название" required>
            <UInput v-model="form.name" class="w-full" />
          </UFormField>
          <UFormField label="Входит в">
            <USelectMenu v-model="form.parentId" :items="parentItems" value-key="value" class="w-full" />
          </UFormField>
          <div class="flex justify-end gap-2">
            <UButton color="neutral" variant="outline" @click="formOpen = false">Отмена</UButton>
            <UButton type="submit" :loading="saving">Сохранить</UButton>
          </div>
        </UForm>
      </template>
    </UModal>

    <UModal v-model:open="resetOpen" title="Сбросить демонстрационные данные?">
      <template #body>
        <p class="text-sm text-muted">Все внесённые изменения будут потеряны, база вернётся к исходному набору тестовых данных.</p>
      </template>
      <template #footer>
        <div class="flex justify-end gap-2 w-full">
          <UButton color="neutral" variant="outline" @click="resetOpen = false">Отмена</UButton>
          <UButton color="error" @click="reset">Сбросить</UButton>
        </div>
      </template>
    </UModal>
  </div>
</template>
