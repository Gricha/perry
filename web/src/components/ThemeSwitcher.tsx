import { Check } from 'lucide-react'
import { useTheme, themes, type ThemeId } from '@/hooks/useTheme'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'

export function ThemeSwitcher() {
  const { theme, setTheme } = useTheme()
  const currentTheme = themes.find((t) => t.id === theme) || themes[0]

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className="flex items-center gap-2.5 w-full rounded px-2 py-1.5 transition-colors hover:bg-accent text-left"
          aria-label="Select theme"
        >
          <div
            className="h-4 w-4 rounded-full border border-border/50 flex-shrink-0"
            style={{ background: currentTheme.preview.accent }}
          />
          <div className="flex flex-col min-w-0">
            <span className="text-sm text-foreground">Theme</span>
            <span className="text-xs text-muted-foreground truncate">{currentTheme.name}</span>
          </div>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        {themes.map((t) => (
          <DropdownMenuItem
            key={t.id}
            onClick={() => setTheme(t.id as ThemeId)}
            className={cn(
              'flex items-center gap-3 cursor-pointer',
              theme === t.id && 'bg-accent'
            )}
          >
            <div
              className="h-8 w-8 rounded border border-border/50 flex items-center justify-center flex-shrink-0"
              style={{ background: t.preview.bg }}
            >
              <div
                className="h-3 w-3 rounded-full"
                style={{ background: t.preview.accent }}
              />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium flex items-center gap-2">
                {t.name}
                {theme === t.id && (
                  <Check className="h-3.5 w-3.5 text-primary" />
                )}
              </div>
              <div className="text-xs text-muted-foreground truncate">
                {t.description}
              </div>
            </div>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
