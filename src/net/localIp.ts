import * as Network from 'expo-network';

/** Known hotspot gateway / host addresses for Android and iOS. */
export const HOTSPOT_GATEWAYS = ['192.168.43.1', '172.20.10.1', '192.168.49.1'];

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

/** Compute gateway address (x.y.z.1) for a given subnet. */
export function gatewayFor(ip: string): string {
  const parts = ip.split('.');
  parts[3] = '1';
  return parts.join('.');
}

/** Candidate broadcast targets: our own subnet, the global broadcast and the classic hotspot subnet. */
export async function broadcastTargets(): Promise<string[]> {
  const ip = await getLocalIp();
  const set = new Set<string>(['255.255.255.255', '192.168.43.255', '172.20.10.255', '192.168.49.255']);
  if (ip) set.add(broadcastFor(ip));
  return [...set];
}

/**
 * Candidate discovery targets: includes directed broadcast targets AND direct unicast hotspot hosts.
 * Direct unicast probes are essential for Android Hotspots because Android's tethering firewall
 * often blocks/drops UDP broadcast packets between tethered clients and the host phone.
 */
export async function discoveryTargets(): Promise<string[]> {
  const ip = await getLocalIp();
  const set = new Set<string>([
    '255.255.255.255',
    '192.168.43.255',
    '172.20.10.255',
    '192.168.49.255',
    ...HOTSPOT_GATEWAYS,
  ]);
  if (ip) {
    set.add(broadcastFor(ip));
    set.add(gatewayFor(ip));
  }
  return [...set];
}
