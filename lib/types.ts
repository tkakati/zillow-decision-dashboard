export type AttributeKey =
  | "price"
  | "squareFootage"
  | "commuteTime"
  | "walkScore"
  | "transitScore"
  | "bikeScore"
  | "parking"
  | "naturalLight"
  | "noiseLevel"
  | "safety"
  | "inUnitLaundry"
  | "hoaFees";

export type AttributeType = "numeric" | "boolean" | "rating";
export type ListingStage =
  | "Scouting"
  | "Contacted"
  | "Tour Scheduled"
  | "Visited"
  | "Interested"
  | "Applied"
  | "Lease Signed";

export interface House {
  id: string;
  name: string;
  address: string;
  imageUrl: string;
  homeType: HomeType;
  price: number;
  squareFootage: number;
  commuteTime: number;
  walkScore: number;
  transitScore: number;
  bikeScore: number;
  parking: boolean;
  naturalLight: number;
  noiseLevel: number;
  safety: number;
  inUnitLaundry: boolean;
  hoaFees: number;
  bedrooms: number;
  bathrooms: number;
  petFriendly: PetType[];
  amenityTags: AmenityKey[];
  viewTags: ViewPreference[];
}

export interface AttributeMeta {
  key: AttributeKey;
  displayName: string;
  type: AttributeType;
  higherIsBetter: boolean;
  unit?: string;
  sortable: boolean;
}

export type BedroomOption = "studio" | "1" | "2" | "3" | "4" | "5";
export type BathroomOption = "any" | "1+" | "1.5+" | "2+" | "3+" | "4+";

export type PetType = "cat" | "smallDog" | "largeDog" | "other";
export type HomeType = "apartment" | "condo" | "townhome" | "house";
export type ViewPreference = "city" | "mountain" | "park" | "water";
export type NeighborhoodScore = "walkScore" | "transitScore" | "bikeScore";
export type PetPolicyFilter = "largeDog" | "smallDog" | "cat" | "noPets";
export type CommuteType = "office" | "other";
export type PriorityKey =
  | "price"
  | "commute"
  | "amenities"
  | "size"
  | "pets"
  | "neighborhood"
  | "homeType"
  | "moveInDate"
  | "bedsBaths";
export type AmenityKey =
  | "ac"
  | "pool"
  | "waterfront"
  | "parking"
  | "inUnitLaundry"
  | "zillowApplications"
  | "incomeRestricted"
  | "hardwoodFloors"
  | "disabledAccess"
  | "utilitiesIncluded"
  | "shortTermLease"
  | "furnished"
  | "outdoorSpace"
  | "controlledAccess"
  | "highSpeedInternet"
  | "elevator"
  | "apartmentCommunity";

export interface CommuteDestination {
  type: CommuteType;
  label: string;
  address: string;
}

export interface PreferencesState {
  moveInStart: string;
  moveInEnd: string;
  beds: BedroomOption;
  bedsExactMatch: boolean;
  baths: BathroomOption;
  hasPets: boolean;
  petTypes: PetType[];
  priceMin: number | null;
  priceMax: number | null;
  homeTypes: HomeType[];
  amenities: AmenityKey[];
  petPolicyFilters: PetPolicyFilter[];
  viewPreferences: ViewPreference[];
  neighborhoodScores: NeighborhoodScore[];
  commuteDestinations: CommuteDestination[];
  priorityWeights: Record<PriorityKey, number>;
  amenityWeights: Partial<Record<AmenityKey, number>>;
  neighborhoodViewWeights: Partial<Record<ViewPreference, number>>;
  neighborhoodScoreWeights: Partial<Record<NeighborhoodScore, number>>;
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

export interface WeightedScoringDimension {
  id: string;
  label: string;
  weightPercent: number;
}

export interface PreferenceScoreBreakdown {
  score: number;
  rank: number;
  normalized: Record<string, number>;
  contributions: Record<string, number>;
}
