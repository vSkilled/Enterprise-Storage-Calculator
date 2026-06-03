# Enterprise Storage Calculator

A mathematically precise, high-performance web tool built to model, visualize, and analyze complex storage topologies. This application enables enterprise architects, storage engineers, and sysadmins to evaluate raw storage arrays, compute efficiency heuristics, analyze performance characteristics, and compare fault tolerance across industry-standard storage designs.

---

## ⚡ Core Architecture & Engineering Highlights

*   **Zero-Framework Pure TypeScript**: Built on raw, clean TypeScript (`tsc`, `vite`, `esbuild`) to deliver near-instantaneous page loads, zero React-rendering overhead, and smooth micro-animations.
*   **Fully Decoupled Storage Engines**: Calculations are isolated in highly modular algorithms (within `src/js/heuristics.ts`) from screen state and visual elements (within `src/js/dom.ts`), allowing the mathematical formulas to be easily tested or scaled.
*   **Production-Ready Containerization**: Bundled via Vite for static asset management with an Express server wrapper (`server.ts`) built to run natively in lightweight containers (e.g., Google Cloud Run, Docker).
*   **Responsive Fluid Topology**: Tailored with Tailwind CSS for high-contrast light and dark themes, supporting touch-friendly configurations and desktop-first density layouts.

---

## 💾 Core Functional Modules (Tabs)

The application models four distinct storage architectures, each representing a unique philosophy in data distribution and replica availability.

### 1. Standard RAID, ZFS (RAIDZ), & Synology Hybrid RAID (SHR)
Models classic volume-level striping, mirroring, and parity.
*   **Supported Schemes**:
    *   **RAID 0 (Striping)**: Performance-focused, no redundancy.
    *   **RAID 1 (Mirroring)**: Full duplication, read speed gains.
    *   **RAID 5 / RAIDZ1 / SHR-1**: Single-drive parity tolerance.
    *   **RAID 6 / RAIDZ2 / SHR-2**: Dual-drive parity redundancy.
    *   **RAID 10**: Striped mirrors for high IOPS workloads.
    *   **RAIDZ3**: Triple parity fault protection.
*   **Interactive Visual Chassis**: Physically models a multi-bay system with colored indicators designating active drives, hot spares, parity disk distributions, and unallocated drives.
*   **Heuristics Calculated**: Raw vs usable GiB/TiB binary equivalence, write penalties, rebuild speed estimation based on drive properties, rebuild time graphs, and optimal/suboptimal threshold feedback.

### 2. Unraid Storage Pools
Models JBOD (Just a Bunch Of Disks) style expansion combined with server-authoritative dedicated parity disks and tiered caching.
*   **Mixed Drive Capabilities**: Unlike traditional RAID, Unraid accepts drives of completely different sizes without wasting capacity.
*   **Parity Protection**: Supports 1 or 2 dedicated parity drives. Parity sizes must exceed or equal the largest data drive's capacity.
*   **Tiered SSD/NVMe Caching**: Add SSD cache pools with various RAID configurations, analyzing write bottlenecks, storage tiers, and filesystem profiles.
*   **Bottleneck Detection**: Issues immediate warnings if smaller parity drives throttle larger data drives or if cache throughput limits physical storage speeds.

### 3. Btrfs Heterogeneous Multi-device Volumes
Models standard Btrfs multi-device storage trees across asymmetric/unequal drive arrays.
*   **Granular Copy Allocation**: Tracks how Btrfs allocates 1GB chunks across dynamic block groups relative to the requested replication level.
*   **Supported Profiles**: Single, RAID 0, RAID 1 (2-way mirrors), RAID 1C3 (3-way mirrors), RAID 1C4 (4-way mirrors), RAID 5, RAID 6, and RAID 10.
*   **Wasted Capacity Auditing**: Dynamically flags unbalanced capacity allocation. If a specific drive pair limits replication (e.g., RAID 1 with one huge drive and several micro physical disks), Btrfs cannot utilize the excess space—this application calculates and visualizes this "Wasted Capacity" with high-contrast banners.

### 4. Nutanix HCI Distributed Storage (HCI Engine)
Designed to simulate hyperconverged distributed block groups across virtualized clusters.
*   **Side-by-Side Comparison**: Compares **Redundancy Factor 2 (RF2)** and **Redundancy Factor 3 (RF3)** side-by-side using high-fidelity visualizations. This allows instant cross-comparison of:
    *   Base raw capacity vs distributed storage footprints.
    *   CVM (Controller VM) system-level memory/CPU reservation overheads.
    *   Performance envelopes (Read and Write IOPS, throughput limits).
    *   Self-healing parallel rebuild time metrics during disk/node disasters.
*   **Dynamic Stacked Allocations**: Beautifully renders proportional bar graphs representing Raw vs Usable vs Protection vs CVM Overhead to give administrators immediate visual validation.
*   **Advanced HCI Data Optimization Guides**:
    *   **Erasure Coding (EC-X)**: Evaluates Reed-Solomon parity reductions. Code highlights CPU performance tradeoffs and node minimum requirements (min 4 nodes for RF2, 6 nodes for RF3).
    *   **Inline Compression**: Highlights databases, log-files, and virtual machine configuration gains (~1.5x efficiency) with minimal performance overhead.
    *   **Inline Deduplication**: Highlights space optimization (~1.3x efficiency) for highly repetitive systems like VDI (Virtual Desktop Infrastructure) along with CPU/RAM footprints for smaller clusters (`< 3` nodes).
*   **Refactor Elements**: Displays Nutanix-specific warnings strategically placed between input criteria widgets and performance visuals to capture immediate operator attention.

---

## 🚀 Getting Started

### Prerequisites

*   **Node.js**: v18.x or above
*   **NPM**: v9.x or above

### Installation

Clone the repository and install dependencies:

```bash
npm install
```

### Development Server

Start the local development server with hot rebuilding on port 3000:

```bash
npm run dev
```

### Production Build & Deployment

Build and bundle compiled assets:

```bash
npm run build
```

This generates:
1.  Optimized static clientside assets inside `dist/`
2.  A standalone lightweight server runtime file at `dist/server.cjs`

Run the production server stack:

```bash
npm run start
```

---

## 🛠️ Performance Metrics References

The calculator references mathematically backed formulas derived from hardware standards:
*   **Read Speed Enhancement**: Standard arrays benefit from striped concurrency:
    $$\text{Read Rate} = N \times \text{Media Read Speed}$$
*   **Write Penalty Overhead**: Parity calculations decrease physical commit efficiency:
    *   RAID 5: 4 physical IO operations per logical write.
    *   RAID 6: 6 physical IO operations per logical write.
*   **Distributed Parallel Rebuilds**: Simulated dynamically using network throughput limits and distributed drive read concurrency bounds.
