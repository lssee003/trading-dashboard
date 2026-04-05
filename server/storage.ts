// No database needed for this app — all data is live from APIs
export interface IStorage {}

export class MemStorage implements IStorage {}

export const storage = new MemStorage();
