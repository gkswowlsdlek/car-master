import { demoInstallerListings } from "../data/installer-directory-demo";
import type { InstallerListing } from "../types/installer";

export class LocalInstallerRepository {
  async getAll(): Promise<InstallerListing[]> {
    return demoInstallerListings;
  }
}

export const localInstallerRepository = new LocalInstallerRepository();
