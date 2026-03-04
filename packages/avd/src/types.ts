export interface Avd {
  name: string;
  target: string;
  api: number;
  abi: string;
  device: string;
  path: string;
  sdcard?: string;
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
