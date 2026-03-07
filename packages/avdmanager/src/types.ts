export interface Avd {
  name: string;
  target: string;
  api: number;
  abi: string;
  device: string;
  path: string;
  sdcard?: string;
  config?: AvdConfig;
}

export interface AvdConfig {
  displayName?: string;
  ram?: number;
  vmHeap?: number;
  sdcard?: string;
  lcdWidth?: number;
  lcdHeight?: number;
  lcdDensity?: number;
  cpuArch?: string;
  cpuCores?: number;
  gpuEnabled?: boolean;
  gpuMode?: string;
  playStoreEnabled?: boolean;
  skin?: string;
  imageSysdir?: string;
  targetApi?: string;
}

export interface DeviceProfile {
  id: string;
  name: string;
  oem: string;
}

export interface CreateAvdOptions {
  name: string;
  systemImage: string;
  device: string;
  force?: boolean;
  sdcard?: string;
}
