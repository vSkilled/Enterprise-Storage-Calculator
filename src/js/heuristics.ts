import { Disk, MediaType, MEDIA_STATS, RaidLevel, StatusMessage } from './types';

// Natural formatting helper for overall throughputs
export const formatSpeed = (mbs: number): string => {
  if (mbs >= 1000) {
    return `${(mbs / 1000).toFixed(1)} GB/s`;
  }
  return `${Math.round(mbs)} MB/s`;
};

// Natural formatting helper for IO operations per second
export const formatIOPS = (iops: number): string => {
  if (iops >= 1000000) {
    return `${(iops / 1000000).toFixed(1)}M`;
  }
  if (iops >= 1000) {
    return `${(iops / 1000).toFixed(1)}k`;
  }
  return Math.round(iops).toString();
};

// Estimates drive array rebuild times based on capacity and throughput
export const formatRebuild = (tb: number, speedMBs: number): string => {
  if (!tb || !speedMBs) return 'N/A';
  const mb = tb * 1000000;
  // Account for a 20% real-world command execution and parity verification protocol penalty
  const sec = (mb / speedMBs) * 1.2; 
  if (sec < 3600) {
    return `${Math.round(sec / 60)} Mins`;
  }
  const hrs = sec / 3600;
  if (hrs > 48) {
    return `${(hrs / 24).toFixed(1)} Days`;
  }
  return `${hrs.toFixed(1)} Hours`;
};

// --- DEFINITIONS FOR CALCULATED MODEL RESULTS ---

export interface StandardRaidResult {
  usable: number;
  protection: number;
  raw: number;
  faultToleranceText: string;
  readSpeed: number;
  writeSpeed: number;
  readIops: number;
  writeIops: number;
  rebuildTimeText: string;
  status: StatusMessage;
}

export interface UnraidResult {
  usable: number;
  paritySize: number;
  raw: number;
  faultToleranceText: string;
  readSpeed: number;
  writeSpeed: number;
  writeMethodText: string;
  rebuildTimeText: string;
  status: StatusMessage;
}

export interface UnraidCacheResult {
  usable: number;
  protection: number;
  raw: number;
  profileText: string;
  readSpeed: number;
  writeSpeed: number;
  readIops: number;
  writeIops: number;
  rebuildTimeText: string;
  status: StatusMessage | null;
}

export interface BtrfsResult {
  usable: number;
  protection: number;
  raw: number;
  faultToleranceText: string;
  readSpeed: number;
  writeSpeed: number;
  readIops: number;
  writeIops: number;
  rebuildTimeText: string;
  status: StatusMessage;
}

/**
 * Calculates capacities, IOPS, read/write speeds, and rebuild risks for standard hardware/ZFS RAID layouts
 */
