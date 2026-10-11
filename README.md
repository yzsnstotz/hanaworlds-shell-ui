# HanaWorlds Shell UI

Independent DSH client plugin, extracted from `hanaworlds-desktop` `bd964cdf`.
Provides HanaWorlds branding, light/dark palette, Home/Workshop/World panels,
BuildControls, plugin fault cards, and Settings “tools and skills”.

```sh
npm ci
npm run build && npm test
```

Node 24.13.1 or newer within Node 24 is required. The manifest declares `dsh.client` and a self-owned management bundle;
`lib/index.js` is a no-op discovery export. `lib/client.js` registers through the DSH
module loader, with panels bundled and React resolved from the Host's shared module
table. Published DSH service packages provide types; there are no monorepo links.
See [PROVENANCE.md](PROVENANCE.md) and [NOTICE](NOTICE) for origin and licenses.

## HTTP component fixture surface

`test/fixtures/desktop-bridge.ts` replaces the old preload globals with HTTP
fixtures, using the original nine test files and interaction data. It installs
mock fetch/EventSource in tests only. No fixture is enabled by the production plugin.

| Route | Method | Data |
| --- | --- | --- |
| `/api-hanaworlds-view` | GET | Observed binding / unselected / rejected |
| `/api-hanaworlds-view/events` | SSE | `change` triggers a fresh binding read |
| `/api-hanaworlds-view/choose` | POST | Empty UI action; bridge chooses current session |
| `/api-hanaworlds-workshop/history` | GET | Observed current conversation turns |
| `/api-hanaworlds-workshop/prepare` | POST | `{text}` |
| `/api-hanaworlds-workshop/confirm` | POST | Empty UI action |
| `/api-hanaworlds-workshop` | POST | `{operation, payload: {expectedTurnRevision?, expectedHistoryRevision?}}` |
| `/api-hanaworlds-worlds` | POST | Original UI fixture actions (`catalog`, `current`, `createFlat`, `switch`, `describeDelete`, `deleteWorld`, etc.) |
| `/api-hanaworlds-config` | GET | Observed installation settings |
| `/api-hanaworlds-deployment` | GET | Package identity and configuration facts |
| `/api-hanaworlds-skill-tools` | GET | Read-only registrations |
| `/api-hanaworlds-k3` | GET | Read-only write method and composition descriptions |

BuildControls submits UI operations and expected revisions only. The fixture bridge
assembles sessionRef/worldRef/localContext/requestId and validates full requests
and responses with the **published `hanaworlds-contracts#v2.9.0` session/v5 schema**.
The browser uses its public response types and rejects unsupported wire envelopes;
full schema validation and current-context authority belong to the bridge.
No renderer path is translated into worldId or templateId.

These are component fixture seams, not implemented server routes. Mock VERIFIED
results prove component interactions only; they do not prove a real world write,
readback, Undo, DSH installation or integrated UI acceptance.

## Later-card ownership (PM decision)

- `shell-ui-05` with `contracts-04`: real C-world-lifecycle describe/list/create/play.
- `shell-ui-07`: real deletion UI and exact name confirmation.
- `desktop-bridge-11` and `shell-ui-08`: real Undo/Redo HTTP and restart-state behavior.

This card preserves the old controls and interactions against explicit fixtures.
No Electron/native bridge implementation is included.

## shell-ui-02: roles and fault containment

Required roles are `shell-ui`, `world-source`, `canvas`, `brush`, `painter`,
`workshop`, `skills`, `desktop-bridge`, and `local-runtime`. Role requirements
own Host/client activation checks; provider names only identify observations.
Roles and providers come exclusively from desktop-bridge's read-only
`GET /api-hanaworlds-plugin-roles` (`world-inspection/v1 ReadPluginRoles`,
published `hanaworlds-contracts` tag `v2.9.0`). There is no Shell-owned provider
configuration. Renamed providers, several providers for one role, and a provider
covering several roles follow the response without package-name inference.

