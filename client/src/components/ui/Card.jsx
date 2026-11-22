import { cn } from '../../utils/cn.js'

export function Card({ className, children, ...props }) {
  return (
    <section
      {...props}
      className={cn('rounded-card border border-ink-200/80 bg-white shadow-soft', className)}
    >
      {children}
    </section>
  )
}

export function CardHeader({ className, children, ...props }) {
  return (
    <header {...props} className={cn('border-b border-ink-100 px-5 py-4', className)}>
      {children}
    </header>
  )
}

export function CardTitle({ className, children, ...props }) {
  return (
    <h3 {...props} className={cn('text-lg text-ink-900', className)}>
      {children}
    </h3>
  )
}

export function CardDescription({ className, children, ...props }) {
  return (
    <p {...props} className={cn('mt-1 text-sm leading-6 text-ink-600', className)}>
      {children}
    </p>
  )
}

export function CardContent({ className, children, ...props }) {
  return (
    <div {...props} className={cn('px-5 py-5', className)}>
      {children}
    </div>
  )
}

export function CardFooter({ className, children, ...props }) {
  return (
    <footer {...props} className={cn('border-t border-ink-100 px-5 py-4', className)}>
      {children}
    </footer>
  )
}