export const calculateStandardRaid = (
  n: number,
  size: number,
  level: RaidLevel,
  mediaType: MediaType
): StandardRaidResult => {
  const stat = MEDIA_STATS[mediaType];
  const raw = n * size;

  let minDisks = 1;
  let usable = 0;
  let protection = 0;
  let faultToleranceText = '0 Disks';
  let isInvalid = false;

  // Determine capacity guidelines based on chosen RAID mechanism
  switch (level) {
    case 'raid0':
      minDisks = 2;
      usable = n * size;
      protection = 0;
      faultToleranceText = '0 Disks';
      break;
    case 'raid1':
      minDisks = 2;
      usable = size;
      protection = (n - 1) * size;
      faultToleranceText = `${n - 1} Disk(s)`;
      break;
    case 'raid5':
    case 'raidz1':
      minDisks = 3;
      usable = (n - 1) * size;
      protection = size;
      faultToleranceText = '1 Disk';
      break;
    case 'raid6':
    case 'raidz2':
      minDisks = 4;
      usable = (n - 2) * size;
      protection = size * 2;
      faultToleranceText = '2 Disks';
      break;
    case 'raidz3':
      minDisks = 5;
      usable = (n - 3) * size;
      protection = size * 3;
      faultToleranceText = '3 Disks';
      break;
    case 'raid10':
      minDisks = 4;
      usable = (n / 2) * size;
      protection = (n / 2) * size;
      faultToleranceText = '1 Disk / Mirror Pair';
      if (n % 2 !== 0) {
        isInvalid = true;
      }
      break;
    case 'shr1':
      minDisks = 2;
      usable = n === 2 ? size : (n - 1) * size;
      protection = size;
      faultToleranceText = '1 Disk';
      break;
    case 'shr2':
      minDisks = 4;
      usable = (n - 2) * size;
      protection = size * 2;
      faultToleranceText = '2 Disks';
      break;
  }

  // Validate that disk requirements are strictly met
  if (n < minDisks) {
    isInvalid = true;
  }

  if (isInvalid) {
    return {
      usable: 0,
      protection: 0,
      raw,
      faultToleranceText: 'N/A',
      readSpeed: 0,
      writeSpeed: 0,
      readIops: 0,
      writeIops: 0,
      rebuildTimeText: 'N/A',
      status: {
        severity: 'error',
        title: 'Invalid Config',
        desc: level === 'raid10' && n % 2 !== 0
          ? 'RAID 10 requires an even number of disks.'
          : `This RAID level requires a minimum of ${minDisks} disks.`
      }
    };
  }

  // Speed and throughput estimation math
  let pR = 0;
  let pW = 0;
  let iR = 0;
  let iW = 0;

  if (level === 'raid0') {
    pR = n * stat.r;
    pW = n * stat.w;
    iR = n * stat.iopsR;
    iW = n * stat.iopsW;
  } else if (level === 'raid1') {
    pR = n * stat.r;
    pW = stat.w;
    iR = n * stat.iopsR;
    iW = stat.iopsW;
  } else if (level === 'raid5' || level === 'raidz1' || level === 'shr1') {
    pR = (n - 1) * stat.r;
    pW = (n - 1) * stat.w * 0.8;
    iR = (n - 1) * stat.iopsR;
    iW = stat.iopsW * 0.8;
  } else if (level === 'raid6' || level === 'raidz2' || level === 'shr2') {
    pR = (n - 2) * stat.r;
    pW = (n - 2) * stat.w * 0.6;
    iR = (n - 2) * stat.iopsR;
    iW = stat.iopsW * 0.6;
  } else if (level === 'raidz3') {
    pR = (n - 3) * stat.r;
    pW = (n - 3) * stat.w * 0.5;
    iR = (n - 3) * stat.iopsR;
    iW = stat.iopsW * 0.5;
  } else if (level === 'raid10') {
    pR = n * stat.r;
    pW = (n / 2) * stat.w;
    iR = n * stat.iopsR;
    iW = (n / 2) * stat.iopsW;
  }

  // Generate rebuild time approximations
  const rebuildTimeText = level === 'raid0' ? 'N/A' : formatRebuild(size, stat.rebuild);

  // Evaluate structural health recommendations
  let status: StatusMessage = {
    severity: 'optimal',
    title: 'Optimal Configuration',
    desc: 'Solid array configuration for selected media type and fault tolerance.'
  };

  if (level === 'raid0') {
    status = {
      severity: 'warning',
      title: 'No Redundancy',
      desc: 'RAID 0 has zero fault tolerance. Data loss is guaranteed on a single drive failure.'
    };
  } else if ((level === 'raid5' || level === 'raidz1' || level === 'shr1') && n >= 8) {
    status = {
      severity: 'warning',
      title: 'Critical Rebuild Risk',
      desc: 'Single parity with 8 or more drives carries a high statistical probability of Unrecoverable Read Errors (URE) or secondary failures during rebuilds. Dual parity is highly recommended.'
    };
  } else if ((level === 'raid6' || level === 'raidz2' || level === 'shr2') && n < 5) {
    status = {
      severity: 'suboptimal',
      title: 'Capacity Overhead',
      desc: 'Dual parity on a small array sacrifices a massive percentage of raw capacity. Consider single parity or mirrors for arrays smaller than 5 disks.'
    };
  }

  return {
    usable,
    protection,
    raw,
    faultToleranceText,
    readSpeed: pR,
    writeSpeed: pW,
    readIops: iR,
    writeIops: iW,
    rebuildTimeText,
    status
  };
};

/**
 * Computes capacities and speeds of the standard dynamic Unraid OS storage pool
 */
