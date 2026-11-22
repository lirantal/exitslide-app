import { cva, type VariantProps } from 'class-variance-authority'
import type { ComponentProps } from 'react'

export const buttonVariants = cva(
  'inline-flex min-h-11 items-center justify-center rounded-md border px-4 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring disabled:opacity-60 motion-reduce:transition-none',
  {
    variants: {
      variant: {
        default: 'border-primary bg-primary text-primary-foreground hover:bg-primary/85',
        outline: 'border-border bg-background hover:bg-accent',
      },
    },
    defaultVariants: { variant: 'default' },
  },
)

export function Button({
  variant,
  className,
  ...props
}: ComponentProps<'button'> & VariantProps<typeof buttonVariants>) {
  return <button data-slot="button" className={buttonVariants({ variant, className })} {...props} />
}
