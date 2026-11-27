import * as Network from 'expo-network';

/** Returns this device's IPv4 address on the Wi-Fi/hotspot network, or null if unknown. */
export async function getLocalIp(): Promise<string | null> {
  try {
    const ip = await Network.getIpAddressAsync();
    if (!ip || ip === '0.0.0.0' || !/^\d+\.\d+\.\d+\.\d+$/.test(ip)) return null;
    return ip;
  } catch {
    return null;
  }
}

/** Android hotspots use a /24 subnet, so x.y.z.255 is the directed broadcast address. */
export function broadcastFor(ip: string): string {
  const parts = ip.split('.');
  parts[3] = '255';
  return parts.join('.');
}

/** Candidate broadcast targets: our own subnet, the global broadcast and the classic hotspot subnet. */
export async function broadcastTargets(): Promise<string[]> {
  const ip = await getLocalIp();
  const set = new Set<string>(['255.255.255.255', '192.168.43.255']);
  if (ip) set.add(broadcastFor(ip));
  return [...set];
}