export const calculateUnraidArray = (
  disks: Disk[],
  parityCount: number,
  fileSystem: 'xfs' | 'btrfs' | 'zfs',
  writeMethod: 'auto' | 'reconstruct'
): UnraidResult => {
  const raw = disks.reduce((sum, d) => sum + d.s, 0);

  if (disks.length === 0) {
    return {
      usable: 0,
      paritySize: 0,
      raw: 0,
      faultToleranceText: 'N/A',
      readSpeed: 0,
      writeSpeed: 0,
      writeMethodText: '',
      rebuildTimeText: 'N/A',
      status: {
        severity: 'error',
        title: 'Array Empty',
        desc: 'Need at least one data disk in the Main Array.'
      }
    };
  }

  if (disks.length <= parityCount && parityCount > 0) {
    return {
      usable: 0,
      paritySize: 0,
      raw,
      faultToleranceText: 'N/A',
      readSpeed: 0,
      writeSpeed: 0,
      writeMethodText: '',
      rebuildTimeText: 'N/A',
      status: {
        severity: 'error',
        title: 'Invalid Parity',
        desc: 'Need data disks in addition to parity.'
      }
    };
  }

  // Unraid isolates its largest drive(s) as parity
  const sortedDisks = [...disks].sort((a, b) => b.s - a.s);

  let paritySize = 0;
  let usable = 0;

  sortedDisks.forEach((d, idx) => {
    if (idx < parityCount) {
      paritySize += d.s;
    } else {
      usable += d.s;
    }
  });

  const uniqueMediaTypes = new Set(disks.map((d) => d.t));
  let dominantMedia: MediaType = 'hdd';
  if (uniqueMediaTypes.has('nvme')) {
    dominantMedia = 'nvme';
  } else if (uniqueMediaTypes.has('ssd')) {
    dominantMedia = 'ssd';
  } else if (uniqueMediaTypes.has('hdd')) {
    dominantMedia = 'hdd';
  } else if (uniqueMediaTypes.has('hdd5400')) {
    dominantMedia = 'hdd5400';
  }

  const stat = MEDIA_STATS[dominantMedia];

  let fsModR = 1.0;
  let fsModW = 1.0;
  if (fileSystem === 'btrfs') {
    fsModW = 0.95;
  }
  if (fileSystem === 'zfs') {
    fsModW = 0.95;
    fsModR = 1.1;
  }

  let pR = stat.r * fsModR;
  let pW = stat.w * fsModW;
  let wTxt = `Direct to Array (${fileSystem.toUpperCase()})`;

  if (parityCount > 0) {
    if (writeMethod === 'auto') {
      pW = pW * 0.4;
      wTxt = 'Read/Modify/Write Penalty';
    } else if (writeMethod === 'reconstruct') {
      pW = pW * 0.95;
      wTxt = 'Turbo Write (All Disks Spinning)';
    }
  }

  const faultToleranceText = parityCount === 0 ? '0 Disks' : `${parityCount} Disk(s)`;
  const rebuildTimeText = parityCount > 0 ? formatRebuild(sortedDisks[0].s, stat.rebuild) : 'N/A';

  // Warnings evaluation for Unraid arrays
  let status: StatusMessage = {
    severity: 'optimal',
    title: 'Optimal Configuration',
    desc: 'Solid array topology is properly modeled under standard guides.'
  };

  if (parityCount === 0) {
    status = {
      severity: 'warning',
      title: 'No Array Redundancy',
      desc: 'Main array lacks parity protection. Immediate data loss risks on any drive failure.'
    };
  } else if (parityCount === 1 && disks.length >= 10) {
    status = {
      severity: 'suboptimal',
      title: 'Array Rebuild Risk',
      desc: 'Single parity with 10 or more drives carries a high statistical risk of secondary drive write failures or UREs during a parity rebuild.'
    };
  } else if (parityCount === 2 && disks.length <= 4) {
    status = {
      severity: 'suboptimal',
      title: 'High Parity Overhead',
      desc: 'Dual parity on such a small unraid array compromises a large percentage of raw storage capacity.'
    };
  } else if (uniqueMediaTypes.size > 1) {
    status = {
      severity: 'info',
      title: 'Mixed Array Media',
      desc: 'Main array speeds are mixed. Operations (especially parity syncs) will bottleneck at the slowest active model.'
    };
  } else if (parityCount > 0 && writeMethod === 'reconstruct') {
    status = {
      severity: 'info',
      title: 'Turbo Write Active',
      desc: 'Reconstruct Write forces ALL drives to spin up on write, increasing power draw, but bypasses standard double-IO write penalties.'
    };
  }

  return {
    usable,
    paritySize,
    raw,
    faultToleranceText,
    readSpeed: pR,
    writeSpeed: pW,
    writeMethodText: wTxt,
    rebuildTimeText,
    status,
  };
};

