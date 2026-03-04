# KubeVue

A fast, native desktop application for managing and monitoring Kubernetes clusters. Built with [Tauri v2](https://tauri.app/), React, and Rust.

## Features

- **Multi-cluster support** — Switch between kubectl contexts seamlessly
- **Resource browsing** — View Pods, Deployments, Services, ConfigMaps, Secrets, Ingresses, PVCs, and Events
- **Virtualized tables** — Handles thousands of resources with sortable, resizable columns
- **Live log streaming** — Stream pod logs in real-time with JSON log parsing and syntax highlighting
- **Revealable secrets** — View secret values with per-key reveal/hide toggles and one-click copy
- **PVC details** — Storage class, capacity (requested vs provisioned), access modes at a glance
- **Resource events** — Auto-refreshing events tab for any resource, filterable by involved object
- **Pod metrics** — Live CPU and memory usage bars per container (requires metrics-server)
- **YAML viewer** — Full resource YAML with folding, line numbers, and secret redaction by default
- **Deployment management** — Scale replicas, trigger rolling restarts, view related pods
- **Port forwarding** — Forward local ports to pods directly from the UI
- **Real-time updates** — Watch resources for live changes via Kubernetes watch API
- **Command palette** — Keyboard-driven navigation (`Cmd+K`)
- **Native performance** — Rust backend with ~10MB memory footprint

## Installation

### Download

Download the latest release from the [Releases](https://github.com/niteshghn/KubeVue/releases) page.

| Platform | Download |
|----------|----------|
| macOS (Apple Silicon) | `KubeVue_x.x.x_aarch64.dmg` |
| macOS (Intel) | `KubeVue_x.x.x_x64.dmg` |
| Windows | `KubeVue_x.x.x_x64-setup.exe` |
| Linux (Debian/Ubuntu) | `KubeVue_x.x.x_amd64.deb` |
| Linux (AppImage) | `KubeVue_x.x.x_amd64.AppImage` |

### Prerequisites

- A valid `~/.kube/config` with at least one configured context
- For pod metrics: [metrics-server](https://github.com/kubernetes-sigs/metrics-server) installed in your cluster

## Building from Source

### Requirements

- [Node.js](https://nodejs.org/) >= 18
- [Rust](https://www.rust-lang.org/tools/install) >= 1.77
- [Tauri CLI](https://tauri.app/start/prerequisites/) v2

### Steps

```bash
# Clone the repository
git clone https://github.com/niteshghn/KubeVue.git
cd KubeVue

# Install frontend dependencies
npm install

# Run in development mode
cargo tauri dev

# Build for production
cargo tauri build
```

The built application will be in `src-tauri/target/release/bundle/`.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | [Tauri v2](https://tauri.app/) |
| Frontend | React 19, TypeScript, Tailwind CSS v4 |
| Backend | Rust, [kube-rs](https://github.com/kube-rs/kube) |
| State | [Zustand](https://github.com/pmndrs/zustand) |
| Table | [TanStack Table](https://tanstack.com/table) + [TanStack Virtual](https://tanstack.com/virtual) |
| Editor | [CodeMirror](https://codemirror.net/) (YAML) |
| Icons | [Lucide](https://lucide.dev/) |

## Project Structure

```
kubevue/
├── src/                    # React frontend
│   ├── components/         # UI components
│   │   └── detail/         # Resource detail views
│   ├── hooks/              # Custom React hooks
│   ├── lib/                # API layer & parsers
│   └── stores/             # Zustand state management
├── src-tauri/              # Rust backend
│   └── src/
│       └── kube/           # Kubernetes client modules
│           ├── client.rs   # Client management
│           ├── config.rs   # Kubeconfig parsing
│           ├── resources.rs# Resource CRUD & events
│           ├── metrics.rs  # Pod metrics (metrics-server API)
│           ├── logs.rs     # Log streaming
│           ├── watcher.rs  # Real-time watch
│           └── port_forward.rs
└── package.json
```

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Cmd/Ctrl + K` | Open command palette |
| `/` | Focus search |
| `Esc` | Close detail view / command palette |
| `1`-`8` | Switch resource kind |

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## License

This project is licensed under the MIT License — see the [LICENSE](LICENSE) file for details.
