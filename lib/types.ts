export type AttributeKey =
  | "price"
  | "squareFootage"
  | "commuteTime"
  | "walkScore"
  | "parking"
  | "naturalLight"
  | "noiseLevel"
  | "safety"
  | "inUnitLaundry"
  | "hoaFees";

export type AttributeType = "numeric" | "boolean" | "rating";

export interface House {
  id: string;
  name: string;
  address: string;
  imageUrl: string;
  price: number;
  squareFootage: number;
  commuteTime: number;
  walkScore: number;
  parking: boolean;
  naturalLight: number;
  noiseLevel: number;
  safety: number;
  inUnitLaundry: boolean;
  hoaFees: number;
  bedrooms: number;
  bathrooms: number;
  petFriendly: PetType[];
}

export interface AttributeMeta {
  key: AttributeKey;
  displayName: string;
  type: AttributeType;
  higherIsBetter: boolean;
  unit?: string;
  sortable: boolean;
}

export type BedBathOption = "1" | "2" | "3" | "3+";

export type PetType = "cat" | "smallDog" | "largeDog" | "other";

export interface PreferencesState {
  moveInStart: string;
  moveInEnd: string;
  beds: BedBathOption;
  baths: BedBathOption;
  hasPets: boolean;
  petTypes: PetType[];
}

export interface SortState {
  key: AttributeKey;
  direction: "asc" | "desc";
}

export interface ScoreBreakdown {
  score: number;
  rank: number;
  normalized: Record<AttributeKey, number>;
  contributions: Record<AttributeKey, number>;
}