/**
 * Calculates Cache Pool performance and redundancies inside Unraid configurations
 */
export const calculateUnraidCache = (
  cacheDisks: Disk[],
  cacheMode: string
): UnraidCacheResult => {
  const raw = cacheDisks.reduce((sum, d) => sum + d.s, 0);
  const n = cacheDisks.length;

  if (n === 0) {
    return {
      usable: 0,
      protection: 0,
      raw: 0,
      profileText: 'None',
      readSpeed: 0,
      writeSpeed: 0,
      readIops: 0,
      writeIops: 0,
      rebuildTimeText: 'N/A',
      status: null,
    };
  }

  let hasError = false;
  let errDesc = '';

  if (cacheMode.startsWith('btrfs_')) {
    if (cacheMode === 'btrfs_raid1' && n < 2) {
      hasError = true;
      errDesc = 'BTRFS RAID1 requires at least 2 disks.';
    } else if (cacheMode === 'btrfs_raid1c3' && n < 3) {
      hasError = true;
      errDesc = 'BTRFS RAID1c3 requires at least 3 disks.';
    } else if (cacheMode === 'btrfs_raid5' && n < 2) {
      hasError = true;
      errDesc = 'BTRFS RAID5 requires at least 2 disks.';
    }
  } else if (cacheMode.startsWith('zfs_')) {
    if (cacheMode === 'zfs_mirror' && n < 2) {
      hasError = true;
      errDesc = 'ZFS Mirror requires at least 2 disks.';
    } else if (cacheMode === 'zfs_raidz1' && n < 3) {
      hasError = true;
      errDesc = 'ZFS RAIDZ1 requires at least 3 disks.';
    } else if (cacheMode === 'zfs_raidz2' && n < 4) {
      hasError = true;
      errDesc = 'ZFS RAIDZ2 requires at least 4 x-disks.';
    }
  }

  if (hasError) {
    return {
      usable: 0,
      protection: 0,
      raw,
      profileText: 'Profile Error',
      readSpeed: 0,
      writeSpeed: 0,
      readIops: 0,
      writeIops: 0,
      rebuildTimeText: 'N/A',
      status: {
        severity: 'error',
        title: 'Cache Profile Conflict',
        desc: errDesc
      }
    };
  }

  const maxC = Math.max(...cacheDisks.map((d) => d.s));
  const minC = Math.min(...cacheDisks.map((d) => d.s));
  let usable = 0;

  if (cacheMode.startsWith('btrfs_')) {
    if (cacheMode === 'btrfs_single' || cacheMode === 'btrfs_raid0') {
      usable = raw;
    } else if (cacheMode === 'btrfs_raid1') {
      usable = Math.min(raw / 2, raw - maxC);
    } else if (cacheMode === 'btrfs_raid1c3') {
      usable = raw / 3;
    } else if (cacheMode === 'btrfs_raid5') {
      usable = raw - maxC;
    }
  } else if (cacheMode.startsWith('zfs_')) {
    if (cacheMode === 'zfs_stripe') {
      usable = raw;
    } else if (cacheMode === 'zfs_mirror') {
      usable = minC;
    } else if (cacheMode === 'zfs_raidz1') {
      usable = (n - 1) * minC;
    } else if (cacheMode === 'zfs_raidz2') {
      usable = (n - 2) * minC;
    }
  }

  const protection = raw - usable;

  // Speeds
  const cacheMediaTypes = new Set(cacheDisks.map((d) => d.t));
  let dominantMedia: MediaType = 'nvme';
  if (cacheMediaTypes.has('nvme')) {
    dominantMedia = 'nvme';
  } else if (cacheMediaTypes.has('ssd')) {
    dominantMedia = 'ssd';
  } else if (cacheMediaTypes.has('hdd')) {
    dominantMedia = 'hdd';
  } else if (cacheMediaTypes.has('hdd5400')) {
    dominantMedia = 'hdd5400';
  }

  const stat = MEDIA_STATS[dominantMedia];
  let pR = 0;
  let pW = 0;
  let iR = 0;
  let iW = 0;

  if (cacheMode.includes('single') || cacheMode.includes('stripe') || cacheMode.includes('raid0')) {
    pR = n * stat.r;
    pW = n * stat.w;
    iR = n * stat.iopsR;
    iW = n * stat.iopsW;
  } else if (cacheMode.includes('mirror') || cacheMode === 'btrfs_raid1') {
    pR = n * stat.r;
    pW = stat.w;
    iR = n * stat.iopsR;
    iW = stat.iopsW;
  } else if (cacheMode.includes('raid5') || cacheMode === 'zfs_raidz1') {
    pR = (n - 1) * stat.r;
    pW = (n - 1) * stat.w * 0.8;
    iR = (n - 1) * stat.iopsR;
    iW = stat.iopsW * 0.8;
  } else if (cacheMode.includes('raidz2')) {
    pR = (n - 2) * stat.r;
    pW = (n - 2) * stat.w * 0.6;
    iR = (n - 2) * stat.iopsR;
    iW = stat.iopsW * 0.6;
  } else {
    pR = stat.r;
    pW = stat.w;
    iR = stat.iopsR;
    iW = stat.iopsW;
  }

  const rebuildTimeText =
    cacheMode.includes('single') || cacheMode.includes('stripe')
      ? 'N/A'
      : formatRebuild(maxC, stat.rebuild);

  let status: StatusMessage | null = null;
  if (cacheMode.includes('single') || cacheMode.includes('stripe') || cacheMode.includes('raid0')) {
    status = {
      severity: 'warning',
      title: 'Cache Vulnerable',
      desc: 'The cache pool selected lacks drive redundancy. Unprotected client files in flight will suffer permanent corruption on SSD failure.'
    };
  } else if (cacheMode === 'btrfs_raid5') {
    status = {
      severity: 'warning',
      title: 'BTRFS RAID Unstable',
      desc: 'BTRFS parity profiles suffer from severe write-hole issues. Disadvised for cache partitions.'
    };
  } else if (cacheMediaTypes.size > 1) {
    status = {
      severity: 'warning',
      title: 'Mixed Cache Media',
      desc: 'Mixing NVMe and standard SSD pools blocks throughput down to the slowest drive standard.'
    };
  } else if (cacheMode.startsWith('zfs_') && new Set(cacheDisks.map(d => d.s)).size > 1 && !cacheMode.includes('stripe')) {
    status = {
      severity: 'suboptimal',
      title: 'ZFS Mixed Sizes',
      desc: 'ZFS truncates multi-drive mirrors down to the size of the smallest disk, wasting remaining space.'
    };
  }

  return {
    usable,
    protection,
    raw,
    profileText: cacheMode,
    readSpeed: pR,
    writeSpeed: pW,
    readIops: iR,
    writeIops: iW,
    rebuildTimeText,
    status
  };
};

