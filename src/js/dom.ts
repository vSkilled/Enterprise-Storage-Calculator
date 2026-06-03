import { 
  Disk, 
  MediaType, 
  RaidLevel, 
  StatusMessage 
} from './types';
import { 
  calculateStandardRaid, 
  calculateUnraidArray, 
  calculateUnraidCache, 
  calculateBtrfsPool, 
  calculateNutanixCluster,
  NutanixResult,
  formatSpeed, 
  formatIOPS 
} from './heuristics';
import { Theme, applyTheme } from './theme';

// --- APPLICATION STATE CONTAINER ---
// Tracks calculations across all four storage tabs
const STATE = {
  activeTab: 'standard' as 'standard' | 'unraid' | 'btrfs' | 'nutanix',
  
  // STANDARD RAID
  standard: {
    diskCount: 8,
    diskSize: 18,
    mediaType: 'hdd' as MediaType,
    raidLevel: 'raid5' as RaidLevel,
  },

  // UNRAID
  unraid: {
    arrayDisks: [
      { s: 18, t: 'hdd' },
      { s: 14, t: 'hdd' },
      { s: 14, t: 'hdd' },
    ] as Disk[],
    cacheDisks: [
      { s: 2, t: 'nvme' },
      { s: 2, t: 'nvme' },
    ] as Disk[],
    fileSystem: 'xfs' as 'xfs' | 'btrfs' | 'zfs',
    parityCount: 1,
    writeMethod: 'auto' as 'auto' | 'reconstruct',
    cacheMode: 'btrfs_raid1',
  },

  // BTRFS
  btrfs: {
    disks: [
      { s: 4, t: 'nvme' },
      { s: 4, t: 'nvme' },
    ] as Disk[],
    profile: 'raid1',
  },

  // NUTANIX
  nutanix: {
    nodes: 4,
    hddSize: 200,
    ssdSize: 20,
    ecEnabled: false,
    compressionEnabled: false,
    dedupeEnabled: false,
  }
};

// --- LIGHTWEIGHT INLINE SVG ICON BUILDERS (LUCIDE EQUIVALENTS) ---

export const getSVGIcon = (name: string, cls: string = 'w-4 h-4'): string => {
  switch (name) {
    case 'hard-drive':
      return `<svg xmlns="http://www.w3.org/2000/svg" class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect width="20" height="8" x="2" y="3" rx="2" ry="2"/><rect width="20" height="8" x="2" y="13" rx="2" ry="2"/><line x1="6" x2="6.01" y1="7" y2="7"/><line x1="6" x2="6.01" y1="17" y2="17"/><line x1="10" x2="10.01" y1="7" y2="7"/><line x1="10" x2="10.01" y1="17" y2="17"/></svg>`;
    case 'settings':
      return `<svg xmlns="http://www.w3.org/2000/svg" class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.1a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>`;
    case 'database':
      return `<svg xmlns="http://www.w3.org/2000/svg" class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/><path d="M3 12c0 1.66 4 3 9 3s9-1.34 9-3"/></svg>`;
    case 'layers':
      return `<svg xmlns="http://www.w3.org/2000/svg" class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m12 3-10 5 10 5 10-5-10-5Z"/><path d="m2 17 10 5 10-5"/><path d="m2 12 10 5 10-5"/></svg>`;
    case 'compass':
      return `<svg xmlns="http://www.w3.org/2000/svg" class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"/></svg>`;
    case 'gauge':
      return `<svg xmlns="http://www.w3.org/2000/svg" class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m12 14 4-4"/><path d="M3.34 19a10 10 0 1 1 17.32 0"/></svg>`;
    case 'plus':
      return `<svg xmlns="http://www.w3.org/2000/svg" class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="M12 5v14"/></svg>`;
    case 'x':
      return `<svg xmlns="http://www.w3.org/2000/svg" class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>`;
    case 'check':
      return `<svg xmlns="http://www.w3.org/2000/svg" class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/></svg>`;
    case 'alert':
      return `<svg xmlns="http://www.w3.org/2000/svg" class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" x2="12" y1="9" y2="13"/><line x1="12" x2="12.01" y1="17" y2="17"/></svg>`;
    case 'info':
      return `<svg xmlns="http://www.w3.org/2000/svg" class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>`;
    case 'error':
      return `<svg xmlns="http://www.w3.org/2000/svg" class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="m15 9-6 6"/><path d="m9 9 6 6"/></svg>`;
    case 'sun':
      return `<svg xmlns="http://www.w3.org/2000/svg" class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/></svg>`;
    case 'moon':
      return `<svg xmlns="http://www.w3.org/2000/svg" class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/></svg>`;
    case 'monitor':
      return `<svg xmlns="http://www.w3.org/2000/svg" class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="20" height="14" x="2" y="3" rx="2"/><line x1="8" x2="16" y1="21" y2="21"/><line x1="12" x2="12" y1="17" y2="21"/></svg>`;
    default:
      return '';
  }
};

// --- RENDER DYNAMIC CHASSIS BAY GRAPHIC ---
// Builds identical grid graphics to the original React version

export function buildDriveBayHTML(id: number, isPopulated: boolean, size?: number, mediaType: MediaType = 'hdd', isParity: boolean = false): string {
  if (!isPopulated) {
    return `
      <div class="h-14 rounded-lg border border-slate-200 dark:border-slate-800 border-dashed bg-slate-50/50 dark:bg-slate-900/30 flex items-center justify-center opacity-60 transition-all select-none col-span-1">
        <span class="text-[10px] font-mono text-slate-400 dark:text-slate-600 font-bold">
          ${id.toString().padStart(2, '0')}
        </span>
      </div>
    `;
  }

  // Determine LED blink color
  const ledColor = isParity ? 'bg-emerald-500' : 'bg-blue-500 animate-pulse';

  // Determine drive icons styling and colors
  let driveIconColor = 'text-blue-500';
  let cardClass = 'bg-blue-50/50 border-blue-200/80 text-blue-950 dark:bg-blue-950/20 dark:border-blue-500/30 dark:text-blue-200 hover:border-blue-300';
  let tagClass = 'text-blue-600 bg-blue-100/60 border-blue-200/30 dark:text-blue-300 dark:bg-blue-950/50 dark:border-blue-500/30';

  if (isParity) {
    driveIconColor = 'text-emerald-500';
    cardClass = 'bg-emerald-50/50 border-emerald-200/80 text-emerald-950 dark:bg-emerald-950/20 dark:border-emerald-500/30 dark:text-emerald-200 hover:border-emerald-300';
    tagClass = 'text-emerald-600 bg-emerald-100/60 border-emerald-200/30 dark:text-emerald-300 dark:bg-emerald-950/50 dark:border-emerald-500/30';
  } else if (mediaType === 'hdd5400') {
    driveIconColor = 'text-slate-450 dark:text-slate-400';
    cardClass = 'bg-slate-50 border-slate-200 text-slate-905 dark:bg-slate-800/40 dark:border-slate-700/80 dark:text-slate-200 hover:border-slate-300';
    tagClass = 'text-slate-500 bg-slate-100 border-slate-200/30 dark:text-slate-400 dark:bg-slate-800/70 dark:border-slate-700/80';
  } else if (mediaType === 'nvme') {
    driveIconColor = 'text-purple-500';
    cardClass = 'bg-purple-50/50 border-purple-200/80 text-purple-950 dark:bg-purple-950/20 dark:border-purple-500/30 dark:text-purple-200 hover:border-purple-300';
    tagClass = 'text-purple-600 bg-purple-100/60 border-purple-200/30 dark:text-purple-300 dark:bg-purple-950/50 dark:border-purple-500/30';
  } else if (mediaType === 'ssd') {
    driveIconColor = 'text-rose-500';
    cardClass = 'bg-rose-50/50 border-rose-200/80 text-rose-950 dark:bg-rose-950/20 dark:border-rose-500/30 dark:text-rose-200 hover:border-rose-300';
    tagClass = 'text-rose-600 bg-rose-100/60 border-rose-200/30 dark:text-rose-300 dark:bg-rose-950/50 dark:border-rose-500/30';
  }

  const tagLabel = isParity ? 'PARITY' : mediaType === 'hdd5400' ? '5400' : mediaType.toUpperCase();

  return `
    <div class="h-14 rounded-lg flex flex-col justify-center items-center relative overflow-hidden group border transition-all duration-300 hover:scale-[1.03] shadow-sm select-none ${cardClass} col-span-1">
      <!-- LED status light -->
      <div class="absolute top-1 right-1 w-1.5 h-1.5 rounded-full ${ledColor}"></div>
      
      <!-- Slot Label Number -->
      <span class="absolute top-1 left-1.5 text-[7px] font-mono text-slate-400 dark:text-slate-500 font-bold tracking-tighter">
        ${id.toString().padStart(2, '0')}
      </span>

      <!-- Embedded SVG Icon -->
      <div class="${driveIconColor} mb-0.5 mt-2.5">
        ${getSVGIcon('hard-drive', 'w-4 h-4')}
      </div>
      
      <span class="text-[10px] font-mono font-bold tracking-tight mb-2">
        ${size} TB
      </span>
      
      <span class="absolute bottom-0 text-[7px] font-extrabold uppercase tracking-widest w-full text-center py-0.5 leading-none border-t ${tagClass}">
        ${tagLabel}
      </span>
    </div>
  `;
}

// --- RENDER HEURISTICS RESULTS ---

function renderStatusBox(status: StatusMessage) {
  const container = document.getElementById('statusBoxContainer')!;
  
  // Icon and Box style mapping
  let iconName = 'check';
  let boxClasses = '';
  switch (status.severity) {
    case 'optimal':
      iconName = 'check';
      boxClasses = 'bg-emerald-50 text-emerald-900 border-emerald-200/85 dark:bg-emerald-950/20 dark:text-emerald-200 dark:border-emerald-500/30';
      break;
    case 'warning':
    case 'suboptimal':
      iconName = 'alert';
      boxClasses = 'bg-amber-50 text-amber-900 border-amber-200/85 dark:bg-amber-950/20 dark:text-amber-200 dark:border-amber-500/30';
      break;
    case 'info':
      iconName = 'info';
      boxClasses = 'bg-blue-50 text-blue-900 border-blue-200/85 dark:bg-blue-950/20 dark:text-blue-200 dark:border-blue-500/30';
      break;
    case 'error':
      iconName = 'error';
      boxClasses = 'bg-red-50 text-red-900 border-red-200/85 dark:bg-red-950/20 dark:text-red-200 dark:border-red-500/30';
      break;
  }

  container.innerHTML = `
    <div class="p-4 rounded-xl border flex items-start gap-3 transition-colors duration-300 ${boxClasses}">
      <span class="mt-0.5 flex-shrink-0 animate-fade-in text-current">
        ${getSVGIcon(iconName, 'w-5 h-5')}
      </span>
      <div>
        <h3 class="font-bold text-slate-900 dark:text-white">${status.title}</h3>
        <p class="text-xs mt-0.5 text-slate-600 dark:text-slate-300 leading-relaxed">${status.desc}</p>
      </div>
    </div>
  `;
}

