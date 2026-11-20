<script setup lang="ts">
import type { Vacation } from '#shared/types'
import { STATUS_LABELS } from '#shared/types'

const route = useRoute()
const toast = useToast()
const { employeeById, departments, vacationsByEmployee, refresh } = useSchedule()

const id = computed(() => Number(route.params.id))
const employee = computed(() => employeeById.value.get(id.value) ?? null)
const list = computed(() =>
  [...(vacationsByEmployee.value.get(id.value) ?? [])].sort((a, b) => a.startDate.localeCompare(b.startDate))
)
const totalDays = computed(() => list.value.reduce((s, v) => s + daysInclusive(v.startDate, v.endDate), 0))

const formOpen = ref(false)
const vacOpen = ref(false)
const editingVac = ref<Vacation | null>(null)
function openVac(v: Vacation | null) {
  editingVac.value = v
  vacOpen.value = true
}

async function removeVac(v: Vacation) {
  try {
    await $fetch(`/api/vacations/${v.id}`, { method: 'DELETE' })
    toast.add({ title: 'Период удалён', color: 'success' })
    await refresh()
  } catch (e) {
    toast.add({ title: 'Не удалось удалить', description: errorMessage(e), color: 'error' })
  }
}
</script>

<template>
  <div class="max-w-4xl mx-auto space-y-4">
    <UButton to="/employees" icon="i-lucide-arrow-left" color="neutral" variant="link" class="px-0 fx-nudge-l">К списку сотрудников</UButton>

    <UCard v-if="!employee">
      <p class="text-muted">Сотрудник не найден.</p>
    </UCard>

    <template v-else>
      <UCard>
        <div class="flex flex-wrap items-start gap-4">
          <UAvatar :alt="employee.fullName" size="3xl" />
          <div class="min-w-0">
            <h1 class="text-xl font-semibold">{{ employee.fullName }}</h1>
            <p class="text-muted">{{ employee.position }}</p>
            <p class="text-sm mt-1">{{ pathOf(departments, employee.departmentId) }}</p>
          </div>
          <div class="ml-auto flex gap-2">
            <UButton class="fx-pop" icon="i-lucide-calendar-days" color="neutral" variant="outline" :to="`/calendar?employee=${employee.id}`">Календарь</UButton>
            <UButton class="fx-wiggle" icon="i-lucide-pencil" color="neutral" variant="outline" @click="formOpen = true">Изменить</UButton>
          </div>
        </div>
      </UCard>

      <UCard>
        <template #header>
          <div class="flex items-center gap-3">
            <div>
              <h2 class="font-semibold">Запланированные отпуска</h2>
              <p class="text-xs text-muted">Всего периодов: {{ list.length }} · дней: {{ totalDays }}</p>
            </div>
            <UButton class="ml-auto fx-rot90" icon="i-lucide-plus" @click="openVac(null)">Добавить период</UButton>
          </div>
        </template>

        <p v-if="!list.length" class="py-6 text-center text-muted">Отпуска не запланированы</p>
        <ul v-else class="divide-y divide-default">
          <li v-for="v in list" :key="v.id" class="py-3 flex flex-wrap items-center gap-3">
            <div>
              <div class="font-medium">{{ formatRange(v.startDate, v.endDate) }}</div>
              <div class="text-xs text-muted">
                {{ daysInclusive(v.startDate, v.endDate) }} {{ plural(daysInclusive(v.startDate, v.endDate), ['день', 'дня', 'дней']) }}
                <template v-if="v.note"> · {{ v.note }}</template>
              </div>
            </div>
            <UBadge :color="STATUS_COLORS[v.status].badge" variant="subtle" class="ml-auto">{{ STATUS_LABELS[v.status] }}</UBadge>
            <UButton class="fx-wiggle" icon="i-lucide-pencil" color="neutral" variant="ghost" size="sm" aria-label="Изменить" @click="openVac(v)" />
            <UButton class="fx-shake" icon="i-lucide-trash-2" color="error" variant="ghost" size="sm" aria-label="Удалить" @click="removeVac(v)" />
          </li>
        </ul>
      </UCard>

      <EmployeeFormModal v-model:open="formOpen" :employee="employee" @saved="refresh()" />
      <VacationFormModal v-model:open="vacOpen" :vacation="editingVac" :employee-id="employee.id" @saved="refresh()" />
    </template>
  </div>
</template>
