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
