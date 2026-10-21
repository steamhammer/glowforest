export interface OfficialContent {
  name: string;
  appId: string;
}

/** Official content is identified by its package id and linked to the store. */
export const OFFICIAL_CONTENT: Readonly<Record<string, OfficialContent>> = Object.freeze({
  "ludeon.rimworld": { name: "Core", appId: "294100" },
  "ludeon.rimworld.royalty": { name: "Royalty", appId: "1149640" },
  "ludeon.rimworld.ideology": { name: "Ideology", appId: "1392840" },
  "ludeon.rimworld.biotech": { name: "Biotech", appId: "1826140" },
  "ludeon.rimworld.anomaly": { name: "Anomaly", appId: "2380740" },
  "ludeon.rimworld.odyssey": { name: "Odyssey", appId: "3022790" },
});

export const OFFICIAL_APP_IDS: ReadonlySet<string> = new Set(
  Object.values(OFFICIAL_CONTENT).map((entry) => entry.appId),
);

export const PLACEHOLDER_PACKAGE_IDS: ReadonlySet<string> = new Set([
  "scenario.rsc",
  "missing.packageid",
  "invalid.item",
]);

export function officialContentFor(packageId: string | null): OfficialContent | null {
  if (packageId === null) return null;
  return OFFICIAL_CONTENT[packageId] ?? null;
}

export function isOfficialPackageId(packageId: string | null): boolean {
  return packageId !== null && (packageId.startsWith("ludeon.") || packageId === "ludeon.rimworld");
}

export function storeUrl(appId: string): string {
  return `https://store.steampowered.com/app/${appId}`;
}

export function workshopUrl(wid: string): string {
  return `https://steamcommunity.com/sharedfiles/filedetails/?id=${wid}`;
}
