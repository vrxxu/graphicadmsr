export default defineAppConfig({
  ui: {
    colors: { primary: 'emerald', neutral: 'zinc' },
    card: {
      slots: {
        root: 'rounded-xl shadow-none',
        header: 'px-4 py-3 sm:px-4',
        body: 'p-4 sm:p-4'
      }
    },
    modal: {
      slots: {
        content: 'rounded-xl'
      }
    },
    button: {
      defaultVariants: { size: 'md' }
    }
  }
})
