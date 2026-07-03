/**
 * Design System Utilities
 * Helper functions cho việc sử dụng design tokens
 */

/**
 * Get CSS variable value
 */
export function getCSSVariable(variable: string): string {
  if (typeof window === 'undefined') return ''
  return getComputedStyle(document.documentElement).getPropertyValue(variable).trim()
}

/**
 * Set CSS variable value
 */
export function setCSSVariable(variable: string, value: string): void {
  if (typeof window === 'undefined') return
  document.documentElement.style.setProperty(variable, value)
}

/**
 * Check if user prefers reduced motion
 */
export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return false
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

/**
 * Check if user prefers dark mode
 */
export function prefersDarkMode(): boolean {
  if (typeof window === 'undefined') return false
  return window.matchMedia('(prefers-color-scheme: dark)').matches
}

/**
 * Check if user prefers high contrast
 */
export function prefersHighContrast(): boolean {
  if (typeof window === 'undefined') return false
  return window.matchMedia('(prefers-contrast: high)').matches
}

/**
 * Get transition duration based on motion preference
 */
export function getTransitionDuration(duration: 'fast' | 'base' | 'slow' | 'slower' = 'base'): string {
  if (prefersReducedMotion()) {
    return '0.01ms'
  }
  
  const durations = {
    fast: getCSSVariable('--transition-fast'),
    base: getCSSVariable('--transition-base'),
    slow: getCSSVariable('--transition-slow'),
    slower: getCSSVariable('--transition-slower'),
  }
  
  return durations[duration] || durations.base
}

/**
 * Focus ring utility class generator
 */
export function focusRing(color: 'primary' | 'danger' | 'success' = 'primary'): string {
  const colorMap = {
    primary: 'focus-visible:ring-primary',
    danger: 'focus-visible:ring-danger',
    success: 'focus-visible:ring-success',
  }
  
  return `focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 ${colorMap[color]}`
}

/**
 * Surface elevation utility
 */
export function surfaceElevation(level: 'raised' | 'elevated' = 'raised'): string {
  return level === 'raised' ? 'surface-raised' : 'surface-elevated'
}

/**
 * Responsive text size with proper line height
 */
export function responsiveText(
  mobile: string,
  desktop: string
): string {
  return `text-${mobile} lg:text-${desktop}`
}

/**
 * Check if element has sufficient color contrast
 * Returns true if contrast ratio >= 4.5:1 for normal text
 */
export function checkColorContrast(_foreground: string, _background: string): boolean {
  // This is a simplified check. In production, use a proper contrast checker library
  // like 'color-contrast-checker' or implement WCAG contrast formula
  
  // For now, return true as a placeholder
  // TODO: Implement proper WCAG 2.1 contrast checking
  return true
}

/**
 * Get semantic color for status
 */
export function getSemanticColor(status: 'success' | 'warning' | 'danger' | 'info'): string {
  const colorMap = {
    success: 'text-success',
    warning: 'text-warning',
    danger: 'text-danger',
    info: 'text-info',
  }
  
  return colorMap[status]
}

/**
 * Get semantic background color
 */
export function getSemanticBg(status: 'success' | 'warning' | 'danger' | 'info'): string {
  const colorMap = {
    success: 'bg-success-subtle',
    warning: 'bg-warning-subtle',
    danger: 'bg-danger-subtle',
    info: 'bg-info-subtle',
  }
  
  return colorMap[status]
}
