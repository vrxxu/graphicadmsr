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
  <div class="max-w-4xl mx-auto space-y-4">
    <div class="flex flex-wrap items-center gap-3">
      <h1 class="text-xl font-semibold mr-auto">Организационная структура</h1>
      <UButton class="fx-spin" color="neutral" variant="outline" icon="i-lucide-database-backup" @click="resetOpen = true">Сбросить демо-данные</UButton>
      <UButton class="fx-rot90" icon="i-lucide-plus" @click="openForm(null)">Добавить</UButton>
    </div>

    <UCard :ui="{ body: 'p-2 sm:p-2' }">
      <ul class="divide-y divide-default">
        <li
          v-for="n in flat"
          :key="n.id"
          class="flex items-center gap-2 py-2 pr-2"
          :style="{ paddingLeft: `${8 + n.depth * 22}px` }"
        >
          <UIcon :name="n.children.length ? 'i-lucide-folder-tree' : 'i-lucide-folder'" class="text-primary shrink-0" />
          <div class="min-w-0">
            <div class="truncate font-medium">{{ n.name }}</div>
            <div class="text-xs text-muted">
              Сотрудников: {{ countOwn.get(n.id) ?? 0 }}
              <template v-if="n.children.length"> · с вложенными: {{ totalIn(n) }}</template>
            </div>
          </div>
          <div class="ml-auto flex shrink-0">
            <UButton class="fx-pop" icon="i-lucide-folder-plus" color="neutral" variant="ghost" size="sm" aria-label="Добавить вложенное" @click="openForm(null, n.id)" />
            <UButton class="fx-wiggle" icon="i-lucide-pencil" color="neutral" variant="ghost" size="sm" aria-label="Изменить" @click="openForm(departments.find(d => d.id === n.id)!)" />
            <UButton class="fx-shake" icon="i-lucide-trash-2" color="error" variant="ghost" size="sm" aria-label="Удалить" @click="remove(departments.find(d => d.id === n.id)!)" />
          </div>
        </li>
      </ul>
    </UCard>

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
