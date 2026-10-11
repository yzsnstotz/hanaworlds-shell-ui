# Source and licenses

This card migrates the approved existing interface; it does not implement real world lifecycle or native bridging.

- Source: `yzsnstotz/hanaworlds-desktop` at `bd964cdf19785b14aa1e2f6d2a2ee350190a038f`, `packages/client/ui-hanaworlds-shell`.
- `provenance/source-provenance.json` preserves the initial 29 byte-identical files and `git log --follow` histories captured before adapting their transport and test boundaries. It is an initial snapshot, not a claim that the final adapted files remain identical.
- Brand: `620e17a50fb1ea918c030ecb875ec88f1a3680a2`; palette: `6028b44d29730c332a71836ea3010a9d50998846`; Home: `b7d402824d672d50bb9b0eefe92fde3e344f6aa5`; BuildControls: `f590afaa3b6d2f3eb9cd9ea6b3ceb3d81df4b3de`.
- Client bundle wrapper and CSS handling follow upstream DSH `packages/client/tsdown.client.ts` and `packages/client/web/src/platform.ts`, as carried in the source baseline (DSH dsh-v0.2.0-rc.2, MIT).
- Adaptations: standalone npm build; public Loader/Remote/Store declarations; HTTP component-fixture transport; session/v5 public types; plugin roster name; HTTP-backed settings configuration; removal of unused placeholder copy. Branding, theme tokens and panel layout are retained.
- Contract: exact Git tag `v2.9.0`, commit `a892ceeb7047377d108f578161461aa06e0bfe5f`. No sibling module imports, workspace links or unpublished local types.

## Direct dependencies

Installed versions below are locked in package-lock.json. Dev dependencies supply public declarations, build tooling or component tests. Runtime panels use the Host module table; a no-op root export allows DSH discovery, with only dsh.client in the manifest.

| Name | Version | License | Source | Purpose |
| --- | --- | --- | --- | --- |
| @deepseek-ai/cordis | 4.0.4 | MIT | git+https://github.com/deepseek-ai/deepseek-harness.git | public Host service declarations; Host supplies runtime |
| @deepseek-ai/cordis-plugin-loader | 1.0.5 | MIT | git+https://github.com/deepseek-ai/deepseek-harness.git | public Host service declarations; Host supplies runtime |
| @deepseek-ai/dsh-api-gateway | 0.2.0-rc.2 | MIT | git+https://github.com/deepseek-ai/deepseek-harness.git | public Host service declarations; Host supplies runtime |
| @deepseek-ai/dsh-api-remotes | 0.2.0-rc.2 | MIT | git+https://github.com/deepseek-ai/deepseek-harness.git | public Host service declarations; Host supplies runtime |
| @deepseek-ai/dsh-client-locale | 0.2.0-rc.2 | MIT | git+https://github.com/deepseek-ai/deepseek-harness.git | public Host service declarations; Host supplies runtime |
| @deepseek-ai/dsh-client-modules | 0.2.0-rc.2 | MIT | git+https://github.com/deepseek-ai/deepseek-harness.git | public Host service declarations; Host supplies runtime |
| @deepseek-ai/dsh-client-store | 0.2.0-rc.2 | MIT | git+https://github.com/deepseek-ai/deepseek-harness.git | public Host service declarations; Host supplies runtime |
| @deepseek-ai/dsh-client-ui-conversation | 0.2.0-rc.2 | MIT | git+https://github.com/deepseek-ai/deepseek-harness.git | public Host service declarations; Host supplies runtime |
| @deepseek-ai/dsh-client-ui-layout | 0.2.0-rc.2 | MIT | git+https://github.com/deepseek-ai/deepseek-harness.git | public Host service declarations; Host supplies runtime |
| @deepseek-ai/dsh-client-ui-plugin-manager | 0.2.0-rc.2 | MIT | git+https://github.com/deepseek-ai/deepseek-harness.git | public Host service declarations; Host supplies runtime |
| @deepseek-ai/dsh-client-ui-renderer | 0.2.0-rc.2 | MIT | git+https://github.com/deepseek-ai/deepseek-harness.git | public Host service declarations; Host supplies runtime |
| @deepseek-ai/dsh-client-ui-settings | 0.2.0-rc.2 | MIT | git+https://github.com/deepseek-ai/deepseek-harness.git | public Host service declarations; Host supplies runtime |
| @deepseek-ai/dsh-client-ui-sidebar | 0.2.0-rc.2 | MIT | git+https://github.com/deepseek-ai/deepseek-harness.git | public Host service declarations; Host supplies runtime |
| @deepseek-ai/dsh-client-ui-slots | 0.2.0-rc.2 | MIT | git+https://github.com/deepseek-ai/deepseek-harness.git | public Host service declarations; Host supplies runtime |
| @deepseek-ai/dsh-client-ui-theme | 0.2.0-rc.2 | MIT | git+https://github.com/deepseek-ai/deepseek-harness.git | public Host service declarations; Host supplies runtime |
| @deepseek-ai/dsh-plugin-manager | 0.2.0-rc.2 | MIT | git+https://github.com/deepseek-ai/deepseek-harness.git | public Host service declarations; Host supplies runtime |
| @deepseek-ai/dsh-typert-protocol | 0.2.0-rc.2 | MIT | git+https://github.com/deepseek-ai/deepseek-harness.git | public Host service declarations; Host supplies runtime |
| @testing-library/dom | 10.4.2 | MIT | https://github.com/testing-library/dom-testing-library | build or component tests |
| @testing-library/react | 16.3.3 | MIT | https://github.com/testing-library/react-testing-library | build or component tests |
| @types/react | 18.3.31 | MIT | https://github.com/DefinitelyTyped/DefinitelyTyped.git | build or component tests |
| hanaworlds-contracts | 2.9.0 | MIT | https://github.com/yzsnstotz/hanaworlds-contracts/tree/v2.9.0 | public session/v5 and ReadPluginRoles types; released fixtures, mock and test validation |
| jsdom | 29.1.1 | MIT | git+https://github.com/jsdom/jsdom.git | build or component tests |
| lightningcss | 1.33.0 | MPL-2.0 | https://github.com/parcel-bundler/lightningcss.git | build or component tests |
| react | 18.3.1 | MIT | https://github.com/facebook/react.git | client panels; Host supplies React |
| react-dom | 18.3.1 | MIT | https://github.com/facebook/react.git | client panels; Host supplies React |
| tsdown | 0.22.14 | MIT | git+https://github.com/rolldown/tsdown.git | build or component tests |
| typescript | 6.0.3 | Apache-2.0 | https://github.com/microsoft/TypeScript.git | build or component tests |
| vitest | 4.1.11 | MIT | git+https://github.com/vitest-dev/vitest.git | build or component tests |