/**
 * Computes capacities and speeds of standard vanilla BTRFS arrays with custom profiles
 */
export const calculateBtrfsPool = (
  disks: Disk[],
  profile: string
): BtrfsResult => {
  const n = disks.length;
  const raw = disks.reduce((sum, d) => sum + d.s, 0);

  if (n === 0) {
    return {
      usable: 0,
      protection: 0,
      raw: 0,
      faultToleranceText: 'N/A',
      readSpeed: 0,
      writeSpeed: 0,
      readIops: 0,
      writeIops: 0,
      rebuildTimeText: 'N/A',
      status: {
        severity: 'error',
        title: 'Pool Empty',
        desc: 'Please add disks to model your BTRFS native array.'
      }
    };
  }

  let minDisks = 1;
  if (profile === 'raid1' || profile === 'raid0' || profile === 'raid5') {
    minDisks = 2;
  } else if (profile === 'raid1c3' || profile === 'raid6') {
    minDisks = 3;
  } else if (profile === 'raid1c4' || profile === 'raid10') {
    minDisks = 4;
  }

  if (n < minDisks) {
    return {
      usable: 0,
      protection: 0,
      raw,
      faultToleranceText: 'N/A',
      readSpeed: 0,
      writeSpeed: 0,
      readIops: 0,
      writeIops: 0,
      rebuildTimeText: 'N/A',
      status: {
        severity: 'error',
        title: 'Invalid Topology',
        desc: `BTRFS ${profile.toUpperCase()} requires a minimum of ${minDisks} disks.`
      }
    };
  }

  const sortedSizes = disks.map((d) => d.s).sort((a, b) => b - a);
  const max1 = sortedSizes[0];
  const max2 = sortedSizes[1] || 0;
  const max3 = sortedSizes[2] || 0;

  let usable = 0;
  let ftTxt = '0 Disks';

  if (profile === 'single' || profile === 'raid0') {
    usable = raw;
    ftTxt = '0 Disks';
  } else if (profile === 'raid1') {
    usable = Math.min(raw / 2, raw - max1);
    ftTxt = '1 Disk';
  } else if (profile === 'raid1c3') {
    usable = Math.min(raw / 3, raw - max1 - max2);
    ftTxt = '2 Disks';
  } else if (profile === 'raid1c4') {
    usable = Math.min(raw / 4, raw - max1 - max2 - max3);
    ftTxt = '3 Disks';
  } else if (profile === 'raid5') {
    usable = raw - max1;
    ftTxt = '1 Disk';
  } else if (profile === 'raid6') {
    usable = raw - max1 - max2;
    ftTxt = '2 Disks';
  } else if (profile === 'raid10') {
    usable = Math.min(raw / 2, raw - max1);
    ftTxt = '1 Disk / Stripe';
  }

  const protection = raw - usable;

  // Performance Heuristics
  const btrfsMediaTypes = new Set(disks.map((d) => d.t));
  let dominantMedia: MediaType = 'nvme';
  if (btrfsMediaTypes.has('nvme')) {
    dominantMedia = 'nvme';
  } else if (btrfsMediaTypes.has('ssd')) {
    dominantMedia = 'ssd';
  } else if (btrfsMediaTypes.has('hdd')) {
    dominantMedia = 'hdd';
  } else if (btrfsMediaTypes.has('hdd5400')) {
    dominantMedia = 'hdd5400';
  }

  const stat = MEDIA_STATS[dominantMedia];
  let pR = 0;
  let pW = 0;
  let iR = 0;
  let iW = 0;

  if (profile === 'single' || profile === 'raid0') {
    pR = n * stat.r;
    pW = n * stat.w;
    iR = n * stat.iopsR;
    iW = n * stat.iopsW;
  } else if (profile.startsWith('raid1')) {
    pR = n * stat.r;
    pW = stat.w;
    iR = n * stat.iopsR;
    iW = stat.iopsW;
  } else if (profile === 'raid5') {
    pR = (n - 1) * stat.r;
    pW = (n - 1) * stat.w * 0.8;
    iR = (n - 1) * stat.iopsR;
    iW = stat.iopsW * 0.8;
  } else if (profile === 'raid6') {
    pR = (n - 2) * stat.r;
    pW = (n - 2) * stat.w * 0.6;
    iR = (n - 2) * stat.iopsR;
    iW = stat.iopsW * 0.6;
  } else if (profile === 'raid10') {
    pR = n * stat.r;
    pW = (n / 2) * stat.w;
    iR = n * stat.iopsR;
    iW = (n / 2) * stat.iopsW;
  }

  const rebuildTimeText =
    profile === 'single' || profile === 'raid0'
      ? 'N/A'
      : formatRebuild(max1, stat.rebuild);

  // Status checks
  let status: StatusMessage = {
    severity: 'optimal',
    title: 'Optimal Configuration',
    desc: 'Safe and standard configuration for a BTRFS native storage pool.'
  };

  if (profile === 'single' || profile === 'raid0') {
    status = {
      severity: 'warning',
      title: 'No Redundancy',
      desc: 'BTRFS layout contains zero parity or protection. Data loss on a single drive standard.'
    };
  } else if (profile === 'raid5' || profile === 'raid6') {
    status = {
      severity: 'warning',
      title: 'Write-Hole Risk',
      desc: 'Native BTRFS RAID5/6 profiles are fundamentally unstable and highly susceptible to metadata write-hole corruptions during sudden loss of power.'
    };
  } else if (btrfsMediaTypes.size > 1) {
    status = {
      severity: 'warning',
      title: 'Mixed Media Detected',
      desc: 'Mixing distinct media types degrades native allocation blocks down to the slower drive speeds.'
    };
  } else if (profile === 'raid1' && n > 6) {
    status = {
      severity: 'info',
      title: 'RAID 1 Quirk',
      desc: 'BTRFS RAID 1 ensures exactly 2 copies of data across the entire pool, regardless of the physical count. It is not a complete mirror block of all drives.'
    };
  }

  return {
    usable,
    protection,
    raw,
    faultToleranceText: ftTxt,
    readSpeed: pR,
    writeSpeed: pW,
    readIops: iR,
    writeIops: iW,
    rebuildTimeText,
    status,
  };
};

