<script setup lang="ts">
/**
 * Печать графика отпусков по унифицированной форме Т-7 (альбомный А4).
 * Данные берутся из приложения, реквизиты (подписанты, номер документа и т.п.)
 * правятся на странице и запоминаются в браузере.
 */
const route = useRoute()
const { employees, vacations, tree, vacationsByEmployee, status } = useSchedule()

// ---------- год ----------
const currentYear = Number(todayIso().slice(0, 4))
const yearPicked = ref<number | null>(route.query.year ? Number(route.query.year) : null)

/** по умолчанию — год, в котором больше всего отпусков */
const defaultYear = computed(() => {
  const counts = new Map<number, number>()
  for (const v of vacations.value) {
    const y = Number(v.startDate.slice(0, 4))
    counts.set(y, (counts.get(y) ?? 0) + 1)
  }
  let best = currentYear
  let max = 0
  for (const [y, c] of counts) {
    if (c > max) { best = y; max = c }
  }
  return best
})
const year = computed({
  get: () => yearPicked.value ?? defaultYear.value,
  set: (v: number) => { yearPicked.value = v }
})
const yearItems = computed(() => {
  const set = new Set<number>([currentYear, currentYear + 1, defaultYear.value])
  for (const v of vacations.value) set.add(Number(v.startDate.slice(0, 4)))
  return [...set].sort().map(y => ({ label: String(y), value: y }))
})

// ---------- фильтры ----------
const deptFilter = ref<number | null>(Number(route.query.dept) || null)
const withNested = ref(true)
const deptItems = computed(() =>
  flatten(tree.value).map(n => ({ label: `${'— '.repeat(n.depth)}${n.name}`, value: n.id }))
)
const skipMoved = ref(false)

// ---------- реквизиты документа ----------
const DEFAULTS = {
  org: 'Администрация Сургутского района',
  okpo: '',
  docNumber: '',
  docDate: '',
  agreePost: 'Первый заместитель главы Сургутского района',
  agreeName: 'Р.Ф. Марценковский',
  approvePost: 'Глава Сургутского района',
  approveName: 'А.А. Трубецкой',
  headLabel: 'Руководитель отраслевого (функционального) органа',
  headPost: 'Начальник управления',
  headName: '',
  hrPost: '',
  hrName: '',
  execName: '',
  execPhone: ''
}
const req = reactive({ ...DEFAULTS })
const STORAGE_KEY = 't7-requisites-v1'
const loaded = ref(false)

onMounted(() => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) Object.assign(req, JSON.parse(raw))
  } catch { /* повреждённые данные — используем значения по умолчанию */ }
  loaded.value = true
})
watch(req, () => {
  if (!loaded.value) return
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(req)) } catch { /* хранилище недоступно */ }
}, { deep: true })

function resetRequisites() {
  Object.assign(req, DEFAULTS)
}

// ---------- строки таблицы ----------
/** «Начальник управления» → «начальник управления» (как в форме), аббревиатуры не трогаем */
function lowerFirst(s: string) {
  return /^[А-ЯЁ][а-яё]/.test(s) ? s[0]!.toLowerCase() + s.slice(1) : s
}

interface T7Row {
  key: number
  employeeId: number
  dept: string
  position: string
  fullName: string
  tab: string
  days: number
  planned: string
}

const rows = computed<T7Row[]>(() => {
  // печатается только выбранное подразделение
  const picked = deptFilter.value ? findNode(tree.value, deptFilter.value) : null
  if (!picked) return []
  const ids = new Set(withNested.value ? subtreeIds(picked) : [picked.id])
  const byDept = new Map<number, typeof employees.value>()
  for (const e of employees.value) {
    const list = byDept.get(e.departmentId)
    if (list) list.push(e)
    else byDept.set(e.departmentId, [e])
  }

  const out: T7Row[] = []
  for (const node of flatten(tree.value)) {
    if (!ids.has(node.id)) continue
    const emps = [...(byDept.get(node.id) ?? [])].sort((a, b) => a.fullName.localeCompare(b.fullName, 'ru'))
    let first = true
    for (const e of emps) {
      const vs = (vacationsByEmployee.value.get(e.id) ?? [])
        .filter(v => v.startDate.startsWith(`${year.value}-`) && !(skipMoved.value && v.status === 'moved'))
        .sort((a, b) => a.startDate.localeCompare(b.startDate))
      for (const v of vs) {
        out.push({
          key: v.id,
          employeeId: e.id,
          dept: first ? node.name : '',
          position: lowerFirst(e.position),
          fullName: e.fullName,
          tab: e.tabNumber,
          days: daysInclusive(v.startDate, v.endDate),
          planned: formatDate(v.startDate)
        })
        first = false
      }
    }
  }
  return out
})