// --- TAB RENDERING METHODS ---

export function renderStandardTab() {
  const settingsDiv = document.getElementById('tabSettingsPanel')!;
  const metricsDiv = document.getElementById('tabMetricsContainer')!;
  const chassisDiv = document.getElementById('tabChassisContainer')!;

  const { diskCount, diskSize, mediaType, raidLevel } = STATE.standard;
  const results = calculateStandardRaid(diskCount, diskSize, raidLevel, mediaType);

  // 1. Render Side Controls Panel
  settingsDiv.innerHTML = `
    <div class="space-y-6">
      <h2 class="text-sm font-bold flex items-center gap-2 mb-4 text-slate-800 dark:text-slate-200 uppercase tracking-wider">
        ${getSVGIcon('settings', 'w-4 h-4 text-slate-400')} Array Settings
      </h2>

      <!-- Disk Count Configuration -->
      <div class="space-y-2">
        <div class="flex justify-between items-center text-xs font-bold text-slate-500 dark:text-slate-400 uppercase">
          <span>Number of Disks:</span>
          <span class="text-blue-600 dark:text-blue-400 font-mono text-sm" id="stdDiskCountLabel">${diskCount}</span>
        </div>
        <input
          id="stdDiskCountSlider"
          type="range"
          min="1"
          max="64"
          value="${diskCount}"
          class="w-full h-1.5 bg-slate-200 dark:bg-slate-800 rounded-lg appearance-none cursor-pointer accent-blue-600"
        />
        <div class="flex justify-between text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase">
          <span>1 Disk</span>
          <span>64 (Max)</span>
        </div>
      </div>

      <!-- Individual Disk Size in TB -->
      <div class="space-y-1.5">
        <label class="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide" htmlFor="stdDiskSizeInput">
          Disk Size (TB):
        </label>
        <div class="relative">
          <input
            id="stdDiskSizeInput"
            type="number"
            min="1"
            max="100"
            value="${diskSize || ''}"
            class="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg py-2 pl-3 pr-12 text-slate-900 dark:text-slate-100 font-mono text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
          />
          <span class="absolute right-3 top-2.5 text-slate-400 dark:text-slate-500 text-xs font-mono font-bold">TB</span>
        </div>
      </div>

      <!-- Storage Medium Select -->
      <div class="space-y-1.5">
        <label class="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide" htmlFor="stdMediaTypeSelect">
          Media Type:
        </label>
        <select
          id="stdMediaTypeSelect"
          class="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg py-2.5 px-3 text-slate-800 dark:text-slate-200 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 appearance-none cursor-pointer"
        >
          <option value="hdd5400" ${mediaType === 'hdd5400' ? 'selected' : ''} class="bg-white dark:bg-slate-900">Consumer HDD (5400 RPM)</option>
          <option value="hdd" ${mediaType === 'hdd' ? 'selected' : ''} class="bg-white dark:bg-slate-900">Enterprise HDD (7200 RPM)</option>
          <option value="ssd" ${mediaType === 'ssd' ? 'selected' : ''} class="bg-white dark:bg-slate-900">SATA SSD</option>
          <option value="nvme" ${mediaType === 'nvme' ? 'selected' : ''} class="bg-white dark:bg-slate-900">NVMe PCIe (Gen 3/4)</option>
        </select>
      </div>

      <!-- RAID Array Type Selector -->
      <div class="space-y-1.5">
        <label class="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide" htmlFor="stdRaidLevelSelect">
          RAID / File System Scheme:
        </label>
        <select
          id="stdRaidLevelSelect"
          class="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg py-2.5 px-3 text-slate-800 dark:text-slate-200 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 appearance-none cursor-pointer"
        >
          <optgroup label="Standard Hardware RAID" class="bg-white dark:bg-slate-900 font-bold">
            <option value="raid0" ${raidLevel === 'raid0' ? 'selected' : ''}>RAID 0 (Striping - No Fault Tolerance)</option>
            <option value="raid1" ${raidLevel === 'raid1' ? 'selected' : ''}>RAID 1 (Mirroring - Fail Any But One)</option>
            <option value="raid5" ${raidLevel === 'raid5' ? 'selected' : ''}>RAID 5 (Single Parity - Fail 1 Disk)</option>
            <option value="raid6" ${raidLevel === 'raid6' ? 'selected' : ''}>RAID 6 (Dual Parity - Fail 2 Disks)</option>
            <option value="raid10" ${raidLevel === 'raid10' ? 'selected' : ''}>RAID 10 (Stripe over Mirror Sets)</option>
          </optgroup>
          <optgroup label="ZFS File System VDEVs" class="bg-white dark:bg-slate-900 font-bold">
            <option value="raid1" ${raidLevel === 'raid1' ? 'selected' : ''}>ZFS Mirror (Similar to RAID 1)</option>
            <option value="raidz1" ${raidLevel === 'raidz1' ? 'selected' : ''}>RAIDZ1 (1 Disk Parity - Fail 1 Disk)</option>
            <option value="raidz2" ${raidLevel === 'raidz2' ? 'selected' : ''}>RAIDZ2 (2 Disk Parity - Fail 2 Disks)</option>
            <option value="raidz3" ${raidLevel === 'raidz3' ? 'selected' : ''}>RAIDZ3 (3 Disk Parity - Fail 3 Disks)</option>
          </optgroup>
          <optgroup label="Synology Hybrid RAID" class="bg-white dark:bg-slate-900 font-bold">
            <option value="shr1" ${raidLevel === 'shr1' ? 'selected' : ''}>SHR-1 (1 Disk Protection)</option>
            <option value="shr2" ${raidLevel === 'shr2' ? 'selected' : ''}>SHR-2 (2 Disk Protection)</option>
          </optgroup>
        </select>
      </div>
    </div>
  `;

  // 2. Render Storage & Performance Metrics Panel
  const usableTiB = results.usable === 0 ? '0.00' : (results.usable * (1000**4 / 1024**4)).toFixed(2);
  metricsDiv.innerHTML = `
    <div class="space-y-6">
      <!-- Core Capacity Metas -->
      <div class="flex items-center gap-2 text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">
        ${getSVGIcon('layers', 'w-4 h-4')} Storage Capacity
      </div>
      <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div class="bg-white dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 p-4 rounded-xl shadow-sm">
          <p class="text-slate-455 dark:text-slate-400 text-[10px] font-bold uppercase tracking-widest mb-1 select-none">Usable Storage</p>
          <p class="text-xl font-black text-blue-600 dark:text-blue-400 font-mono">${results.usable.toFixed(1).replace(/\.0$/, '')} TB</p>
          <p class="text-[9px] text-slate-400 dark:text-slate-500 font-mono mt-0.5 select-none">~${usableTiB} TiB binary equivalence</p>
        </div>
        <div class="bg-white dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 p-4 rounded-xl shadow-sm">
          <p class="text-slate-455 dark:text-slate-400 text-[10px] font-bold uppercase tracking-widest mb-1 select-none">Protection Overhead</p>
          <p class="text-xl font-black text-emerald-600 dark:text-emerald-400 font-mono">${results.protection.toFixed(1).replace(/\.0$/, '')} TB</p>
          <p class="text-[9px] text-slate-400 dark:text-slate-500 font-mono mt-0.5 select-none">Parity or mirror duplicates</p>
        </div>
        <div class="bg-white dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 p-4 rounded-xl shadow-sm">
          <p class="text-slate-455 dark:text-slate-400 text-[10px] font-bold uppercase tracking-widest mb-1 select-none">Raw Capacity</p>
          <p class="text-xl font-black text-slate-800 dark:text-slate-200 font-mono">${results.raw.toFixed(1).replace(/\.0$/, '')} TB</p>
          <p class="text-[9px] text-slate-400 dark:text-slate-500 font-mono mt-0.5 select-none">Sum of all raw disk bytes</p>
        </div>
        <div class="bg-white dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 p-4 rounded-xl shadow-sm">
          <p class="text-slate-455 dark:text-slate-400 text-[10px] font-bold uppercase tracking-widest mb-1 select-none">Fault Tolerance</p>
          <p class="text-[12px] font-black text-purple-600 dark:text-purple-400 mt-1 select-none leading-tight uppercase font-mono">${results.faultToleranceText}</p>
          <p class="text-[9px] text-slate-400 dark:text-slate-500 font-mono mt-1.5 select-none">Drives safe to fail in pool</p>
        </div>
      </div>

      <!-- Performance Estimations -->
      <div class="flex items-center gap-2 text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest pt-2">
        ${getSVGIcon('gauge', 'w-4 h-4')} Performance Estimates
      </div>
      <div class="grid grid-cols-2 lg:grid-cols-4 gap-4 font-mono">
        <div class="bg-white dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 p-4 rounded-xl shadow-sm text-slate-900 dark:text-slate-100">
          <p class="text-slate-455 dark:text-slate-400 text-[10px] font-bold uppercase tracking-widest mb-1 select-none font-sans">Read Throughput</p>
          <p class="text-lg font-black text-indigo-600 dark:text-indigo-400">${formatSpeed(results.readSpeed)}</p>
          <p class="text-[9px] text-slate-400 dark:text-slate-500 font-sans mt-0.5 select-none leading-none">${formatIOPS(results.readIops)} IOPS</p>
        </div>
        <div class="bg-white dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 p-4 rounded-xl shadow-sm text-slate-900 dark:text-slate-100">
          <p class="text-slate-455 dark:text-slate-400 text-[10px] font-bold uppercase tracking-widest mb-1 select-none font-sans">Write Throughput</p>
          <p class="text-lg font-black text-pink-600 dark:text-pink-400">${formatSpeed(results.writeSpeed)}</p>
          <p class="text-[9px] text-slate-400 dark:text-slate-500 font-sans mt-0.5 select-none leading-none">${formatIOPS(results.writeIops)} IOPS</p>
        </div>
        <div class="bg-white dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 p-4 rounded-xl shadow-sm col-span-2 flex flex-col justify-between text-slate-900 dark:text-slate-100 font-sans">
          <div>
            <p class="text-slate-455 dark:text-slate-400 text-[10px] font-bold uppercase tracking-widest mb-1 select-none font-sans">Est. Parity Rebuild</p>
            <p class="text-lg font-black text-amber-600 dark:text-amber-500 font-mono">${results.rebuildTimeText}</p>
          </div>
          <p class="text-[9px] text-slate-400 dark:text-slate-500 font-sans leading-none mt-1.5 select-none">Full rebuild calculated under ideal throughput bounds</p>
        </div>
      </div>
    </div>
  `;

  // Render Status Check Box
  renderStatusBox(results.status);

  // 3. Draw Drive Bays in Server Chassis
  const displayBayCount = Math.max(24, Math.ceil(diskCount / 6) * 6);
  // Unraid isolates its parity drive count
  const protectionBytes = results.protection;
  const parityDriveCount = results.usable === 0 ? 0 : Math.ceil(protectionBytes / diskSize);

  let baysHTML = '';
  for (let i = 1; i <= displayBayCount; i++) {
    const isPopulated = i <= diskCount;
    // Parity drives are labeled based on parity count boundaries
    const isParity = isPopulated && (
      raidLevel === 'raid1' ? (i > 1) :
      raidLevel === 'raid5' || raidLevel === 'raidz1' || raidLevel === 'shr1' ? (i === diskCount) :
      raidLevel === 'raid6' || raidLevel === 'raidz2' || raidLevel === 'shr2' ? (i > diskCount - 2) :
      raidLevel === 'raidz3' ? (i > diskCount - 3) :
      raidLevel === 'raid10' ? (i % 2 === 0) :
      false
    );
    baysHTML += buildDriveBayHTML(i, isPopulated, diskSize, mediaType, isParity);
  }

  chassisDiv.innerHTML = `
    <div class="flex flex-col h-full">
      <h4 class="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-1.5">
        ${getSVGIcon('layers', 'w-3.5 h-3.5 text-blue-500')} Main Chassis (${displayBayCount}-bay layout)
      </h4>
      <div class="bg-white dark:bg-slate-850 rounded-xl p-4 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col gap-2 relative overflow-y-auto max-h-[300px] custom-scrollbar flex-grow">
        <div class="grid grid-cols-6 gap-2">
          ${baysHTML}
        </div>
      </div>
    </div>
  `;

  // Bind Listeners
  document.getElementById('stdDiskCountSlider')!.addEventListener('input', (e) => {
    const val = parseInt((e.target as HTMLInputElement).value);
    STATE.standard.diskCount = val;
    document.getElementById('stdDiskCountLabel')!.innerText = val.toString();
    renderStandardTab();
  });

  document.getElementById('stdDiskSizeInput')!.addEventListener('input', (e) => {
    const val = parseFloat((e.target as HTMLInputElement).value) || 0;
    STATE.standard.diskSize = val;
    renderStandardTab();
  });

  document.getElementById('stdMediaTypeSelect')!.addEventListener('change', (e) => {
    STATE.standard.mediaType = (e.target as HTMLSelectElement).value as MediaType;
    renderStandardTab();
  });

  document.getElementById('stdRaidLevelSelect')!.addEventListener('change', (e) => {
    STATE.standard.raidLevel = (e.target as HTMLSelectElement).value as RaidLevel;
    renderStandardTab();
  });
}