export interface NutanixResult {
  usable: number;
  effectiveUsable: number;
  protection: number;
  raw: number;
  faultToleranceText: string;
  readSpeed: number;
  writeSpeed: number;
  readIops: number;
  writeIops: number;
  cvmOverhead: number;
  status: StatusMessage;
  rebuildTimeText: string;
  dataReductionRatio: number;
}

/**
 * Computes capacities, redundancy options, and performance profiles for Nutanix HCI clusters
 */
export const calculateNutanixCluster = (
  nodes: number,
  hddTotal: number,
  ssdTotal: number,
  rf: number,
  ecEnabled: boolean,
  compEnabled: boolean,
  dedupeEnabled: boolean
): NutanixResult => {
  const raw = hddTotal + ssdTotal;

  // Let's reserve 0.15 TB (150 GB) of SSD storage per node for Controller VM logs, metadata, and cluster services (AOS)
  const cvmOverheadPerNode = 0.15;
  const totalCvmOverhead = nodes * cvmOverheadPerNode;

  const ssdNet = Math.max(0, ssdTotal - totalCvmOverhead);
  const hddNet = hddTotal;
  const netCapacity = ssdNet + hddNet;

  let usable = 0;
  let isInvalid = false;
  let faultToleranceText = '0 Nodes';
  let isEcActive = false;

  // FT calculation based on RF
  if (rf === 2) {
    faultToleranceText = '1 Node Fault';
    if (nodes < 3) isInvalid = true;
  } else if (rf === 3) {
    faultToleranceText = '2 Nodes Fault';
    if (nodes < 5) isInvalid = true;
  }

  // Calculate efficiency factor
  if (ecEnabled) {
    if (rf === 2 && nodes >= 4) {
      // 4+1 structure gives 80% efficiency (1.25x overhead) instead of 50% (2.0x overhead)
      usable = netCapacity * 0.8;
      isEcActive = true;
    } else if (rf === 3 && nodes >= 6) {
      // 4+2 structure gives 66.7% efficiency (1.5x overhead) instead of 33.3% (3.0x overhead)
      usable = netCapacity * 0.667;
      isEcActive = true;
    } else {
      // EC-X selected but not enough nodes, fall back to standard RF replication
      usable = netCapacity / rf;
    }
  } else {
    usable = netCapacity / rf;
  }

  let dataReductionRatio = 1.0;
  if (compEnabled) dataReductionRatio *= 1.5;
  if (dedupeEnabled) dataReductionRatio *= 1.35;
  
  const effectiveUsable = usable * dataReductionRatio;

  if (isInvalid) {
    return {
      usable: 0,
      effectiveUsable: 0,
      protection: raw,
      raw,
      faultToleranceText: 'N/A',
      readSpeed: 0,
      writeSpeed: 0,
      readIops: 0,
      writeIops: 0,
      cvmOverhead: totalCvmOverhead,
      rebuildTimeText: 'N/A',
      dataReductionRatio,
      status: {
        severity: 'error',
        title: 'Cluster Quorum Failure',
        desc: rf === 3 
          ? `Nutanix Redundancy Factor 3 (RF3) requires a minimum of 5 cluster nodes to operate.`
          : `Nutanix Redundancy Factor 2 (RF2) requires a minimum of 3 cluster nodes to operate.`
      }
    };
  }

  const protection = raw - usable;

  // Speeds: Node scaling of aggregated distributed network
  const totalCapacity = ssdTotal + hddTotal;
  const ssdFraction = totalCapacity > 0 ? ssdTotal / totalCapacity : 0;
  const hddFraction = totalCapacity > 0 ? hddTotal / totalCapacity : 0;

  // Aggregate read potential: hot reads occur locally at full speeds across nodes
  const nodeReadMBs = (3500 * ssdFraction) + (200 * hddFraction);
  const readSpeed = nodes * nodeReadMBs * 0.85;

  // Aggregate write potential: replicated over network, penalised by RF writes
  const nodeWriteMBs = (3000 * ssdFraction) + (180 * hddFraction);
  const writeSpeed = (nodes * nodeWriteMBs * (1 / rf)) * 0.75;

  const readIops = nodes * ((400000 * ssdFraction) + (120 * hddFraction)) * 0.85;
  const writeIops = (nodes * ((300000 * ssdFraction) + (80 * hddFraction)) * (1 / rf)) * 0.7;

  // Rebuild time under distributed CVM recovery
  const ssdSizePerNode = ssdTotal / nodes;
  const hddSizePerNode = hddTotal / nodes;
  const diskSizeToRebuild = Math.max(hddSizePerNode, ssdSizePerNode);
  const healthyNodes = Math.max(1, nodes - 1);
  const aggregateRebuildSpeed = healthyNodes * 250; // MB/s
  const rebuildTimeText = formatRebuild(diskSizeToRebuild, aggregateRebuildSpeed);

  // Status checks
  let status: StatusMessage = {
    severity: 'optimal',
    title: 'Optimal Distributed Cluster',
    desc: 'Nutanix Enterprise Cloud DFS is balanced and prepared for standard hyperconverged loads.'
  };

  if (ssdTotal === 0) {
    status = {
      severity: 'error',
      title: 'SSD Hot Tier Missing',
      desc: 'Nutanix hyperconverged storage strictly requires flash solid-state or NVMe drives to store OS metadata and maintain Controller VM transaction journals.'
    };
  } else if (ecEnabled && !isEcActive) {
    status = {
      severity: 'suboptimal',
      title: 'EC-X Inactive',
      desc: rf === 3 
        ? `Erasure Coding (EC-X) for RF3 requires a minimum of 6 nodes to deploy successfully. Cluster is defaulting to raw RF3 mirroring.`
        : `Erasure Coding (EC-X) for RF2 requires a minimum of 4 nodes to deploy successfully. Cluster is defaulting to raw RF2 mirroring.`
    };
  } else if (ssdFraction < 0.12 && hddTotal > 0) {
    status = {
      severity: 'warning',
      title: 'Low SSD Cache Ratio',
      desc: `Your SSD flash capacity is only ${(ssdFraction * 100).toFixed(1)}% of total capacity. Extreme cold tier storage thrashing will occur under multi-tenant enterprise stress.`
    };
  } else if (dedupeEnabled && nodes < 3) {
    status = {
      severity: 'warning',
      title: 'Deduplication Performance Impact',
      desc: `Deduplication requires substantial Controller VM RAM and CPU. Using it on small clusters may severely impact compute application performance.`
    };
  } else if (ecEnabled && isEcActive) {
    status = {
      severity: 'optimal',
      title: 'EC-X Optimized High Performance',
      desc: `Erasure Coding is actively running. Storage footprint is reduced, giving ~${((usable / (netCapacity > 0 ? netCapacity : 1)) * 100).toFixed(0)}% physical efficiency under full protection.`
    };
  }

  return {
    usable,
    effectiveUsable,
    protection,
    raw,
    faultToleranceText,
    readSpeed,
    writeSpeed,
    readIops,
    writeIops,
    cvmOverhead: totalCvmOverhead,
    status,
    rebuildTimeText,
    dataReductionRatio
  };
};