const peopleCount = computed(() => new Set(rows.value.map(r => r.employeeId)).size)
const withoutTab = computed(() => {
  const ids = new Set(rows.value.filter(r => !r.tab).map(r => r.employeeId))
  return ids.size
})

const deptName = computed(() => (deptFilter.value ? findNode(tree.value, deptFilter.value)?.name : null))
const hasNested = computed(() => !!deptFilter.value && !!findNode(tree.value, deptFilter.value)?.children.length)

useHead({ title: computed(() => `График отпусков ${year.value}${deptName.value ? ` — ${deptName.value}` : ''}`) })

function printSheet() {
  window.print()
}
</script>

<template>
  <div class="space-y-4">
    <div class="print:hidden! space-y-4">
      <!-- заголовок -->
      <div class="flex flex-wrap items-end gap-x-4 gap-y-1">
        <div class="min-w-0">
          <h1 class="text-lg font-semibold truncate">Печать графика отпусков</h1>
          <p class="text-sm text-muted truncate">Форма № Т-7 · {{ deptName ?? 'выберите подразделение' }}</p>
        </div>
        <div class="ml-auto flex items-center gap-2">
          <UButton icon="i-lucide-printer" :disabled="!deptFilter || !rows.length" @click="printSheet">Печать</UButton>
        </div>
      </div>

      <!-- панель настроек -->
      <div class="flex flex-wrap items-center gap-2 rounded-2xl border border-default bg-default p-2">
        <USelect v-model="year" :items="yearItems" class="w-28" aria-label="Год графика" />
        <USelectMenu v-model="deptFilter" :items="deptItems" value-key="value" icon="i-lucide-network" placeholder="Выберите подразделение" class="w-full sm:w-96" aria-label="Подразделение для печати" />
        <USwitch v-if="hasNested" v-model="withNested" label="Включая вложенные" class="px-2" />
        <USwitch v-model="skipMoved" label="Без перенесённых" class="px-2" />
        <span v-if="deptFilter" class="ml-auto px-2 text-sm text-muted tabular-nums">Строк: {{ rows.length }} · сотрудников: {{ peopleCount }}</span>
      </div>

      <UAlert
        v-if="withoutTab"
        color="warning"
        variant="subtle"
        icon="i-lucide-triangle-alert"
        :title="`У сотрудников без табельного номера: ${withoutTab}`"
        description="В колонке «Табельный номер» у них будет пусто. Номера можно указать в карточке сотрудника или в разделе «Сотрудники»."
      >
        <template #actions>
          <UButton to="/employees" color="warning" variant="outline" size="xs">К сотрудникам</UButton>
        </template>
      </UAlert>

      <!-- реквизиты -->
      <details class="group rounded-2xl border border-default bg-default">
        <summary class="flex cursor-pointer list-none items-center gap-2 px-4 py-3 text-sm font-semibold">
          <UIcon name="i-lucide-chevron-right" class="size-4 text-muted transition-transform group-open:rotate-90" />
          Реквизиты документа
          <span class="ml-1 text-xs font-normal text-muted">подписанты, номер, дата — запоминаются в этом браузере</span>
        </summary>
        <div class="space-y-4 border-t border-default p-4">
          <div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <UFormField label="Организация"><UInput v-model="req.org" class="w-full" /></UFormField>
            <UFormField label="Номер документа"><UInput v-model="req.docNumber" class="w-full" /></UFormField>
            <UFormField label="Дата составления"><UInput v-model="req.docDate" placeholder="ДД.ММ.ГГГГ" class="w-full" /></UFormField>
            <UFormField label="Код по ОКПО"><UInput v-model="req.okpo" class="w-full" /></UFormField>

            <UFormField label="«Согласовано»: должность"><UInput v-model="req.agreePost" class="w-full" /></UFormField>
            <UFormField label="«Согласовано»: ФИО"><UInput v-model="req.agreeName" class="w-full" /></UFormField>
            <UFormField label="«Утверждаю»: должность"><UInput v-model="req.approvePost" class="w-full" /></UFormField>
            <UFormField label="«Утверждаю»: ФИО"><UInput v-model="req.approveName" class="w-full" /></UFormField>

            <UFormField label="Руководитель органа: подпись"><UInput v-model="req.headLabel" class="w-full" /></UFormField>
            <UFormField label="Руководитель органа: должность"><UInput v-model="req.headPost" class="w-full" /></UFormField>
            <UFormField label="Руководитель органа: ФИО"><UInput v-model="req.headName" class="w-full" /></UFormField>
            <div />

            <UFormField label="Руководитель кадровой службы: должность"><UInput v-model="req.hrPost" class="w-full" /></UFormField>
            <UFormField label="Руководитель кадровой службы: ФИО"><UInput v-model="req.hrName" class="w-full" /></UFormField>
            <UFormField label="Исполнитель: ФИО"><UInput v-model="req.execName" class="w-full" /></UFormField>
            <UFormField label="Исполнитель: телефон"><UInput v-model="req.execPhone" class="w-full" /></UFormField>
          </div>
          <UButton icon="i-lucide-rotate-ccw" color="neutral" variant="ghost" size="sm" @click="resetRequisites">Вернуть значения по умолчанию</UButton>
        </div>
      </details>

      <p class="text-xs text-muted">
        В диалоге печати выберите «Альбомная» ориентацию и размер А4, поля — «По умолчанию». Чтобы получить PDF, выберите «Сохранить как PDF».
      </p>
    </div>

    <div v-if="status === 'pending' && !employees.length" class="py-24 text-center text-muted print:hidden!">Загрузка данных…</div>

    <div v-else-if="!deptFilter" class="rounded-2xl border border-dashed border-default py-20 text-center print:hidden!">
      <UIcon name="i-lucide-printer" class="mx-auto size-8 text-muted" />
      <p class="mt-3 text-sm font-medium">Выберите подразделение</p>
      <p class="mt-1 text-sm text-muted">График отпусков печатается по одному подразделению.</p>
    </div>

    <!-- лист -->
    <div v-else class="t7-stage">
      <div class="t7-paper">
        <div class="t7">
          <!-- организация и коды -->
          <div class="t7-top">
            <div class="t7-org">
              <div class="t7-org-name">{{ req.org }}</div>
              <div class="t7-cap">(наименование организации)</div>
            </div>
            <table class="t7-codes">
              <tbody>
                <tr><td class="lbl" /><td class="val">Код</td></tr>
                <tr><td class="lbl">Форма по ОКУД</td><td class="val">0301020</td></tr>
                <tr><td class="lbl">по ОКПО</td><td class="val">{{ req.okpo }}&nbsp;</td></tr>
              </tbody>
            </table>
          </div>

          <!-- согласовано / утверждаю -->
          <div class="t7-heads">
            <div class="t7-agree">
              <div>СОГЛАСОВАНО:</div>
              <div>{{ req.agreePost }}</div>
              <div>{{ req.agreeName }}</div>
              <div class="t7-sigline" />
              <div class="t7-union">Мнение выборного профсоюзного органа</div>
              <div class="t7-small">от «____» ______________ 20____ г. № __________ учтено</div>
            </div>

            <div class="t7-approve">
              <div class="t7-approve-title">УТВЕРЖДАЮ</div>
              <div class="t7-under">{{ req.approvePost }}&nbsp;</div>
              <div class="t7-cap">(должность)</div>
              <div class="t7-approve-sign">
                <div class="t7-sigcol"><div class="t7-under">&nbsp;</div><div class="t7-cap">(личная подпись)</div></div>
                <div class="t7-sigcol grow"><div class="t7-under">{{ req.approveName }}&nbsp;</div><div class="t7-cap">(расшифровка подписи)</div></div>
              </div>
              <div class="t7-small">«____» ______________ 20____ г.</div>
            </div>
          </div>

          <!-- название и реквизиты документа -->
          <div class="t7-title-row">
            <div class="t7-title">ГРАФИК ОТПУСКОВ</div>
            <table class="t7-doc">
              <thead>
                <tr><th>Номер документа</th><th>Дата составления</th><th>На год</th></tr>
              </thead>
              <tbody>
                <tr><td>{{ req.docNumber }}&nbsp;</td><td>{{ req.docDate }}</td><td class="year">{{ year }}</td></tr>
              </tbody>
            </table>
          </div>

          <!-- таблица -->
          <table class="t7-table">
            <colgroup>
              <col style="width: 9%">
              <col style="width: 15%">
              <col style="width: 19%">
              <col style="width: 6%">
              <col style="width: 7.5%">
              <col style="width: 9%">
              <col style="width: 8%">
              <col style="width: 8%">
              <col style="width: 9.5%">
              <col style="width: 9%">
            </colgroup>
            <thead>
              <tr>
                <th rowspan="3">Структурное подразделение</th>
                <th rowspan="3">Должность (специальность, профессия) по штатному расписанию</th>
                <th rowspan="3">Фамилия, имя, отчество</th>
                <th rowspan="3">Табельный номер</th>
                <th colspan="5">ОТПУСК</th>
                <th rowspan="3">Подпись работника</th>
              </tr>
              <tr>
                <th rowspan="2">количество календарных дней</th>
                <th colspan="2">дата</th>
                <th colspan="2">перенесение отпуска</th>
              </tr>
              <tr>
                <th>запланированная</th>
                <th>фактическая</th>
                <th>основание (документ)</th>
                <th>дата предполагаемого отпуска</th>
              </tr>
              <tr class="nums">
                <th v-for="n in 10" :key="n">{{ n }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="r in rows" :key="r.key">
                <td class="dept">{{ r.dept }}</td>
                <td>{{ r.position }}</td>
                <td>{{ r.fullName }}</td>
                <td class="c">{{ r.tab }}</td>
                <td class="c">{{ r.days }}</td>
                <td class="c">{{ r.planned }}</td>
                <td /><td /><td /><td />
              </tr>
              <tr v-if="!rows.length">
                <td colspan="10" class="empty">Нет отпусков за {{ year }} год по выбранным условиям</td>
              </tr>
            </tbody>
          </table>

          <!-- подписи -->
          <table class="t7-sigs">
            <colgroup>
              <col style="width: 32%"><col style="width: 24%"><col style="width: 2%"><col style="width: 14%"><col style="width: 2%"><col style="width: 26%">
            </colgroup>
            <tbody>
              <tr>
                <td class="lbl" rowspan="2">{{ req.headLabel }}</td>
                <td class="u">{{ req.headPost }}&nbsp;</td><td />
                <td class="u">&nbsp;</td><td />
                <td class="u">{{ req.headName }}&nbsp;</td>
              </tr>
              <tr class="cap">
                <td>(должность)</td><td />
                <td>(личная подпись)</td><td />
                <td>(расшифровка подписи)</td>
              </tr>
              <tr class="gap"><td colspan="6" /></tr>
              <tr>
                <td class="lbl" rowspan="2">Руководитель кадровой службы</td>
                <td class="u">{{ req.hrPost }}&nbsp;</td><td />
                <td class="u">&nbsp;</td><td />
                <td class="u">{{ req.hrName }}&nbsp;</td>
              </tr>
              <tr class="cap">
                <td>(должность)</td><td />
                <td>(личная подпись)</td><td />
                <td>(расшифровка подписи)</td>
              </tr>
            </tbody>
          </table>

          <div class="t7-exec">
            <div>Исполнитель:</div>
            <div>{{ req.execName || 'ФИО' }}</div>
            <div>{{ req.execPhone || 'телефон' }}</div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style>
/* ───────── предпросмотр листа на экране ───────── */
.t7-stage {
  overflow: auto;
  padding: 16px;
  border-radius: 16px;
  border: 1px solid var(--ui-border);
  background: color-mix(in oklab, var(--ui-bg-elevated) 50%, transparent);
}

.t7-paper {
  page: t7;
  box-sizing: border-box;
  width: 297mm;
  min-height: 210mm;
  margin: 0 auto;
  padding: 10mm;
  background: #fff;
  color: #000;
  box-shadow: 0 1px 3px rgb(0 0 0 / 0.15), 0 12px 28px -10px rgb(0 0 0 / 0.35);
}

@page t7 {
  size: A4 landscape;
  margin: 10mm;
}

/* ───────── содержимое формы ───────── */
.t7, .t7 * { box-sizing: border-box; }
.t7 {
  font-family: 'Times New Roman', Times, 'Liberation Serif', serif;
  font-size: 10pt;
  line-height: 1.2;
  color: #000;
}
.t7 table { border-collapse: collapse; }
.t7 th { font-weight: 400; }

.t7-cap { font-size: 7pt; text-align: center; line-height: 1.1; }
.t7-small { font-size: 7.5pt; margin-top: 2px; }
.t7-under { border-bottom: 1px solid #000; text-align: center; padding: 0 2px; min-height: 1.25em; }

/* верх: организация + коды */
.t7-top { display: flex; align-items: flex-end; gap: 14px; }
.t7-org { flex: 1; }
.t7-org-name { text-align: center; font-weight: 700; border-bottom: 1px solid #000; padding-bottom: 1px; min-height: 1.3em; }
.t7-codes { font-size: 8pt; flex-shrink: 0; }
.t7-codes td { padding: 1px 4px; }
.t7-codes .lbl { text-align: right; border: 0; white-space: nowrap; }
.t7-codes .val { border: 1px solid #000; text-align: center; width: 30mm; }

/* согласовано / утверждаю */
.t7-heads { display: grid; grid-template-columns: 1fr 1fr; gap: 12mm; margin-top: 8px; align-items: start; }
.t7-agree { max-width: 125mm; }
.t7-sigline { border-bottom: 1px solid #000; width: 70mm; height: 7mm; margin-bottom: 6px; }
.t7-union { margin-top: 4px; }
.t7-approve { max-width: 105mm; margin-left: auto; }
.t7-approve-title { text-align: center; margin-bottom: 2px; }
.t7-approve-sign { display: flex; gap: 6px; margin-top: 8px; }
.t7-sigcol { width: 30mm; }
.t7-sigcol.grow { flex: 1; width: auto; }

/* название */
.t7-title-row { display: flex; align-items: flex-end; justify-content: center; gap: 6px; margin: 6px 0 8px; }
.t7-title { font-size: 12pt; padding-bottom: 2px; }
.t7-doc th, .t7-doc td { border: 1px solid #000; padding: 1px 6px; text-align: center; font-size: 9pt; }
.t7-doc td { height: 6mm; min-width: 28mm; }
.t7-doc td.year { font-size: 11pt; }

/* основная таблица */
.t7-table { width: 100%; table-layout: fixed; font-size: 9pt; }
.t7-table th, .t7-table td {
  border: 1px solid #000;
  padding: 1px 3px;
  vertical-align: middle;
  overflow-wrap: anywhere;
}
.t7-table thead th { text-align: center; line-height: 1.15; font-size: 8.5pt; overflow-wrap: normal; padding: 1px 2px; }
.t7-table thead { display: table-header-group; }
.t7-table tr.nums th { font-weight: 700; font-size: 8.5pt; }
.t7-table tbody tr { break-inside: avoid; page-break-inside: avoid; }
.t7-table td.c { text-align: center; }
.t7-table td.dept { font-size: 8.5pt; }
.t7-table td.empty { text-align: center; padding: 14px; color: #555; }

/* подписи */
.t7-sigs { width: 100%; table-layout: fixed; margin-top: 8px; break-inside: avoid; page-break-inside: avoid; }
.t7-sigs td { padding: 0 3px; vertical-align: bottom; }
.t7-sigs .lbl { font-size: 8.5pt; vertical-align: top; padding-left: 0; }
.t7-sigs .u { border-bottom: 1px solid #000; text-align: center; }
.t7-sigs tr.cap td { font-size: 7pt; text-align: center; }
.t7-sigs tr.gap td { height: 6px; }
.t7-exec { margin-top: 10px; font-size: 7.5pt; line-height: 1.25; break-inside: avoid; }

/* ───────── печать ───────── */
@media print {
  html, body { background: #fff !important; }
  .t7-stage {
    overflow: visible;
    padding: 0;
    border: 0;
    border-radius: 0;
    background: none;
  }
  .t7-paper {
    width: auto;
    min-height: 0;
    margin: 0;
    padding: 0;
    box-shadow: none;
  }
  .t7-table, .t7-doc th, .t7-doc td, .t7-codes .val { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
}
</style>
