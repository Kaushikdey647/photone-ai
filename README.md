# Photone AI

Desktop photo workspace built with **Tauri 2**, **React 19**, **TypeScript**, and **Vite**. The UI uses **Radix UI** primitives for dialogs, sliders, selects, and scrolling. A local **SQLite** catalog stores imported photos; workspace and per-photo AI chat threads are persisted there. OpenAI-compatible chat calls run in Rust with the API key stored in the **OS keychain**.

## Requirements

- **Node.js** 20+ (see `.nvmrc`)
- **Rust** stable toolchain and platform targets for [Tauri prerequisites](https://v2.tauri.app/start/prerequisites/)

## Run the app

Native commands (library, import, chat, settings) only work inside the Tauri webview:

```bash
npm install
npm run tauri dev
```

The Vite-only dev server (`npm run dev`) is useful for quick UI checks but **does not provide IPC**; features that call the Rust backend will error until you use `tauri dev`.

## Build

Frontend bundle (typecheck + Vite):

```bash
npm run build
```

Production desktop bundle:

```bash
npm run tauri build
```

## Project layout

| Path | Role |
|------|------|
| `src/` | React app: library, WebGL preview, develop sliders, AI chat, settings |
| `src-tauri/` | Rust: SQLite, migrations, Tauri commands, HTTP to the configured LLM endpoint |
| `public/luts/` | `.cube` LUT files loaded by the preview pipeline |

Local file preview uses Tauri’s **asset protocol** (`convertFileSrc`); the app enables `protocol-asset` and a broad asset scope so catalog paths resolve in the webview.

## Configuration

Open **Settings** in the app to set the OpenAI-compatible **base URL**, **model**, and optional **API key** (saved via the system keychain, not in the repo).
