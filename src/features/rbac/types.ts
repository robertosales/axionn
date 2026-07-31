export const RBAC_MODULE_KEYS = ["sala_agil", "sustentacao", "rdm"] as const;

export type RbacModuleKey = (typeof RBAC_MODULE_KEYS)[number];
export type RbacProfileCategory =
  | "governance"
  | "delivery"
  | "quality"
  | "support"
  | "custom";

export interface RbacPermission {
  key: string;
  label: string;
  description: string | null;
  groupKey: string;
  moduleKey: RbacModuleKey;
}

export interface RbacProfile {
  key: string;
  displayName: string;
  description: string;
  category: RbacProfileCategory;
  colorToken: string;
  iconName: string;
  moduleKeys: RbacModuleKey[];
  permissionKeys: string[];
  permissionCount: number;
  userCount: number;
  isSystem: boolean;
  isActive: boolean;
  updatedAt: string | null;
}

export interface RbacProfileDraft {
  profileKey: string | null;
  displayName: string;
  description: string;
  category: RbacProfileCategory;
  colorToken: string;
  iconName: string;
  moduleKeys: RbacModuleKey[];
  permissionKeys: string[];
}

export type RbacWizardMode = "create" | "edit" | "duplicate" | "view";

