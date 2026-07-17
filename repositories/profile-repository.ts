import type { UserProfile } from "../types/transactions";
import { readCollection, subscribeToStorage, writeCollection } from "./storage";

export const PROFILE_STORAGE_KEY = "car-master-user-profiles";
export class LocalProfileRepository {
  getAll = () => readCollection<UserProfile>(PROFILE_STORAGE_KEY).map((profile) => ({
    ...profile,
    brands: Array.isArray(profile.brands) ? profile.brands : profile.brands ? [profile.brands] : [],
    works: Array.isArray(profile.works) ? profile.works : profile.works ? [profile.works] : [],
  }));
  getById(id: string) { return this.getAll().find((item) => item.id === id) ?? null; }
  create(profile: UserProfile) { if (this.getById(profile.id)) throw new Error(`Profile ${profile.id} already exists.`); writeCollection(PROFILE_STORAGE_KEY, [...this.getAll(), profile]); }
  update(profile: UserProfile) { if (!this.getById(profile.id)) throw new Error(`Profile ${profile.id} was not found.`); writeCollection(PROFILE_STORAGE_KEY, this.getAll().map((item) => item.id === profile.id ? profile : item)); }
  save(profile: UserProfile) { if (this.getById(profile.id)) this.update(profile); else this.create(profile); }
  subscribe(listener: () => void) { return subscribeToStorage(PROFILE_STORAGE_KEY, listener); }
}
export const profileRepository = new LocalProfileRepository();
