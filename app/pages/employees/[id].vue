<script setup lang="ts">
import type { Vacation } from '#shared/types'
import { STATUS_LABELS } from '#shared/types'

const route = useRoute()
const toast = useToast()
const { employees, employeeById, departments, vacationsByEmployee, partnersByEmployee, conflictOverlaps, refresh } = useSchedule()

const id = computed(() => Number(route.params.id))
const employee = computed(() => employeeById.value.get(id.value) ?? null)
const list = computed(() =>
  [...(vacationsByEmployee.value.get(id.value) ?? [])].sort((a, b) => a.startDate.localeCompare(b.startDate))
)
const totalDays = computed(() => list.value.reduce((s, v) => s + daysInclusive(v.startDate, v.endDate), 0))

// ---------- «не может отсутствовать одновременно с» ----------
const partnerIds = computed(() => partnersByEmployee.value.get(id.value) ?? [])
const partnerItems = computed(() => {
  const deptName = new Map(departments.value.map(d => [d.id, d.name]))
  return employees.value
    .filter(e => e.id !== id.value)
    .map(e => ({ label: `${e.fullName} — ${deptName.get(e.departmentId) ?? ''}`, value: e.id }))
})
const partnerModel = computed({
  get: () => partnerIds.value,
  set: (v: number[]) => { saveConflicts(v) }
})
async function saveConflicts(ids: number[]) {
  try {
    await $fetch(`/api/employees/${id.value}/conflicts`, { method: 'PUT', body: { employeeIds: ids } })
    await refresh()
    toast.add({ title: 'Ограничения сохранены', color: 'success' })
  } catch (e) {
    toast.add({ title: 'Не удалось сохранить', description: errorMessage(e), color: 'error' })
  }
}
function removePartner(pid: number) {
  saveConflicts(partnerIds.value.filter(x => x !== pid))
}
const violations = computed(() =>
  conflictOverlaps.value
    .filter(c => c.employeeId === id.value || c.otherId === id.value)
    .map(c => ({
      name: employeeById.value.get(c.employeeId === id.value ? c.otherId : c.employeeId)?.fullName ?? '—',
      start: isoFromDayNum(c.s),
      end: isoFromDayNum(c.e)
    }))
)

