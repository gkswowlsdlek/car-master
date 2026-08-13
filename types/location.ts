import type { InstallerListing } from "./installer";

export type SearchLocation = {
  id: string;
  city: string;
  district: string;
  label: string;
  latitude: number;
  longitude: number;
};

export type InstallerSearchResult = {
  shop: InstallerListing;
  distanceKm: number | null;
  distanceLabel: string;
};