export function renderUnraidTab() {
  const settingsDiv = document.getElementById('tabSettingsPanel')!;
  const metricsDiv = document.getElementById('tabMetricsContainer')!;
  const chassisDiv = document.getElementById('tabChassisContainer')!;

  const { arrayDisks, cacheDisks, fileSystem, parityCount, writeMethod, cacheMode } = STATE.unraid;

  const arrayResults = calculateUnraidArray(arrayDisks, parityCount, fileSystem, writeMethod);
  const cacheResults = calculateUnraidCache(cacheDisks, cacheMode);

  // Active status box cascading priority
  let activeStatus: StatusMessage = arrayResults.status;
  if (arrayResults.status.severity === 'error') {
    activeStatus = arrayResults.status;
  } else if (cacheResults.status && cacheResults.status.severity === 'error') {
    activeStatus = cacheResults.status;
  } else if (arrayResults.status.severity === 'warning') {
    activeStatus = arrayResults.status;
  } else if (cacheResults.status && cacheResults.status.severity === 'warning') {
    activeStatus = cacheResults.status;
  } else if (arrayResults.status.severity === 'suboptimal') {
    activeStatus = arrayResults.status;
  } else if (cacheResults.status && cacheResults.status.severity === 'suboptimal') {
    activeStatus = cacheResults.status;
  } else if (arrayResults.status.severity === 'info') {
    activeStatus = arrayResults.status;
  } else if (cacheResults.status && cacheResults.status.severity === 'info') {
    activeStatus = cacheResults.status;
  }

  // 1. Render Controls
  settingsDiv.innerHTML = `
    <div class="space-y-6">
      <!-- Main Array Config -->
      <div>
        <h2 class="text-sm font-bold flex items-center gap-2 mb-4 text-slate-800 dark:text-slate-200 uppercase tracking-wider">
          ${getSVGIcon('layers', 'w-4 h-4 text-slate-400')} Main Array
        </h2>

        <div class="space-y-4 mb-4">
          <div class="space-y-1">
            <label class="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide" htmlFor="unFSSelect">
              File System:
            </label>
            <select
              id="unFSSelect"
              class="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg py-2 px-3 text-slate-850 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500 appearance-none cursor-pointer text-xs font-medium"
            >
              <option value="xfs" ${fileSystem === 'xfs' ? 'selected' : ''}>XFS (Default, Highest Performance)</option>
              <option value="btrfs" ${fileSystem === 'btrfs' ? 'selected' : ''}>BTRFS (Snapshots, Integrity Check)</option>
              <option value="zfs" ${fileSystem === 'zfs' ? 'selected' : ''}>ZFS (ARC Cache, Advanced Integrity)</option>
            </select>
          </div>

          <div class="space-y-1">
            <label class="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide" htmlFor="unParitySelect">
              Parity Protection:
            </label>
            <select
              id="unParitySelect"
              class="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg py-2 px-3 text-slate-850 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500 appearance-none cursor-pointer text-xs font-medium"
            >
              <option value="0" ${parityCount === 0 ? 'selected' : ''}>No Parity (0 Disks)</option>
              <option value="1" ${parityCount === 1 ? 'selected' : ''}>Single Parity (1 Disk)</option>
              <option value="2" ${parityCount === 2 ? 'selected' : ''}>Dual Parity (2 Disks)</option>
            </select>
          </div>

          <div class="space-y-1">
            <label class="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide" htmlFor="unWriteMethodSelect">
              Write Method (md_write_method):
            </label>
            <select
              id="unWriteMethodSelect"
              ${parityCount === 0 ? 'disabled' : ''}
              class="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg py-2 px-3 text-slate-850 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500 appearance-none cursor-pointer text-xs font-medium disabled:opacity-50"
            >
              <option value="auto" ${writeMethod === 'auto' ? 'selected' : ''}>Auto (Read/Modify/Write - Power Saving)</option>
              <option value="reconstruct" ${writeMethod === 'reconstruct' ? 'selected' : ''}>Reconstruct Write (Turbo Write - Speed)</option>
            </select>
          </div>
        </div>

        <!-- Dynamic List of Data drive configs -->
        <div class="space-y-2 mt-6">
          <div class="flex justify-between items-center text-xs font-bold text-slate-500 dark:text-slate-400 uppercase border-b border-slate-200 dark:border-slate-800 pb-2 mb-2">
            <span class="text-slate-705 dark:text-slate-300">Array Disks (${arrayDisks.length}/30)</span>
            <button
              id="unAddNewArrayDisk"
              class="text-[10px] bg-blue-600 hover:bg-blue-700 text-white font-bold px-2.5 py-1.5 rounded-lg flex items-center gap-1 transition-all uppercase tracking-wide cursor-pointer"
              ${arrayDisks.length >= 30 ? 'disabled' : ''}
            >
              ${getSVGIcon('plus', 'w-3 h-3')} Add
            </button>
          </div>

          <div class="space-y-2" id="unArrayDisksDynamicList">
            <!-- Rendered in renderUnraidArrayDisksList() -->
          </div>
        </div>
      </div>

      <hr class="border-slate-200 dark:border-slate-800 my-4" />

      <!-- Cache Pool Config -->
      <div>
        <h2 class="text-sm font-bold flex items-center gap-2 mb-4 text-slate-800 dark:text-slate-200 uppercase tracking-wider">
          ${getSVGIcon('database', 'w-4 h-4 text-slate-400')} Cache Pool
        </h2>

        <div class="space-y-4 mb-4">
          <div class="space-y-1">
            <label class="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide" htmlFor="unCacheModeSelect">
              Filesystem & Profile:
            </label>
            <select
              id="unCacheModeSelect"
              class="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg py-2.5 px-3 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-purple-500 appearance-none cursor-pointer text-xs font-medium"
            >
              <optgroup label="BTRFS Pool Layout" class="bg-white dark:bg-slate-900">
                <option value="btrfs_single" ${cacheMode === 'btrfs_single' ? 'selected' : ''}>Single (Non-Redundant / Spanned)</option>
                <option value="btrfs_raid0" ${cacheMode === 'btrfs_raid0' ? 'selected' : ''}>RAID 0 (Stripe - Direct Performance)</option>
                <option value="btrfs_raid1" ${cacheMode === 'btrfs_raid1' ? 'selected' : ''}>RAID 1 (Mirror - Redundancy)</option>
                <option value="btrfs_raid1c3" ${cacheMode === 'btrfs_raid1c3' ? 'selected' : ''}>RAID 1c3 (3-Way Mirror Protection)</option>
                <option value="btrfs_raid5" ${cacheMode === 'btrfs_raid5' ? 'selected' : ''}>RAID 5 (Parity)</option>
              </optgroup>
              <optgroup label="ZFS Pool Layout (Single VDEV)" class="bg-white dark:bg-slate-900">
                <option value="zfs_stripe" ${cacheMode === 'zfs_stripe' ? 'selected' : ''}>Stripe VDEV (Zero Redundancy)</option>
                <option value="zfs_mirror" ${cacheMode === 'zfs_mirror' ? 'selected' : ''}>Mirror VDEV (Dual Drive Redundancy)</option>
                <option value="zfs_raidz1" ${cacheMode === 'zfs_raidz1' ? 'selected' : ''}>RAIDZ1 VDEV (Single Parity Protection)</option>
                <option value="zfs_raidz2" ${cacheMode === 'zfs_raidz2' ? 'selected' : ''}>RAIDZ2 VDEV (Double Parity Protection)</option>
              </optgroup>
            </select>
          </div>
        </div>

        <div class="space-y-2">
          <div class="flex justify-between items-center text-xs font-bold text-slate-500 dark:text-slate-400 uppercase border-b border-slate-200 dark:border-slate-800 pb-2 mb-2">
            <span class="text-slate-705 dark:text-slate-300">Cache Disks (${cacheDisks.length}/30)</span>
            <button
              id="unAddNewCacheDisk"
              class="text-[10px] bg-purple-650 hover:bg-purple-700 text-white font-bold px-2.5 py-1.5 rounded-lg flex items-center gap-1 transition-all uppercase tracking-wide cursor-pointer"
              ${cacheDisks.length >= 30 ? 'disabled' : ''}
            >
              ${getSVGIcon('plus', 'w-3 h-3')} Add
            </button>
          </div>

          <div class="space-y-2" id="unCacheDisksDynamicList">
            <!-- Rendered in renderUnraidCacheList() -->
          </div>
        </div>
      </div>
    </div>
  `;

  // Dynamic Array drives template
  const renderUnraidArrayDisksList = () => {
    const listContainer = document.getElementById('unArrayDisksDynamicList')!;
    listContainer.innerHTML = arrayDisks.map((d, idx) => `
      <div class="flex items-center gap-2 bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 p-2 rounded-lg">
        <span class="text-xs font-bold text-slate-400 dark:text-slate-600 w-12 text-center select-none font-mono">
          D-${idx + 1}
        </span>
        <input
          data-idx="${idx}"
          type="number"
          min="1"
          max="32"
          value="${d.s}"
          class="un-array-size-input w-16 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded px-1.5 py-1 text-center text-xs text-slate-800 dark:text-slate-100 font-mono focus:outline-none focus:ring-1 focus:ring-blue-500"
          aria-label="Array Disk Size"
        />
        <select
          data-idx="${idx}"
          class="un-array-media-select flex-grow bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-center text-xs text-slate-800 dark:text-slate-200 p-1"
          aria-label="Array Disk Media"
        >
          <option value="hdd5400" ${d.t === 'hdd5400' ? 'selected' : ''}>HDD (5400)</option>
          <option value="hdd" ${d.t === 'hdd' ? 'selected' : ''}>HDD (7200)</option>
          <option value="ssd" ${d.t === 'ssd' ? 'selected' : ''}>SATA SSD</option>
          <option value="nvme" ${d.t === 'nvme' ? 'selected' : ''}>NVMe SSD</option>
        </select>
        <button
          data-idx="${idx}"
          class="un-array-remove-btn text-slate-400 hover:text-red-550 dark:hover:text-red-400 hover:bg-slate-200 dark:hover:bg-slate-800 p-1 rounded-md transition-colors cursor-pointer"
          aria-label="Remove Array Disk"
        >
          ${getSVGIcon('x', 'w-3.5 h-3.5')}
        </button>
      </div>
    `).join('');

    // Array input binds
    listContainer.querySelectorAll('.un-array-size-input').forEach(el => {
      el.addEventListener('input', (e) => {
        const idx = parseInt((e.target as HTMLInputElement).dataset.idx!);
        const val = parseFloat((e.target as HTMLInputElement).value) || 0;
        STATE.unraid.arrayDisks[idx].s = val;
        recalculateUnraidUpdates();
      });
    });

    listContainer.querySelectorAll('.un-array-media-select').forEach(el => {
      el.addEventListener('change', (e) => {
        const idx = parseInt((e.target as HTMLSelectElement).dataset.idx!);
        const val = (e.target as HTMLSelectElement).value as MediaType;
        STATE.unraid.arrayDisks[idx].t = val;
        recalculateUnraidUpdates();
      });
    });

    listContainer.querySelectorAll('.un-array-remove-btn').forEach(el => {
      el.addEventListener('click', (e) => {
        const target = (e.target as HTMLElement).closest('button')!;
        const idx = parseInt(target.dataset.idx!);
        STATE.unraid.arrayDisks.splice(idx, 1);
        renderUnraidTab();
      });
    });
  };

  // Dynamic Cache drives template
  const renderUnraidCacheList = () => {
    const listContainer = document.getElementById('unCacheDisksDynamicList')!;
    listContainer.innerHTML = cacheDisks.map((d, idx) => `
      <div class="flex items-center gap-2 bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 p-2 rounded-lg">
        <span class="text-xs font-bold text-slate-400 dark:text-slate-600 w-12 text-center font-mono">
          C-${idx + 1}
        </span>
        <input
          data-idx="${idx}"
          type="number"
          min="1"
          max="16"
          value="${d.s}"
          class="un-cache-size-input w-16 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded px-1.5 py-1 text-center text-xs text-slate-800 dark:text-slate-100 font-mono focus:outline-none focus:ring-1 focus:ring-purple-500"
          aria-label="Cache Disk Size"
        />
        <select
          data-idx="${idx}"
          class="un-cache-media-select flex-grow bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-center text-xs text-slate-800 dark:text-slate-200 p-1"
          aria-label="Cache Disk Media"
        >
          <option value="nvme" ${d.t === 'nvme' ? 'selected' : ''}>NVMe SSD</option>
          <option value="ssd" ${d.t === 'ssd' ? 'selected' : ''}>SATA SSD</option>
        </select>
        <button
          data-idx="${idx}"
          class="un-cache-remove-btn text-slate-400 hover:text-red-550 dark:hover:text-red-400 hover:bg-slate-200 dark:hover:bg-slate-800 p-1 rounded-md transition-colors cursor-pointer"
          aria-label="Remove Cache Disk"
        >
          ${getSVGIcon('x', 'w-3.5 h-3.5')}
        </button>
      </div>
    `).join('');

    // Cache input binds
    listContainer.querySelectorAll('.un-cache-size-input').forEach(el => {
      el.addEventListener('input', (e) => {
        const idx = parseInt((e.target as HTMLInputElement).dataset.idx!);
        const val = parseFloat((e.target as HTMLInputElement).value) || 0;
        STATE.unraid.cacheDisks[idx].s = val;
        recalculateUnraidUpdates();
      });
    });

    listContainer.querySelectorAll('.un-cache-media-select').forEach(el => {
      el.addEventListener('change', (e) => {
        const idx = parseInt((e.target as HTMLSelectElement).dataset.idx!);
        const val = (e.target as HTMLSelectElement).value as MediaType;
        STATE.unraid.cacheDisks[idx].t = val;
        recalculateUnraidUpdates();
      });
    });

    listContainer.querySelectorAll('.un-cache-remove-btn').forEach(el => {
      el.addEventListener('click', (e) => {
        const target = (e.target as HTMLElement).closest('button')!;
        const idx = parseInt(target.dataset.idx!);
        STATE.unraid.cacheDisks.splice(idx, 1);
        renderUnraidTab();
      });
    });
  };

  renderUnraidArrayDisksList();
  renderUnraidCacheList();

  // 2. Render Capacity & Performance Metrics
  const renderUnraidMetrics = () => {
    metricsDiv.innerHTML = `
      <div class="space-y-6 animate-fade-in">
        <!-- Main Chassis metrics -->
        <h3 class="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest flex items-center gap-2">
          ${getSVGIcon('layers', 'w-4 h-4 text-slate-400')} Main Array Metrics
        </h3>
        <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div class="bg-white dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 p-4 rounded-xl shadow-sm">
            <p class="text-slate-455 dark:text-slate-400 text-[10px] font-bold uppercase tracking-widest mb-1 select-none">Usable Storage</p>
            <p class="text-xl font-black text-blue-600 dark:text-blue-400 font-mono">
              ${arrayDisks.length === 0 ? '0 TB' : `${arrayResults.usable.toFixed(1).replace(/\.0$/, '')} TB`}
            </p>
          </div>
          <div class="bg-white dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 p-4 rounded-xl shadow-sm">
            <p class="text-slate-455 dark:text-slate-400 text-[10px] font-bold uppercase tracking-widest mb-1 select-none">Parity Allocation</p>
            <p class="text-xl font-black text-emerald-600 dark:text-emerald-400 font-mono">
              ${arrayDisks.length === 0 ? '0 TB' : `${arrayResults.paritySize.toFixed(1).replace(/\.0$/, '')} TB`}
            </p>
          </div>
          <div class="bg-white dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 p-4 rounded-xl shadow-sm">
            <p class="text-slate-455 dark:text-slate-400 text-[10px] font-bold uppercase tracking-widest mb-1 select-none font-mono">Raw Capacity</p>
            <p class="text-xl font-black text-slate-800 dark:text-slate-200 font-mono">
              ${arrayResults.raw.toFixed(1).replace(/\.0$/, '')} TB
            </p>
          </div>
          <div class="bg-white dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 p-4 rounded-xl shadow-sm font-mono">
            <p class="text-slate-455 dark:text-slate-400 text-[10px] font-bold uppercase tracking-widest mb-1 select-none font-sans">Redundancy Level</p>
            <p class="text-[12px] font-black text-purple-600 dark:text-purple-400 mt-1 leading-tight select-none">
              ${arrayResults.faultToleranceText}
            </p>
          </div>
        </div>

        <!-- Array Speeds -->
        <div class="grid grid-cols-2 lg:grid-cols-4 gap-4 font-mono">
          <div class="bg-white dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 p-4 rounded-xl shadow-sm text-slate-900 dark:text-slate-100">
            <p class="text-slate-455 dark:text-slate-400 text-[10px] font-bold uppercase tracking-widest mb-1 select-none font-sans">Read Speed (Max)</p>
            <p class="text-lg font-bold text-indigo-650 dark:text-indigo-400">
              ${arrayDisks.length === 0 ? '0 MB/s' : formatSpeed(arrayResults.readSpeed)}
            </p>
            <p class="text-[9px] text-slate-400 dark:text-slate-500 font-sans mt-0.5 select-none leading-none">Single active read stream</p>
          </div>
          <div class="bg-white dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 p-4 rounded-xl shadow-sm text-slate-900 dark:text-slate-100">
            <p class="text-slate-455 dark:text-slate-400 text-[10px] font-bold uppercase tracking-widest mb-1 select-none font-sans">Write Speed (Est)</p>
            <p class="text-lg font-bold text-pink-650 dark:text-pink-400">
              ${arrayDisks.length === 0 ? '0 MB/s' : formatSpeed(arrayResults.writeSpeed)}
            </p>
            <p class="text-[9px] text-slate-405 dark:text-slate-500 font-sans mt-0.5 select-none leading-none">
              ${arrayResults.writeMethodText}
            </p>
          </div>
          <div class="bg-white dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 p-4 rounded-xl shadow-sm col-span-2 flex flex-col justify-between text-slate-900 dark:text-slate-100 font-sans">
            <div>
              <p class="text-slate-455 dark:text-slate-400 text-[10px] font-bold uppercase tracking-widest mb-1 select-none font-sans font-sans">Est. Parity Rebuild</p>
              <p class="text-lg font-bold text-amber-600 dark:text-amber-500 font-mono">
                ${arrayResults.rebuildTimeText}
              </p>
            </div>
            <p class="text-[9px] text-slate-400 dark:text-slate-500 font-sans leading-none mt-1 select-none">Estimations by largest active array disk</p>
          </div>
        </div>

        <!-- Cache pool Metrics -->
        <h3 class="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest flex items-center gap-2 pt-2">
          ${getSVGIcon('database', 'w-4 h-4 text-slate-400')} Cache Pool Metrics
        </h3>
        <div class="grid grid-cols-2 lg:grid-cols-4 gap-4 animate-fade-in">
          <div class="bg-white dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 p-4 rounded-xl shadow-sm">
            <p class="text-slate-455 dark:text-slate-400 text-[10px] font-bold uppercase tracking-widest mb-1 select-none">Cache Usable</p>
            <p class="text-xl font-black text-purple-650 dark:text-purple-400 font-mono">
              ${cacheDisks.length === 0 ? '0 TB' : `${cacheResults.usable.toFixed(1).replace(/\.0$/, '')} TB`}
            </p>
          </div>
          <div class="bg-white dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 p-4 rounded-xl shadow-sm">
            <p class="text-slate-455 dark:text-slate-400 text-[10px] font-bold uppercase tracking-widest mb-1 select-none">Cache Protection</p>
            <p class="text-xl font-black text-slate-500 dark:text-slate-400 font-mono">
              ${cacheDisks.length === 0 ? '0 TB' : `${cacheResults.protection.toFixed(1).replace(/\.0$/, '')} TB`}
            </p>
          </div>
          <div class="bg-white dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 p-4 rounded-xl shadow-sm font-mono">
            <p class="text-slate-455 dark:text-slate-400 text-[10px] font-bold uppercase tracking-widest mb-1 select-none font-sans">Cache Raw Size</p>
            <p class="text-xl font-black text-slate-705 dark:text-slate-200">
              ${cacheResults.raw.toFixed(1).replace(/\.0$/, '')} TB
            </p>
          </div>
          <div class="bg-white dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 p-4 rounded-xl shadow-sm">
            <p class="text-slate-455 dark:text-slate-400 text-[10px] font-bold uppercase tracking-widest mb-1 select-none">Cache Layout Mode</p>
            <p class="text-[10px] font-black text-slate-600 dark:text-slate-400 mt-1 leading-tight uppercase font-mono">
              ${cacheResults.profileText.replace('_', ' ')}
            </p>
          </div>
        </div>

        <!-- Cache Speeds -->
        <div class="grid grid-cols-2 lg:grid-cols-4 gap-4 font-mono animate-fade-in">
          <div class="bg-white dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 p-4 rounded-xl shadow-sm text-slate-900 dark:text-slate-100">
            <p class="text-slate-455 dark:text-slate-400 text-[10px] font-bold uppercase tracking-widest mb-1 select-none font-sans">Cache Read</p>
            <p class="text-lg font-bold text-indigo-650 dark:text-indigo-400">
              ${cacheDisks.length === 0 ? '0 MB/s' : formatSpeed(cacheResults.readSpeed)}
            </p>
            <p class="text-[9px] text-slate-404 dark:text-slate-500 font-sans mt-0.5 leading-none select-none">
              ${cacheDisks.length === 0 ? '0' : formatIOPS(cacheResults.readIops)} IOPS
            </p>
          </div>
          <div class="bg-white dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 p-4 rounded-xl shadow-sm text-slate-900 dark:text-slate-100">
            <p class="text-slate-455 dark:text-slate-400 text-[10px] font-bold uppercase tracking-widest mb-1 select-none font-sans font-sans">Cache Write</p>
            <p class="text-lg font-bold text-pink-650 dark:text-pink-400">
              ${cacheDisks.length === 0 ? '0 MB/s' : formatSpeed(cacheResults.writeSpeed)}
            </p>
            <p class="text-[9px] text-slate-404 dark:text-slate-500 font-sans mt-0.5 leading-none select-none">
              ${cacheDisks.length === 0 ? '0' : formatIOPS(cacheResults.writeIops)} IOPS
            </p>
          </div>
          <div class="bg-white dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 p-4 rounded-xl shadow-sm col-span-2 flex flex-col justify-between text-slate-900 dark:text-slate-100 font-sans">
            <div>
              <p class="text-slate-455 dark:text-slate-400 text-[10px] font-bold uppercase tracking-widest mb-1 select-none font-sans">Cache Rebuild Time</p>
              <p class="text-lg font-bold text-amber-650 dark:text-amber-500 font-mono">${cacheResults.rebuildTimeText}</p>
            </div>
            <p class="text-[9px] text-slate-400 dark:text-slate-500 font-sans leading-none mt-1 select-none">Full rebuild under ideal SSD write throughputs</p>
          </div>
        </div>
      </div>
    `;
    renderStatusBox(activeStatus);
  };

  renderUnraidMetrics();

  // 3. Draw Chassis visualizer
  const renderUnraidChassis = () => {
    const displayABaysCount = Math.max(24, Math.ceil(arrayDisks.length / 6) * 6);
    const displayCBaysCount = Math.max(6, Math.ceil(cacheDisks.length / 2) * 2);

    // Build main bays
    let arrayBaysHTML = '';
    // Unraid assigns largest disks (sorted first) to parity
    const sortedArrayDisks = [...arrayDisks].sort((a, b) => b.s - a.s);

    for (let i = 1; i <= displayABaysCount; i++) {
      const isPopulated = i <= arrayDisks.length;
      if (isPopulated) {
        const diskRaw = sortedArrayDisks[i - 1];
        const isParity = i <= parityCount;
        arrayBaysHTML += buildDriveBayHTML(i, true, diskRaw.s, diskRaw.t, isParity);
      } else {
        arrayBaysHTML += buildDriveBayHTML(i, false);
      }
    }

    // Build cache bays
    let cacheBaysHTML = '';
    for (let i = 1; i <= displayCBaysCount; i++) {
      const isPopulated = i <= cacheDisks.length;
      if (isPopulated) {
        const diskRaw = cacheDisks[i - 1];
        cacheBaysHTML += buildDriveBayHTML(i, true, diskRaw.s, diskRaw.t, false);
      } else {
        cacheBaysHTML += buildDriveBayHTML(i, false);
      }
    }

    chassisDiv.innerHTML = `
      <div class="pt-2 grid grid-cols-1 md:grid-cols-12 gap-6 select-none animate-fade-in">
        <!-- Main Chassis -->
        <div class="md:col-span-8 flex flex-col">
          <h4 class="text-[10px] font-bold text-slate-500 dark:text-slate-450 uppercase tracking-widest mb-2 flex items-center gap-1.5">
            ${getSVGIcon('layers', 'w-3.5 h-3.5 text-blue-500')} Main Chassis (${displayABaysCount}-bay)
          </h4>
          <div class="bg-white dark:bg-slate-850 rounded-xl p-4 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col gap-2 relative overflow-y-auto max-h-[300px] custom-scrollbar flex-grow">
            <div class="grid grid-cols-6 gap-2">
              ${arrayBaysHTML}
            </div>
          </div>
        </div>

        <!-- Cache Pools -->
        <div class="md:col-span-4 flex flex-col">
          <h4 class="text-[10px] font-bold text-purple-600 dark:text-purple-400 mr-2 uppercase tracking-widest mb-2 flex items-center gap-1.5">
            ${getSVGIcon('database', 'w-3.5 h-3.5 text-purple-600')} Cache Pool (${displayCBaysCount}-bay)
          </h4>
          <div class="bg-white dark:bg-slate-850 rounded-xl p-4 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col gap-2 relative overflow-y-auto max-h-[300px] custom-scrollbar flex-grow">
            <div class="grid grid-cols-2 gap-2">
              ${cacheBaysHTML}
            </div>
          </div>
        </div>
      </div>
    `;
  };

  renderUnraidChassis();

  // Helper recalculating inputs on changes
  const recalculateUnraidUpdates = () => {
    const arrayRes = calculateUnraidArray(STATE.unraid.arrayDisks, parityCount, fileSystem, writeMethod);
    const cacheRes = calculateUnraidCache(STATE.unraid.cacheDisks, cacheMode);

    let activeStatusUpd = arrayRes.status;
    if (arrayRes.status.severity === 'error') {
      activeStatusUpd = arrayRes.status;
    } else if (cacheRes.status && cacheRes.status.severity === 'error') {
      activeStatusUpd = cacheRes.status;
    } else if (arrayRes.status.severity === 'warning') {
      activeStatusUpd = arrayRes.status;
    } else if (cacheRes.status && cacheRes.status.severity === 'warning') {
      activeStatusUpd = cacheRes.status;
    } else if (arrayRes.status.severity === 'suboptimal') {
      activeStatusUpd = arrayRes.status;
    } else if (cacheRes.status && cacheRes.status.severity === 'suboptimal') {
      activeStatusUpd = cacheRes.status;
    } else if (arrayRes.status.severity === 'info') {
      activeStatusUpd = arrayRes.status;
    } else if (cacheRes.status && cacheRes.status.severity === 'info') {
      activeStatusUpd = cacheRes.status;
    }

    renderUnraidMetrics();
    renderUnraidChassis();
  };

  // Bind Dynamic Settings Actions
  document.getElementById('unFSSelect')!.addEventListener('change', (e) => {
    STATE.unraid.fileSystem = (e.target as HTMLSelectElement).value as 'xfs' | 'btrfs' | 'zfs';
    recalculateUnraidUpdates();
  });

  document.getElementById('unParitySelect')!.addEventListener('change', (e) => {
    const p = parseInt((e.target as HTMLSelectElement).value);
    STATE.unraid.parityCount = p;
    // Enable/disable write reconstruction select
    const wrSelect = document.getElementById('unWriteMethodSelect') as HTMLSelectElement;
    if (wrSelect) {
      if (p === 0) {
        wrSelect.disabled = true;
      } else {
        wrSelect.disabled = false;
      }
    }
    recalculateUnraidUpdates();
  });

  document.getElementById('unWriteMethodSelect')!.addEventListener('change', (e) => {
    STATE.unraid.writeMethod = (e.target as HTMLSelectElement).value as 'auto' | 'reconstruct';
    recalculateUnraidUpdates();
  });

  document.getElementById('unCacheModeSelect')!.addEventListener('change', (e) => {
    STATE.unraid.cacheMode = (e.target as HTMLSelectElement).value;
    recalculateUnraidUpdates();
  });

  // Dynamic lists buttons
  document.getElementById('unAddNewArrayDisk')!.addEventListener('click', () => {
    if (arrayDisks.length >= 30) return;
    const last = arrayDisks[arrayDisks.length - 1] || { s: 18, t: 'hdd' };
    STATE.unraid.arrayDisks.push({ ...last });
    renderUnraidTab();
  });

  document.getElementById('unAddNewCacheDisk')!.addEventListener('click', () => {
    if (cacheDisks.length >= 30) return;
    const last = cacheDisks[cacheDisks.length - 1] || { s: 2, t: 'nvme' };
    STATE.unraid.cacheDisks.push({ ...last });
    renderUnraidTab();
  });
}