`PARTIAL` and `UNAVAILABLE` display the exact missing roles as an alert and mark
each missing role's row. A failed or invalid read names desktop-bridge and its
original HTTP/contract reason, lists unverified roles, and discards previous
providers. It does not certify those roles missing or running. Each refresh reads
the current route and plugin manager again.

The browser uses the published response types and checks the closed envelope,
provider keys, Unicode references, sorted unique providers, and the binding of
status/missingRoles to the provider map. The full contract runtime uses
`node:crypto` and is confined to tests. The HTTP GET route creates its own request
ID at Desktop; the browser checks its presence and shape, with no caller request
ID to correlate. Tests consume the released fixture and mock through the
public package exports (all eight exchanges and eleven applicable rejection
cases; the request-ID correlation rejection belongs to an RPC caller).

This remains a client-only plugin. It does not register the Host service
`hanaworldsShellUi`; if the real host cannot evidence that role, the route's
PARTIAL/missing `shell-ui` remains visible. Live Host assembly and owner
acceptance are separate from these component checks.

Versions come exclusively from `remote.pluginManager.listBundles()`; row module
names join providers to their owning bundle. If the bundle differs from the provider,
the version's owning bundle is named beside it. No standalone component version is
inferred from an owning bundle's version. Missing or ambiguous ownership/version
remains UNKNOWN. `listPlugins()` supplies Host state, while the public client Loader,
module import errors and entry failures supply client state and original diagnostics.
Deployment configuration no longer certifies plugin versions.

Each Shell apply registration is isolated, including delayed slot callbacks and
generators. Original failures are shown with `hanaworlds-shell-ui` in its panels
and a Plugins fault section; unaffected registrations continue. Optional client
failures also appear by name. The original `bd964cdf` plugin-isolation sample,
version 0.1.1, is preserved byte for byte in `test/fixtures/plugin-isolation`.
`provenance/plugin-isolation.json` records every file's SHA-256 and original path.
The test executes its original factory through the published DSH ClientModuleSystem
and Cordis Loader with in-memory imports, then checks its named card and a usable
Home control. This is component evidence, not real installation or cold-start
acceptance. Damaged packages, transport/load repair and Electron remain outside
this card (D-10 / D-9).

## Normal Desktop management

Install the packed tarball in a fresh official Desktop profile using Plugins → Add plugin → Install → Enable now. The package supplies its own `dsh.bundle.patch`: the public insert operation adds exactly one `hanaworlds-shell-ui` Host discovery anchor. Its Host `apply` stays empty; the existing `./client` artifact supplies all UI behavior through the official Client module loader. The bundle does not replace the Desktop composition or supply another Cordis/React runtime. Honor any normal restart request.

The exact `hanaworlds-contracts` v2.9.0 git reference is a development SDK for erased types and public fixture tests; production artifacts must never import, load or inline its implementation. Build/test/prepack validate the real package file list, official patch/profile/manager composition, empty Host and contract runtime boundary. Fixture checks do not establish native installation, Client activation, panels or supported host versions; those require separate real UI evidence.

### Verified compatibility scope

The Cordis peer accepts exactly `4.0.4 || 4.0.5-alpha.1`. The original 4.0.4 source/fixture support and the official 0.2.0-rc.2 patch composition were preserved; no native 4.0.4 result is claimed. The new target is the approved `dsh-v0.2.1-alpha.2` source at `d743267388641bc76f17c45ce8b4c231aed1d32c`, delivered through source-entry main `6d40fee12ce01a7522ba554d802346c28c2845ae`: Cordis 4.0.5-alpha.1, Loader 1.0.6-alpha.1 and Client React/ReactDOM 18.3.1. A fresh isolated official Desktop profile installed and enabled Shell through the native Plugins workflow, rendered its existing Home and plugin panels, removed its contributions on disable, restored them once on enable and retained them on cold start. Missing business providers remain visible as rejected binding/UNKNOWN roles. This certifies only Shell compatibility, not complete subscriptions, ten-package assembly, worlds, models or owner acceptance.