const stats = computed(() => ({ periods: list.value.length, days: totalDays.value, partners: partnerIds.value.length, violations: violations.value.length }))

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
  <div class="space-y-4">
    <UButton to="/employees" icon="i-lucide-arrow-left" color="neutral" variant="link" class="px-0">К списку сотрудников</UButton>

    <section v-if="!employee" class="rounded-2xl border border-default bg-default px-4 py-10 text-center text-sm text-muted">
      Сотрудник не найден.
    </section>

    <template v-else>
      <!-- профиль -->
      <div class="flex flex-wrap items-center gap-4 rounded-2xl border border-default bg-default p-4">
        <PersonAvatar :name="employee.fullName" size="lg" />
        <div class="min-w-0">
          <h1 class="text-lg font-semibold">{{ employee.fullName }}</h1>
          <p class="text-sm text-muted">{{ employee.position }}</p>
          <p class="mt-0.5 text-xs text-muted">{{ pathOf(departments, employee.departmentId) }}</p>
        </div>
        <div class="ml-auto flex items-center gap-2">
          <UButton icon="i-lucide-calendar-days" color="neutral" variant="outline" :to="`/calendar?employee=${employee.id}`">Календарь</UButton>
          <UButton icon="i-lucide-pencil" color="neutral" variant="outline" @click="formOpen = true">Изменить</UButton>
        </div>
      </div>

      <!-- сводка -->
      <div class="grid grid-cols-2 gap-2.5 md:grid-cols-4">
        <div class="rounded-xl border border-default bg-default px-3.5 py-2.5">
          <div class="text-xs text-muted">Периодов отпуска</div>
          <div class="mt-0.5 text-xl font-semibold tabular-nums">{{ stats.periods }}</div>
        </div>
        <div class="rounded-xl border border-default bg-default px-3.5 py-2.5">
          <div class="text-xs text-muted">Дней отпуска</div>
          <div class="mt-0.5 text-xl font-semibold tabular-nums">{{ stats.days }}</div>
        </div>
        <div class="rounded-xl border border-default bg-default px-3.5 py-2.5">
          <div class="text-xs text-muted">Ограничений</div>
          <div class="mt-0.5 text-xl font-semibold tabular-nums">{{ stats.partners }}</div>
        </div>
        <div class="rounded-xl border border-default bg-default px-3.5 py-2.5">
          <div class="flex items-center gap-1.5 text-xs text-muted"><span v-if="stats.violations" class="size-1.5 rounded-full bg-red-500" />Нарушений</div>
          <div class="mt-0.5 text-xl font-semibold tabular-nums" :class="stats.violations ? 'text-red-600 dark:text-red-400' : ''">{{ stats.violations }}</div>
        </div>
      </div>

      <div class="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_24rem]">
        <!-- отпуска -->
        <section class="overflow-hidden rounded-2xl border border-default bg-default">
          <div class="flex items-center gap-3 border-b border-default px-4 py-3">
            <div>
              <h2 class="text-sm font-semibold">Запланированные отпуска</h2>
              <p class="text-xs text-muted">Всего периодов: {{ list.length }} · дней: {{ totalDays }}</p>
            </div>
            <UButton class="ml-auto" icon="i-lucide-plus" @click="openVac(null)">Добавить период</UButton>
          </div>

          <p v-if="!list.length" class="px-4 py-10 text-center text-sm text-muted">Отпуска не запланированы</p>
          <ul v-else class="divide-y divide-default">
            <li v-for="v in list" :key="v.id" class="group flex flex-wrap items-center gap-3 px-4 py-3 transition-colors hover:bg-elevated/60">
              <div>
                <div class="text-sm font-medium tabular-nums">{{ formatRange(v.startDate, v.endDate) }}</div>
                <div class="text-xs text-muted">
                  {{ daysInclusive(v.startDate, v.endDate) }} {{ plural(daysInclusive(v.startDate, v.endDate), ['день', 'дня', 'дней']) }}
                  <template v-if="v.note"> · {{ v.note }}</template>
                </div>
              </div>
              <UBadge :color="STATUS_COLORS[v.status].badge" variant="subtle" class="ml-auto">{{ STATUS_LABELS[v.status] }}</UBadge>
              <div class="flex gap-1 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100 pointer-coarse:opacity-100">
                <UButton icon="i-lucide-pencil" color="neutral" variant="ghost" size="sm" aria-label="Изменить" @click="openVac(v)" />
                <UButton icon="i-lucide-trash-2" color="error" variant="ghost" size="sm" aria-label="Удалить" @click="removeVac(v)" />
              </div>
            </li>
          </ul>
        </section>

        <!-- ограничения -->
        <section class="overflow-hidden rounded-2xl border border-default bg-default">
          <div class="border-b border-default px-4 py-3">
            <h2 class="text-sm font-semibold">Не может отсутствовать одновременно с</h2>
            <p class="text-xs text-muted">Если отпуска пересекутся, на графике эти дни будут выделены красным</p>
          </div>

          <div class="space-y-3 p-4">
            <USelectMenu
              v-model="partnerModel"
              :items="partnerItems"
              value-key="value"
              multiple
              placeholder="Добавить сотрудника"
              class="w-full"
            />
            <div v-if="partnerIds.length" class="flex flex-wrap gap-2">
              <UBadge v-for="pid in partnerIds" :key="pid" color="neutral" variant="subtle" size="lg" class="gap-1 pr-1">
                {{ employeeById.get(pid)?.fullName }}
                <UButton icon="i-lucide-x" color="neutral" variant="link" size="xs" :aria-label="`Убрать ${employeeById.get(pid)?.fullName}`" @click="removePartner(pid)" />
              </UBadge>
            </div>
            <p v-else class="text-sm text-muted">Ограничений нет</p>

            <UAlert
              v-if="violations.length"
              color="error"
              variant="subtle"
              icon="i-lucide-ban"
              title="Отпуска пересекаются"
            >
              <template #description>
                <div v-for="(v, i) in violations" :key="i">{{ v.name }}: {{ formatRange(v.start, v.end) }}</div>
              </template>
            </UAlert>
          </div>
        </section>
      </div>

      <EmployeeFormModal v-model:open="formOpen" :employee="employee" @saved="refresh()" />
      <VacationFormModal v-model:open="vacOpen" :vacation="editingVac" :employee-id="employee.id" @saved="refresh()" />
    </template>
  </div>
</template>