export function renderBtrfsTab() {
  const settingsDiv = document.getElementById('tabSettingsPanel')!;
  const metricsDiv = document.getElementById('tabMetricsContainer')!;
  const chassisDiv = document.getElementById('tabChassisContainer')!;

  const { disks, profile } = STATE.btrfs;
  const results = calculateBtrfsPool(disks, profile);

  // 1. Render controls panel
  settingsDiv.innerHTML = `
    <div class="space-y-6 animate-fade-in">
      <div>
        <h2 class="text-sm font-bold flex items-center gap-2 mb-4 text-slate-850 dark:text-slate-200 uppercase tracking-wider">
          ${getSVGIcon('compass', 'w-4 h-4 text-slate-400')} BTRFS OS
        </h2>

        <div class="space-y-4">
          <div class="space-y-1">
            <label class="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide mr-1" htmlFor="btProfileSelect">
              BTRFS Profile:
            </label>
            <select
              id="btProfileSelect"
              class="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg py-2.5 px-3 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-500 appearance-none cursor-pointer text-xs font-medium"
            >
              <option value="single" ${profile === 'single' ? 'selected' : ''}>Single (Data) / DUP (Metadata)</option>
              <option value="raid0" ${profile === 'raid0' ? 'selected' : ''}>RAID 0 (Stripe)</option>
              <option value="raid1" ${profile === 'raid1' ? 'selected' : ''}>RAID 1 (2-Way Mirror)</option>
              <option value="raid1c3" ${profile === 'raid1c3' ? 'selected' : ''}>RAID 1c3 (3-Way Mirror)</option>
              <option value="raid1c4" ${profile === 'raid1c4' ? 'selected' : ''}>RAID 1c4 (4-Way Mirror)</option>
              <option value="raid5" ${profile === 'raid5' ? 'selected' : ''}>RAID 5 (1 Parity)</option>
              <option value="raid6" ${profile === 'raid6' ? 'selected' : ''}>RAID 6 (2 Parity)</option>
              <option value="raid10" ${profile === 'raid10' ? 'selected' : ''}>RAID 10 (Striped Mirrors)</option>
            </select>
          </div>
        </div>

        <!-- Pool disks dynamic rows -->
        <div class="space-y-2 mt-6">
          <div class="flex justify-between items-center text-xs font-bold text-slate-500 dark:text-slate-400 uppercase border-b border-slate-200 dark:border-slate-800 pb-2 mb-2">
            <span class="text-slate-700 dark:text-slate-300 font-bold">Pool Disks (${disks.length}/24)</span>
            <button
              id="btAddNewPoolDisk"
              class="text-[10px] bg-emerald-600 hover:bg-emerald-750 text-white font-bold px-2.5 py-1.5 rounded-lg flex items-center gap-1 transition-all uppercase tracking-wide cursor-pointer"
              ${disks.length >= 24 ? 'disabled' : ''}
            >
              ${getSVGIcon('plus', 'w-3 h-3')} Add
            </button>
          </div>

          <div class="space-y-2" id="btDynamicDisksListContainer">
            <!-- Dynamic rows inside list render -->
          </div>
        </div>
      </div>
    </div>
  `;

  // Draw Dynamic List Rows
  const renderBtrfsDisksDynamicRows = () => {
    const listContainer = document.getElementById('btDynamicDisksListContainer')!;
    listContainer.innerHTML = disks.map((d, idx) => `
      <div class="flex items-center gap-2 bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 p-2 rounded-lg">
        <span class="text-xs font-bold text-slate-400 dark:text-slate-600 w-12 text-center select-none font-mono">
          Disk ${idx + 1}
        </span>
        <input
          data-idx="${idx}"
          type="number"
          min="1"
          max="32"
          value="${d.s}"
          class="bt-drive-size-input w-16 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded px-1.5 py-1 text-center text-xs text-slate-800 dark:text-slate-100 font-mono focus:outline-none focus:ring-1 focus:ring-emerald-500"
          aria-label="Btrfs Disk Size"
        />
        <select
          data-idx="${idx}"
          class="bt-drive-media-select flex-grow bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-center text-xs text-slate-800 dark:text-slate-200 p-1"
          aria-label="Btrfs Disk Media"
        >
          <option value="nvme" ${d.t === 'nvme' ? 'selected' : ''}>NVMe PCIe</option>
          <option value="ssd" ${d.t === 'ssd' ? 'selected' : ''}>SATA SSD</option>
          <option value="hdd" ${d.t === 'hdd' ? 'selected' : ''}>7200 RPM HDD</option>
        </select>
        <button
          data-idx="${idx}"
          class="bt-drive-remove-btn text-slate-400 hover:text-red-550 dark:hover:text-red-400 hover:bg-slate-200 dark:hover:bg-slate-800 p-1 rounded-md transition-colors cursor-pointer"
          aria-label="Remove Btrfs Disk"
        >
          ${getSVGIcon('x', 'w-3.5 h-3.5')}
        </button>
      </div>
    `).join('');

    // Bind events
    listContainer.querySelectorAll('.bt-drive-size-input').forEach(el => {
      el.addEventListener('input', (e) => {
        const idx = parseInt((e.target as HTMLInputElement).dataset.idx!);
        const val = parseFloat((e.target as HTMLInputElement).value) || 0;
        STATE.btrfs.disks[idx].s = val;
        recalculateBtrfsUnits();
      });
    });

    listContainer.querySelectorAll('.bt-drive-media-select').forEach(el => {
      el.addEventListener('change', (e) => {
        const idx = parseInt((e.target as HTMLSelectElement).dataset.idx!);
        const val = (e.target as HTMLSelectElement).value as MediaType;
        STATE.btrfs.disks[idx].t = val;
        recalculateBtrfsUnits();
      });
    });

    listContainer.querySelectorAll('.bt-drive-remove-btn').forEach(el => {
      el.addEventListener('click', (e) => {
        const target = (e.target as HTMLElement).closest('button')!;
        const idx = parseInt(target.dataset.idx!);
        STATE.btrfs.disks.splice(idx, 1);
        renderBtrfsTab();
      });
    });
  };

  renderBtrfsDisksDynamicRows();

  // 2. Render capacity results
  const renderBtrfsMetrics = () => {
    metricsDiv.innerHTML = `
      <div class="space-y-6">
        <div class="grid grid-cols-2 lg:grid-cols-4 gap-4 animate-fade-in">
          <div class="bg-white dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 p-4 rounded-xl shadow-sm">
            <p class="text-slate-455 dark:text-slate-400 text-[10px] font-bold uppercase tracking-widest mb-1 select-none">Est. Usable</p>
            <p class="text-xl font-black text-emerald-600 dark:text-emerald-400 font-mono">
              ${results.usable === 0 ? '0 TB' : `${results.usable.toFixed(1).replace(/\.0$/, '')} TB`}
            </p>
          </div>
          <div class="bg-white dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 p-4 rounded-xl shadow-sm">
            <p class="text-slate-455 dark:text-slate-400 text-[10px] font-bold uppercase tracking-widest mb-1 select-none">Protection Overhead</p>
            <p class="text-xl font-black text-slate-500 dark:text-slate-400 font-mono">
              ${results.usable === 0 ? '0 TB' : `${results.protection.toFixed(1).replace(/\.0$/, '')} TB`}
            </p>
          </div>
          <div class="bg-white dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 p-4 rounded-xl shadow-sm font-mono">
            <p class="text-slate-455 dark:text-slate-400 text-[10px] font-bold uppercase tracking-widest mb-1 select-none font-sans">Raw Capacity</p>
            <p class="text-xl font-black text-slate-800 dark:text-slate-200">
              ${results.raw.toFixed(1).replace(/\.0$/, '')} TB
            </p>
          </div>
          <div class="bg-white dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 p-4 rounded-xl shadow-sm theme-text">
            <p class="text-slate-455 dark:text-slate-400 text-[10px] font-bold uppercase tracking-widest mb-1 select-none">Fault Tolerance</p>
            <p class="text-[12px] font-black text-emerald-600 mt-1 dark:text-emerald-400 leading-tight uppercase font-mono">
              ${results.faultToleranceText}
            </p>
          </div>
        </div>

        <h3 class="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest flex items-center gap-2 pt-2">
          ${getSVGIcon('gauge', 'w-4 h-4 text-slate-400')} Performance Estimates
        </h3>
        <div class="grid grid-cols-2 lg:grid-cols-4 gap-4 font-mono">
          <div class="bg-white dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 p-4 rounded-xl shadow-sm">
            <p class="text-slate-455 dark:text-slate-400 text-[10px] font-bold uppercase tracking-widest mb-1 select-none font-sans">Read Throughput</p>
            <p class="text-lg font-bold text-indigo-650 dark:text-indigo-400">
              ${disks.length === 0 ? '0' : formatSpeed(results.readSpeed)}
            </p>
            <p class="text-[9px] text-slate-401 dark:text-slate-500 font-sans mt-0.5 leading-none select-none">
              ${disks.length === 0 ? '0' : formatIOPS(results.readIops)} IOPS
            </p>
          </div>
          <div class="bg-white dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 p-4 rounded-xl shadow-sm">
            <p class="text-slate-455 dark:text-slate-400 text-[10px] font-bold uppercase tracking-widest mb-1 select-none font-sans">Write Throughput</p>
            <p class="text-lg font-bold text-pink-655 dark:text-pink-400">
              ${disks.length === 0 ? '0' : formatSpeed(results.writeSpeed)}
            </p>
            <p class="text-[9px] text-slate-401 dark:text-slate-500 font-sans mt-0.5 leading-none select-none">
              ${disks.length === 0 ? '0' : formatIOPS(results.writeIops)} IOPS
            </p>
          </div>
          <div class="bg-white dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 p-4 rounded-xl col-span-2 shadow-sm font-sans flex flex-col justify-between">
            <div>
              <p class="text-slate-455 dark:text-slate-400 text-[10px] font-bold uppercase tracking-widest mb-1 select-none font-sans">Est. Rebalance / Rebuild</p>
              <p class="text-lg font-bold text-amber-500 font-mono">${results.rebuildTimeText}</p>
            </div>
            <p class="text-[9px] text-slate-400 dark:text-slate-500 mt-1 select-none leading-none">Full BTRFS balance under ideal write conditions</p>
          </div>
        </div>
      </div>
    `;

    renderStatusBox(results.status);
  };

  renderBtrfsMetrics();

  // 3. Render dynamic chassis array bays
  const renderBtrfsChassis = () => {
    const displayBaysCount = Math.max(24, Math.ceil(disks.length / 6) * 6);
    let baysHTML = '';

    for (let i = 1; i <= displayBaysCount; i++) {
      const isPopulated = i <= disks.length;
      if (isPopulated) {
        const diskRaw = disks[i - 1];
        // Mirror paths render visual parity alerts on redundant blocks
        const isParity = i > 1 && (
          profile === 'raid1' ? (i % 2 === 0) :
          profile === 'raid1c3' ? (i % 3 !== 1) :
          profile === 'raid1c4' ? (i % 4 !== 1) :
          profile === 'raid5' ? (i === disks.length) :
          profile === 'raid6' ? (i > disks.length - 2) :
          profile === 'raid10' ? (i % 2 === 0) :
          false
        );
        baysHTML += buildDriveBayHTML(i, true, diskRaw.s, diskRaw.t, isParity);
      } else {
        baysHTML += buildDriveBayHTML(i, false);
      }
    }

    chassisDiv.innerHTML = `
      <div class="pt-2">
        <h4 class="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-1.5">
          ${getSVGIcon('compass', 'w-3.5 h-3.5 text-emerald-500')} Native Pool Layout (${displayBaysCount}-bay layout)
        </h4>
        <div class="bg-white dark:bg-slate-850 rounded-xl p-4 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col gap-2 relative overflow-y-auto max-h-[300px] custom-scrollbar flex-grow">
          <div class="grid grid-cols-6 gap-2">
            ${baysHTML}
          </div>
        </div>
      </div>
    `;
  };

  renderBtrfsChassis();

  const recalculateBtrfsUnits = () => {
    const updResult = calculateBtrfsPool(STATE.btrfs.disks, profile);
    renderBtrfsMetrics();
    renderBtrfsChassis();
  };

  // Bind Listeners
  document.getElementById('btProfileSelect')!.addEventListener('change', (e) => {
    STATE.btrfs.profile = (e.target as HTMLSelectElement).value;
    recalculateBtrfsUnits();
  });

  document.getElementById('btAddNewPoolDisk')!.addEventListener('click', () => {
    if (disks.length >= 24) return;
    const last = disks[disks.length - 1] || { s: 4, t: 'nvme' };
    STATE.btrfs.disks.push({ ...last });
    renderBtrfsTab();
  });
}

