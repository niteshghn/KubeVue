# Contributing to KubeVue

Thanks for your interest in contributing! Here's how to get started.

## Development Setup

1. **Fork and clone** the repository
2. **Install dependencies:**
   ```bash
   npm install
   ```
3. **Run in dev mode:**
   ```bash
   cargo tauri dev
   ```

This starts Vite's dev server with hot reload for the frontend and compiles the Rust backend.

## Making Changes

1. Create a branch from `main`:
   ```bash
   git checkout -b feat/your-feature
   ```
2. Make your changes
3. Test that both builds pass:
   ```bash
   cargo build --manifest-path src-tauri/Cargo.toml
   npx vite build
   ```
4. Commit with a descriptive message following [Conventional Commits](https://www.conventionalcommits.org/):
   ```
   feat: add node affinity display to pod overview
   fix: handle nil container status in pod metrics
   ```
5. Push and open a Pull Request

## Architecture Notes

- **Backend (Rust):** All Kubernetes API calls go through `src-tauri/src/kube/`. Each module handles a specific concern (resources, logs, metrics, etc.). Commands are registered in `src-tauri/src/lib.rs`.
- **Frontend (React/TS):** The API layer is in `src/lib/tauri.ts`. Raw K8s objects are parsed by pure functions in `src/lib/k8s-parsers.ts`. State is managed via Zustand in `src/stores/appStore.ts`.
- **Pattern:** The backend sends full `raw` API objects to the frontend. Parsing and display logic lives entirely in TypeScript — this keeps the Rust side simple and makes it easy to add new resource views without backend changes.

## Adding a New Resource Kind

1. Add the list/get function in `src-tauri/src/kube/resources.rs`
2. Add the kind to the `list_resources` match
3. Add a parser in `src/lib/k8s-parsers.ts`
4. Add table columns in `src/components/ResourceTable.tsx`
5. Optionally add a detail overview in `src/components/detail/`

## Reporting Issues

Please include:
- KubeVue version
- OS and architecture
- Kubernetes version (server)
- Steps to reproduce
- Error messages or screenshots

## Code of Conduct

Be respectful and constructive. We follow the [Contributor Covenant](https://www.contributor-covenant.org/version/2/1/code_of_conduct/).
