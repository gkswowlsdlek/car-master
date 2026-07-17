import type { UserProfile } from "../types/transactions";
import { readCollection, subscribeToStorage, writeCollection } from "./storage";

export const PROFILE_STORAGE_KEY = "car-master-user-profiles";
export class LocalProfileRepository {
  getAll = () => readCollection<UserProfile>(PROFILE_STORAGE_KEY);
  getById(id: string) { return this.getAll().find((item) => item.id === id) ?? null; }
  save(profile: UserProfile) { const values = this.getAll(); writeCollection(PROFILE_STORAGE_KEY, values.some((item) => item.id === profile.id) ? values.map((item) => item.id === profile.id ? profile : item) : [...values, profile]); }
  subscribe(listener: () => void) { return subscribeToStorage(PROFILE_STORAGE_KEY, listener); }
}
export const profileRepository = new LocalProfileRepository();