## shell-ui-02 candidate fixture and test declarations

- `hanaworlds-isolation-trial-sample` · 0.1.1 · MIT ·
  https://github.com/yzsnstotz/hanaworlds-desktop, exact `bd964cdf19785b14aa1e2f6d2a2ee350190a038f`,
  `apps/desktop/samples/plugin-isolation` · unchanged bad client factory, host discovery
  artifact, patch, locales, README files and license used only as test input.
  All ten file hashes and source paths are in `provenance/plugin-isolation.json`.
- `@types/node` · 24.10.1 · MIT · https://github.com/DefinitelyTyped/DefinitelyTyped ·
  explicit Node declarations for test-only file reads and VM evaluation of original
  artifacts.
- `undici-types` · 7.16.0 · MIT · https://github.com/nodejs/undici ·
  fetch declarations required by @types/node; test/build dependency only, no shipped runtime.
- Production continues to use the existing approved DSH/Cordis dependencies and
  shared Host React; no new production runtime dependency or sibling module import.

## Q-21 published role source

- `hanaworlds-contracts` · 2.9.0 · MIT ·
  `git+https://github.com/yzsnstotz/hanaworlds-contracts.git#v2.9.0`, commit
  `a892ceeb7047377d108f578161461aa06e0bfe5f` · public ReadPluginRoles types and
  `hanaworlds-contracts/fixtures/plugin-roles` / `createPluginRolesMock` for tests.
  Fixture and mock evidence is SOURCE/FIXTURE only. Runtime validation remains
  test-only because the package runtime imports node:crypto; the browser checks
  the released response shape and role binding invariants locally.
- HTTP boundary: desktop-bridge-plugin-roles-01 delivery `412a9b10361236e83560c964d6b55b64916d412a`
  publishes GET `/api-hanaworlds-plugin-roles`; no counterpart module is imported.
- Candidate `ea8d0cbce7ff4208ec75c762cf28bad56c2b471b` apply protection, fault
  components, upstream version reader and original plugin-isolation artifacts are
  retained. Q-21 removes its Shell-owned provider configuration.
