/** HanaWorlds palette layered through the public Client theme service. */
import type { ThemeTokenOverrides } from '@deepseek-ai/dsh-client-ui-theme/client'

const colors = (light: string, dark: string) => ({ light, dark })

/** Both modes remain legible when the user changes Appearance in Settings. */
export const HANA_THEME_TOKENS = {
  '--dsw-alias-bg-base': colors('#f4f0e6', '#142a25'),
  '--dsw-alias-bg-layer-1': colors('#fbf8ef', '#1b352e'),
  '--dsw-alias-bg-layer-2': colors('#fffaf0', '#203d34'),
  '--dsw-alias-bg-layer-3': colors('#efe8da', '#29483d'),
  '--dsw-alias-bg-overlay': colors('#fffaf0', '#254238'),
  '--dsw-alias-bg-module-platform': colors('#e7eee3', '#1b352e'),
  '--dsw-alias-border-l1': colors('rgba(37, 72, 53, .09)', 'rgba(218, 235, 205, .09)'),
  '--dsw-alias-border-l2': colors('rgba(37, 72, 53, .16)', 'rgba(218, 235, 205, .17)'),
  '--dsw-alias-border-l3': colors('rgba(37, 72, 53, .22)', 'rgba(218, 235, 205, .23)'),
  '--dsw-alias-border-l4': colors('rgba(37, 72, 53, .3)', 'rgba(218, 235, 205, .3)'),
  '--dsw-alias-label-primary': colors('#20372c', '#eef3e8'),
  '--dsw-alias-label-secondary': colors('#586e5f', '#b7c9bb'),
  '--dsw-alias-label-tertiary': colors('#687d6d', '#9eb5a5'),
  '--dsw-alias-label-caption': colors('#718472', '#9cb19f'),
  '--dsw-alias-label-primary-inverted': colors('#172c23', '#172c23'),
  '--dsw-alias-label-primary-foreground': colors('#172c23', '#172c23'),
  '--dsw-alias-brand-primary': colors('#b98756', '#dfbc8b'),
  '--dsw-alias-brand-text': colors('#915d30', '#e5c99e'),
  '--dsw-alias-brand-primary-new-colorprimary-new-color': colors('#926234', '#dfbc8b'),
  '--dsw-alias-state-business-primary': colors('#a67542', '#dfbc8b'),
  '--dsw-alias-button-primary-fill': colors('#c3996b', '#dfbc8b'),
  '--dsw-alias-button-primary-hover': colors('#d5ad7e', '#f0d2a5'),
  '--dsw-alias-button-elevated-fill': colors('#fffaf0', '#29483d'),
  '--dsw-alias-button-floating-fill': colors('#fffaf0', '#203d34'),
  '--dsw-alias-button-floating-hover': colors('#f0eadc', '#355647'),
  '--dsw-alias-interactive-bg-active': colors('rgba(124, 94, 57, .17)', 'rgba(223, 188, 139, .22)'),
  '--dsw-alias-interactive-bg-hover': colors('rgba(46, 80, 54, .08)', 'rgba(223, 188, 139, .13)'),
  '--dsw-alias-interactive-bg-hover-solid': colors('#e9eee3', '#355647'),
  '--dsw-alias-bg-skeleton': colors('rgba(41, 81, 53, .07)', 'rgba(236, 244, 226, .09)'),
  '--dsw-specific-sidebar-fill': colors('#e8ede3', '#102822'),
  '--dsw-specific-sidebar-nav-item-active': colors('#d8e5d7', '#2c493d'),
  '--dsw-specific-sidebar-nav-item-active-accent': colors('#e4d4ba', '#3d523e'),
  '--dsw-specific-sidebar-nav-item-hover': colors('#dde8dc', '#294238'),
  '--dsw-focus-ring-color': colors('#a67542', '#dfbc8b'),
} satisfies ThemeTokenOverrides