export function renderNutanixTab() {
  const settingsDiv = document.getElementById('tabSettingsPanel')!;
  const metricsDiv = document.getElementById('tabMetricsContainer')!;
  const chassisDiv = document.getElementById('tabChassisContainer')!;

  // Clear any generic status box alerts from other tabs
  document.getElementById('statusBoxContainer')!.innerHTML = '';

  const { nodes, hddSize, ssdSize, ecEnabled, compressionEnabled, dedupeEnabled } = STATE.nutanix;

  const resRF2 = calculateNutanixCluster(nodes, hddSize, ssdSize, 2, ecEnabled, compressionEnabled, dedupeEnabled);
  const resRF3 = calculateNutanixCluster(nodes, hddSize, ssdSize, 3, ecEnabled, compressionEnabled, dedupeEnabled);

  // 1. Render Controls
  settingsDiv.innerHTML = `
    <div class="space-y-6 animate-fade-in">
      <h2 class="text-sm font-bold flex items-center gap-2 mb-4 text-slate-800 dark:text-slate-200 uppercase tracking-wider">
        ${getSVGIcon('settings', 'w-4 h-4 text-slate-400')} Nutanix HCI Config
      </h2>

      <!-- Number of Nodes Configuration -->
      <div class="space-y-2">
        <div class="flex justify-between items-center text-xs font-bold text-slate-500 dark:text-slate-400 uppercase">
          <span>Cluster Nodes:</span>
          <span class="text-blue-600 dark:text-blue-400 font-mono text-sm" id="nutNodesLabel">${nodes}</span>
        </div>
        <input
          id="nutNodesSlider"
          type="range"
          min="1"
          max="32"
          value="${nodes}"
          class="w-full h-1.5 bg-slate-200 dark:bg-slate-800 rounded-lg appearance-none cursor-pointer accent-blue-600"
        />
        <div class="flex justify-between text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase">
          <span>1 Node</span>
          <span>32 Nodes</span>
        </div>
      </div>

      <!-- Total HDD size for Cluster -->
      <div class="space-y-1.5">
        <label class="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
          Total HDD Capacity (TB):
        </label>
        <div class="relative">
          <input
            id="nutHDDInput"
            type="number"
            min="0"
            max="10240"
            step="1"
            value="${hddSize || '0'}"
            class="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg py-2 pl-3 pr-12 text-slate-900 dark:text-slate-100 font-mono text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
          <span class="absolute right-3 top-2.5 text-slate-400 dark:text-slate-500 text-xs font-mono font-bold">TB</span>
        </div>
      </div>

      <!-- Total SSD size for Cluster -->
      <div class="space-y-1.5">
        <label class="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
          Total SSD/NVMe Capacity (TB):
        </label>
        <div class="relative">
          <input
            id="nutSSDInput"
            type="number"
            min="0"
            max="10240"
            step="0.1"
            value="${ssdSize || '0'}"
            class="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg py-2 pl-3 pr-12 text-slate-900 dark:text-slate-100 font-mono text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
          <span class="absolute right-3 top-2.5 text-slate-400 dark:text-slate-500 text-xs font-mono font-bold">TB</span>
        </div>
      </div>

      <!-- Erasure Coding Toggle -->
      <div class="pt-2">
        <label class="flex items-center gap-2.5 cursor-pointer text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wide select-none">
          <input
            id="nutECXCheck"
            type="checkbox"
            ${ecEnabled ? 'checked' : ''}
            class="w-4.5 h-4.5 text-blue-600 rounded border-slate-300 focus:ring-blue-500 accent-blue-600 cursor-pointer"
          />
          <span>Enable Erasure Coding (EC-X)</span>
        </label>
        <p class="text-[10px] text-slate-500 dark:text-slate-400 ml-7 mt-1.5 leading-tight select-none">
          <strong>Best for:</strong> Cold data, backups, and archives.<br/>
          <strong>Impact:</strong> Increases usable space (up to ~80% efficiency). Minor CPU overhead during writes. Requires min 4 nodes for RF2, and min 6 nodes for RF3.
        </p>
      </div>

      <!-- Compression Toggle -->
      <div class="pt-1">
        <label class="flex items-center gap-2.5 cursor-pointer text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wide select-none">
          <input
            id="nutCompCheck"
            type="checkbox"
            ${compressionEnabled ? 'checked' : ''}
            class="w-4.5 h-4.5 text-blue-600 rounded border-slate-300 focus:ring-blue-500 accent-blue-600 cursor-pointer"
          />
          <span>Enable Inline Compression</span>
        </label>
        <p class="text-[10px] text-slate-500 dark:text-slate-400 ml-7 mt-1.5 leading-tight select-none">
          <strong>Best for:</strong> General workloads, databases, text/log data.<br/>
          <strong>Impact:</strong> Moderate space savings (~1.5x) with minimal performance penalty. Highly recommended for most workloads.
        </p>
      </div>

      <!-- Deduplication Toggle -->
      <div class="pt-1">
        <label class="flex items-center gap-2.5 cursor-pointer text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wide select-none">
          <input
            id="nutDedupeCheck"
            type="checkbox"
            ${dedupeEnabled ? 'checked' : ''}
            class="w-4.5 h-4.5 text-blue-600 rounded border-slate-300 focus:ring-blue-500 accent-blue-600 cursor-pointer"
          />
          <span>Enable Deduplication</span>
        </label>
        <p class="text-[10px] text-slate-500 dark:text-slate-400 ml-7 mt-1.5 leading-tight select-none">
          <strong>Best for:</strong> VDI environments and full-clone VMs.<br/>
          <strong>Impact:</strong> Extra space savings (~1.3x) but may severely impact CPU/RAM on clusters with < 3 nodes. Use cautiously on general workloads.
        </p>
      </div>
    </div>
  `;

  freshMetricsAndChassisForNutanix(resRF2, resRF3);

  // Bind Listeners
  const recalculateNutanixUnits = () => {
    const fresh2 = calculateNutanixCluster(STATE.nutanix.nodes, STATE.nutanix.hddSize, STATE.nutanix.ssdSize, 2, STATE.nutanix.ecEnabled, STATE.nutanix.compressionEnabled, STATE.nutanix.dedupeEnabled);
    const fresh3 = calculateNutanixCluster(STATE.nutanix.nodes, STATE.nutanix.hddSize, STATE.nutanix.ssdSize, 3, STATE.nutanix.ecEnabled, STATE.nutanix.compressionEnabled, STATE.nutanix.dedupeEnabled);
    freshMetricsAndChassisForNutanix(fresh2, fresh3);
  };

  document.getElementById('nutNodesSlider')!.addEventListener('input', (e) => {
    const val = parseInt((e.target as HTMLInputElement).value);
    STATE.nutanix.nodes = val;
    document.getElementById('nutNodesLabel')!.innerText = val.toString();
    recalculateNutanixUnits();
  });

  document.getElementById('nutHDDInput')!.addEventListener('input', (e) => {
    STATE.nutanix.hddSize = parseFloat((e.target as HTMLInputElement).value) || 0;
    recalculateNutanixUnits();
  });

  document.getElementById('nutSSDInput')!.addEventListener('input', (e) => {
    STATE.nutanix.ssdSize = parseFloat((e.target as HTMLInputElement).value) || 0;
    recalculateNutanixUnits();
  });

  document.getElementById('nutECXCheck')!.addEventListener('change', (e) => {
    STATE.nutanix.ecEnabled = (e.target as HTMLInputElement).checked;
    recalculateNutanixUnits();
  });

  document.getElementById('nutCompCheck')!.addEventListener('change', (e) => {
    STATE.nutanix.compressionEnabled = (e.target as HTMLInputElement).checked;
    recalculateNutanixUnits();
  });

  document.getElementById('nutDedupeCheck')!.addEventListener('change', (e) => {
    STATE.nutanix.dedupeEnabled = (e.target as HTMLInputElement).checked;
    recalculateNutanixUnits();
  });
}

