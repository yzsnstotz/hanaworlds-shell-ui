import { beforeEach, afterEach, vi } from 'vitest'
import { installDesktopBridgeFixture } from './fixtures/desktop-bridge.ts'
beforeEach(() => { installDesktopBridgeFixture() })
afterEach(() => { vi.unstubAllGlobals() })
