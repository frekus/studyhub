import Link from 'next/link'
import { ReactNode } from 'react'

interface EmptyStateAction {
  label: string
  href?: string
  onClick?: () => void
  variant?: 'primary' | 'secondary'
}

interface EmptyStateProps {
  icon: ReactNode
  title: string
  description: string
  actions: EmptyStateAction[]
}

export function EmptyState({ icon, title, description, actions }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-16 px-6 gap-4">
      <div className="w-12 h-12 rounded-xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-gray-400">
        {icon}
      </div>
      <div className="max-w-sm">
        <p className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-1">{title}</p>
        <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">{description}</p>
      </div>
      <div className="flex flex-wrap gap-2 justify-center mt-1">
        {actions.map((action, i) =>
          action.href ? (
            <Link
              key={i}
              href={action.href}
              className={`text-sm px-4 py-2 rounded-lg border transition-colors ${
                action.variant === 'secondary'
                  ? 'border-gray-200 dark:border-gray-700 text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-800'
                  : 'border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-800'
              }`}
            >
              {action.label}
            </Link>
          ) : (
            <button
              key={i}
              onClick={action.onClick}
              className={`text-sm px-4 py-2 rounded-lg border transition-colors ${
                action.variant === 'secondary'
                  ? 'border-gray-200 dark:border-gray-700 text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-800'
                  : 'border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-800'
              }`}
            >
              {action.label}
            </button>
          )
        )}
      </div>
    </div>
  )
}