function renderNutanixMetricsComparison(title: string, results: NutanixResult) {
  const usableTiB = results.usable === 0 ? '0.00' : (results.usable * (1000**4 / 1024**4)).toFixed(2);
  const effTiB = results.effectiveUsable === 0 ? '0.00' : (results.effectiveUsable * (1000**4 / 1024**4)).toFixed(2);
  
  const pctUsable = results.raw > 0 ? (results.usable / results.raw) * 100 : 0;
  const pctProtection = results.raw > 0 ? (results.protection / results.raw) * 100 : 0;
  const pctCvm = results.raw > 0 ? (results.cvmOverhead / results.raw) * 100 : 0;

  return `
    <div class="col-span-1 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-5 flex flex-col h-full bg-white dark:bg-slate-800/40 shadow-sm animate-fade-in relative overflow-hidden">
      <!-- subtle background element -->
      <div class="absolute top-0 right-0 -mr-4 -mt-4 opacity-5 pointer-events-none">
        ${getSVGIcon('layers', 'w-32 h-32')}
      </div>
      
      <div class="flex items-center gap-2 text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-widest border-b border-slate-200 dark:border-slate-800 pb-3 relative z-10">
        ${title} <span class="text-[10px] bg-slate-100 text-slate-700 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 dark:text-slate-300 px-2 py-0.5 rounded-full font-mono ml-auto">FT: ${results.faultToleranceText}</span>
      </div>
      
      <!-- Visual Stacked Bar Chart -->
      <div class="relative z-10">
        <h4 class="text-[9px] font-bold text-slate-500 uppercase tracking-widest mb-1.5 flex items-center justify-between">
          <span>Raw Allocation</span>
          <span class="text-slate-800 dark:text-slate-200 font-mono font-black">${results.raw.toFixed(1).replace(/\.0$/, '')} TB Total</span>
        </h4>
        <div class="w-full h-6 flex rounded overflow-hidden bg-slate-200 dark:bg-slate-800 shadow-inner">
           <div style="width: ${pctUsable}%" class="bg-blue-500 hover:opacity-90 transition-opacity flex items-center justify-center text-[10px] font-mono font-bold text-white shadow-inner whitespace-nowrap overflow-hidden" title="Usable Space">${pctUsable > 15 ? pctUsable.toFixed(0)+'%' : ''}</div>
           <div style="width: ${pctProtection}%" class="bg-emerald-500 hover:opacity-90 transition-opacity flex items-center justify-center text-[10px] font-mono font-bold text-white shadow-inner whitespace-nowrap overflow-hidden" title="Protection Overhead">${pctProtection > 15 ? pctProtection.toFixed(0)+'%' : ''}</div>
           <div style="width: ${pctCvm}%" class="bg-purple-500 hover:opacity-90 transition-opacity flex items-center justify-center text-[10px] font-mono font-bold text-white shadow-inner whitespace-nowrap overflow-hidden" title="CVM Overlay">${pctCvm > 15 ? pctCvm.toFixed(0)+'%' : ''}</div>
        </div>
        <div class="flex items-center mt-2 text-[9px] font-mono font-bold uppercase gap-2 flex-wrap">
           <span class="text-blue-600 dark:text-blue-400 flex items-center gap-1"><span class="w-2 h-2 rounded bg-blue-500 inline-block shadow-sm"></span> Usable</span>
           <span class="text-emerald-600 dark:text-emerald-400 flex items-center gap-1 ml-auto"><span class="w-2 h-2 rounded bg-emerald-500 inline-block shadow-sm"></span> Protection</span>
           <span class="text-purple-600 dark:text-purple-400 flex items-center gap-1"><span class="w-2 h-2 rounded bg-purple-500 inline-block shadow-sm"></span> CVM</span>
        </div>
      </div>

      <!-- Capacity Grid -->
      <div class="grid grid-cols-2 gap-3 relative z-10">
        <div class="bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 p-3.5 rounded-xl shadow-sm">
          <p class="text-slate-455 dark:text-slate-400 text-[9px] font-bold uppercase tracking-widest mb-1 select-none">Base Usable</p>
          <p class="text-lg font-black text-slate-800 dark:text-slate-200 font-mono leading-none">${results.usable.toFixed(1).replace(/\.0$/, '')} TB</p>
          <p class="text-[9px] text-slate-400 dark:text-slate-500 font-mono mt-1.5 select-none">~${usableTiB} TiB binary</p>
        </div>
        <div class="bg-blue-50/50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800/30 p-3.5 rounded-xl shadow-sm">
          <p class="text-blue-600 dark:text-blue-400 text-[9px] font-bold uppercase tracking-widest mb-1 select-none flex items-center gap-1">${getSVGIcon('gauge', 'w-3 h-3')} Effective</p>
          <p class="text-lg font-black text-blue-600 dark:text-blue-400 font-mono leading-none">${results.effectiveUsable.toFixed(1).replace(/\.0$/, '')} TB</p>
           <p class="text-[9px] text-slate-400 dark:text-slate-500 font-mono mt-1.5 select-none">~${effTiB} TiB (${results.dataReductionRatio.toFixed(1)}x ratio)</p>
        </div>
      </div>

      <!-- Performance Estimations -->
      <div class="bg-slate-50/50 dark:bg-slate-900/50 rounded-xl p-3 shadow-inner border border-slate-200 dark:border-slate-800 relative z-10 mt-auto">
        <p class="text-[9px] font-bold text-slate-500 uppercase tracking-widest mb-2 border-b border-slate-200 dark:border-slate-700 pb-1.5">Performance Envelope</p>
        <div class="grid grid-cols-3 gap-3 font-mono text-slate-900 dark:text-slate-100">
          <div class="flex flex-col">
            <span class="text-[8px] uppercase text-slate-400 font-sans font-bold leading-none mb-1">Max Read</span>
            <span class="text-sm font-bold text-indigo-650 dark:text-indigo-400 leading-none">${formatIOPS(results.readIops)}</span>
            <span class="text-[8px] text-slate-500 font-sans mt-0.5">${formatSpeed(results.readSpeed)}</span>
          </div>
          <div class="flex flex-col">
            <span class="text-[8px] uppercase text-slate-400 font-sans font-bold leading-none mb-1">Max Write</span>
            <span class="text-sm font-bold text-pink-655 dark:text-pink-400 leading-none">${formatIOPS(results.writeIops)}</span>
            <span class="text-[8px] text-slate-500 font-sans mt-0.5">${formatSpeed(results.writeSpeed)}</span>
          </div>
          <div class="flex flex-col border-l pl-2 border-slate-200 dark:border-slate-700">
            <span class="text-[8px] uppercase text-slate-400 font-sans font-bold leading-none mb-1">Est. Rebuild</span>
            <span class="text-[10px] mt-0.5 mt-auto mb-auto leading-tight font-bold text-amber-500">${results.rebuildTimeText}</span>
          </div>
        </div>
      </div>
    </div>
  `;
}

