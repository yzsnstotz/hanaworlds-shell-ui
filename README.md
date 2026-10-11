# HanaWorlds Shell UI

Independent DSH client plugin, extracted from `hanaworlds-desktop` `bd964cdf`.
Provides HanaWorlds branding, light/dark palette, Home/Workshop/World panels,
BuildControls, plugin fault cards, and Settings “tools and skills”.

```sh
npm ci
npm run build && npm test
```

Node 24.13.1 or newer within Node 24 is required. The manifest has only `dsh.client`;
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
and responses with the **published `hanaworlds-contracts#v2.0.0` session/v5 schema**.
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

## shell-ui-02 candidate: roles and fault containment

Required roles are `shell-ui`, `world-source`, `canvas`, `brush`, `painter`,
`workshop`, `skills`, `desktop-bridge`, and `local-runtime`. Role requirements
own Host/client activation checks; provider names only identify observations.
An unassigned role remains UNKNOWN, even if a former hard-coded package is active.
The candidate accepts `apply(ctx, {roleProviders: {"world-source": ["provider-name"]}})`;
several providers can be assigned to `skills` or any other role.

**Integration blocker:** DSH rc.2's ordinary client boot graph carries no plugin
configuration, and ClientEntries creates rows using `{name}` only. Its public
pluginManager inventory carries no HanaWorlds role metadata. The above module-local
configuration seam is component-tested, but cannot be supplied automatically by the
ordinary Host graph. It requires an agreed role-provider source before this card
can be completed. No new HTTP contract or name-based role inference is introduced.

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
