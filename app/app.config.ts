export default defineAppConfig({
  ui: {
    colors: { primary: 'emerald', neutral: 'zinc' },
    card: {
      slots: {
        root: 'rounded-2xl shadow-none overflow-hidden',
        header: 'px-4 py-2.5 sm:px-4',
        body: 'p-3 sm:p-3'
      }
    },
    modal: {
      slots: {
        content: 'rounded-2xl'
      }
    },
    table: {
      slots: {
        base: 'border-separate border-spacing-0',
        thead: '[&>tr]:bg-transparent',
        th: 'h-9 border-b border-default px-4 py-0 text-xs font-medium text-muted',
        tbody: '[&>tr]:transition-colors [&>tr:hover]:bg-elevated/60',
        td: 'border-b border-default/60 px-4 py-2.5 text-[13px]'
      }
    },
    button: { defaultVariants: { size: 'sm' } },
    input: { defaultVariants: { size: 'sm' } },
    select: { defaultVariants: { size: 'sm' } },
    selectMenu: { defaultVariants: { size: 'sm' } },
    inputNumber: { defaultVariants: { size: 'sm' } },
    textarea: { defaultVariants: { size: 'sm' } }
  }
})