// Minimalistic focused updates for Nutanix keyboard inputs so focus/cursor isn't lost mid-typing
function freshMetricsAndChassisForNutanix(resRF2: NutanixResult, resRF3: NutanixResult) {
  const metricsDiv = document.getElementById('tabMetricsContainer')!;
  const chassisDiv = document.getElementById('tabChassisContainer')!;
  
  // Clear the chassis visual for Nutanix
  chassisDiv.innerHTML = '';
  
  // Create an explicit notification area
  const notifyHtml = (() => {
    const hasError = resRF2.status.severity === 'error' || resRF3.status.severity === 'error';
    const hasWarning = resRF2.status.severity === 'warning' || resRF3.status.severity === 'warning';
    let stat = resRF2.status;
    
    // Fallback logic to show the most sever status
    if (hasError) {
      stat = resRF2.status.severity === 'error' ? resRF2.status : resRF3.status;
    } else if (hasWarning) {
      stat = resRF2.status.severity === 'warning' ? resRF2.status : resRF3.status;
    } else {
      stat = resRF2.status; // Default to optimal
    }
    
    const isErr = stat.severity === 'error';
    const isWarn = stat.severity === 'warning';
    const isSubopt = stat.severity === 'suboptimal';
    
    let bgIconCls = 'bg-emerald-500';
    let bgDivCls = 'bg-emerald-50 dark:bg-emerald-950/20';
    let textTitleCls = 'text-emerald-800 dark:text-emerald-300';
    let textDescCls = 'text-emerald-600 dark:text-emerald-400/80';
    let svgIcon = 'check-circle';
    let borderCls = 'border-emerald-200 dark:border-emerald-900/50';
    
    if (isErr) {
      bgIconCls = 'bg-red-500'; bgDivCls = 'bg-red-50 dark:bg-red-950/20';
      textTitleCls = 'text-red-800 dark:text-red-300'; textDescCls = 'text-red-600 dark:text-red-400/80';
      svgIcon = 'alert-octagon'; borderCls = 'border-red-200 dark:border-red-900/50';
    } else if (isWarn) {
      bgIconCls = 'bg-amber-500'; bgDivCls = 'bg-amber-50 dark:bg-amber-950/20';
      textTitleCls = 'text-amber-800 dark:text-amber-300'; textDescCls = 'text-amber-700 dark:text-amber-400/80';
      svgIcon = 'alert-triangle'; borderCls = 'border-amber-200 dark:border-amber-900/50';
    } else if (isSubopt) {
      bgIconCls = 'bg-yellow-500'; bgDivCls = 'bg-yellow-50 dark:bg-yellow-950/20';
      textTitleCls = 'text-yellow-800 dark:text-yellow-300'; textDescCls = 'text-yellow-700 dark:text-yellow-400/80';
      svgIcon = 'info'; borderCls = 'border-yellow-200 dark:border-yellow-900/50';
    }

    return `
      <div class="mb-6 flex gap-4 p-4 rounded-xl border ${borderCls} ${bgDivCls} items-start animate-fade-in shadow-sm">
        <div class="mt-0.5 shrink-0 flex items-center justify-center w-8 h-8 rounded-full ${bgIconCls} text-white shadow-sm ring-4 ring-white/50 dark:ring-black/20">
          ${getSVGIcon(svgIcon)}
        </div>
        <div class="space-y-1">
          <h4 class="font-bold text-sm tracking-wide uppercase ${textTitleCls}">
            ${stat.title}
          </h4>
          <p class="text-[11px] ${textDescCls} max-w-2xl leading-relaxed">
            ${stat.desc}
          </p>
        </div>
      </div>
    `;
  })();
  
  const statusBox = document.getElementById('statusBoxContainer')!;
  statusBox.innerHTML = ''; // Ensure this is empty for Nutanix so warnings don't leak
  
  metricsDiv.innerHTML = `
    ${notifyHtml}
    <div class="mb-6 flex items-center gap-2 text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest animate-fade-in pb-2 border-b border-slate-200 dark:border-slate-800">
      ${getSVGIcon('layers', 'w-4 h-4')} Distributed Cluster Topology Comparison
    </div>
    <div class="grid grid-cols-1 xl:grid-cols-2 gap-6 pb-4 flex-grow">
      ${renderNutanixMetricsComparison('RF2 (Dual Copies)', resRF2)}
      ${renderNutanixMetricsComparison('RF3 (Triple Copies)', resRF3)}
    </div>
  `;
}

