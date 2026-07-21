import type { InstallerShop } from "../lib/dealer-flow-data";

export type SearchLocation = {
  id: string;
  city: string;
  district: string;
  label: string;
  latitude: number;
  longitude: number;
};

export type InstallerSearchResult = {
  shop: InstallerShop;
  distanceKm: number | null;
  distanceLabel: string;
};
