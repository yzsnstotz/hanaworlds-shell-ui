/** Values the DSH client build substitutes at bundle time (see tsdown.config.ts `define`). */
declare const process: { readonly env: { readonly DSH_CLIENT_VERSION?: string; readonly NODE_ENV?: string } }