// --- MAIN ROUTER BINDINGS ---

export function updateTabBarHighlight() {
  const tabs = ['standard', 'unraid', 'btrfs', 'nutanix'] as const;
  tabs.forEach(t => {
    const btn = document.getElementById(`tabBtn${t.charAt(0).toUpperCase() + t.slice(1)}`)!;
    if (STATE.activeTab === t) {
      btn.className = 'px-4 py-2 rounded-lg font-bold text-xs uppercase tracking-wide transition-all bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 shadow-sm border border-slate-200 dark:border-slate-700 cursor-pointer';
    } else {
      btn.className = 'px-4 py-2 rounded-lg font-bold text-xs uppercase tracking-wide transition-all text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-200/50 dark:hover:bg-slate-800/50 cursor-pointer';
    }
  });
}

export function renderActiveTab() {
  updateTabBarHighlight();
  
  if (STATE.activeTab === 'standard') {
    renderStandardTab();
  } else if (STATE.activeTab === 'unraid') {
    renderUnraidTab();
  } else if (STATE.activeTab === 'btrfs') {
    renderBtrfsTab();
  } else if (STATE.activeTab === 'nutanix') {
    renderNutanixTab();
  }
}

export function bindGlobalTabSwitches() {
  const tabs = ['standard', 'unraid', 'btrfs', 'nutanix'] as const;
  tabs.forEach(t => {
    const btn = document.getElementById(`tabBtn${t.charAt(0).toUpperCase() + t.slice(1)}`)!;
    btn.addEventListener('click', () => {
      STATE.activeTab = t;
      renderActiveTab();
    });
  });
}
