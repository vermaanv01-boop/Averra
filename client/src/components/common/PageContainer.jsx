import { cn } from '../../utils/cn.js'

const sizes = {
  default: 'max-w-6xl',
  narrow: 'max-w-2xl',
  medium: 'max-w-4xl'
}

export default function PageContainer({
  as: Component = 'div',
  size = 'default',
  className,
  children,
  ...props
}) {
  return (
    <Component
      {...props}
      className={cn('mx-auto w-full px-5 sm:px-8', sizes[size] || sizes.default, className)}
    >
      {children}
    </Component>
  )
}
