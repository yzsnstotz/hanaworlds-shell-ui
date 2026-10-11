import type { SidebarBrandMarkOwnerProps } from '@deepseek-ai/dsh-client-ui-sidebar/client'
import type { HeroBrandMarkOwnerProps } from '@deepseek-ai/dsh-client-ui-conversation/client'
import { BLOSSOM_ICON } from './blossom-data.ts'

const PRODUCT_NAME = 'HanaWorlds'

/** HanaWorlds Blossom World concept mark in the sidebar. */
export function BrandMark({ size }: SidebarBrandMarkOwnerProps) {
  return <img src={BLOSSOM_ICON} alt="" width={size} height={size} />
}

/** The same Blossom identity on the empty conversation screen. */
export function HeroBrandMark({ size, className }: HeroBrandMarkOwnerProps) {
  return <img src={BLOSSOM_ICON} alt="" width={size} height={size} className={className} />
}

/** Name paired with the Blossom World mark. */
export function BrandName() {
  return <span style={{ fontWeight: 700, letterSpacing: '-0.03em' }}>{PRODUCT_NAME}</span>
}
