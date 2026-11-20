export default defineAppConfig({
  ui: {
    // Тёмная графитовая нейтраль + оранжевый акцент, синего нет
    colors: { primary: 'orange', neutral: 'neutral', info: 'neutral' },
    card: {
      slots: {
        root: 'rounded-2xl shadow-xs',
        header: 'px-4 py-3 sm:px-5',
        body: 'p-4 sm:p-5'
      }
    },
    button: {
      slots: {
        base: 'rounded-xl font-medium transition-all duration-200 ease-out hover:-translate-y-px active:translate-y-0 active:scale-[0.96]'
      },
      compoundVariants: [
        { color: 'primary', variant: 'solid', class: 'text-white dark:text-white' }
      ]
    },
    badge: { slots: { base: 'rounded-full' } },
    input: { slots: { base: 'rounded-xl dark:bg-black/25' } },
    select: { slots: { base: 'rounded-xl dark:bg-black/25' } },
    selectMenu: { slots: { base: 'rounded-xl dark:bg-black/25' } },
    modal: { slots: { content: 'rounded-2xl' } }
  }
})
