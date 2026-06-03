// --- DEFINITIONS AND TYPES FOR STORAGE CALCULATIONS ---

export type MediaType = 'hdd5400' | 'hdd' | 'ssd' | 'nvme';

// Performance specifications for solid-state and magnetic media
export interface MediaStat {
  r: number; // Read MB/s
  w: number; // Write MB/s
  iopsR: number; // Read IOPS
  iopsW: number; // Write IOPS
  rebuild: number; // Rebuild speed MB/s
}

// Visual configuration for drive state
export interface Disk {
  s: number; // Size in TB
  t: MediaType; // Media type
}

// Supported arrays, filesystems, and redundancy architectures
export type RaidLevel =
  | 'raid0'
  | 'raid1'
  | 'raid5'
  | 'raid6'
  | 'raid10'
  | 'raidz1'
  | 'raidz2'
  | 'raidz3'
  | 'shr1'
  | 'shr2';

// Standard metrics returned from disk profiles
export const MEDIA_STATS: Record<MediaType, MediaStat> = {
  hdd5400: { r: 120, w: 120, iopsR: 80, iopsW: 50, rebuild: 100 },
  hdd: { r: 200, w: 200, iopsR: 120, iopsW: 80, rebuild: 150 },
  ssd: { r: 540, w: 500, iopsR: 80000, iopsW: 60000, rebuild: 450 },
  nvme: { r: 3500, w: 3000, iopsR: 400000, iopsW: 300000, rebuild: 1800 },
};

// Natural language labels for storage mediums
export const MEDIA_LABELS: Record<MediaType, string> = {
  hdd5400: 'Consumer HDD (5400 RPM)',
  hdd: 'Enterprise HDD (7200 RPM)',
  ssd: 'SATA SSD',
  nvme: 'NVMe PCIe (Gen 3/4)',
};

// Structure of health, redundancy, or capacity messages
export interface StatusMessage {
  severity: 'optimal' | 'warning' | 'suboptimal' | 'error' | 'info';
  title: string;
  desc: string;
}
