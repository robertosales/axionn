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
  isPrivileged?: boolean;
  riskLevel?: "high" | "critical";
  riskReason?: string;
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

export type RbacAuditAction =
  | "rbac_profile_created"
  | "rbac_profile_updated"
  | "rbac_profile_archived"
  | "member_profile_managed"
  | "rbac_profile_change_requested"
  | "rbac_profile_change_approved"
  | "rbac_profile_change_rejected";

export interface RbacGovernanceRequest {
  id: string;
  profileKey: string;
  changeType: "create" | "update";
  riskLevel: "high" | "critical";
  riskReasons: string[];
  proposedSnapshot: Record<string, unknown>;
  requestedBy: string;
  requesterName: string;
  createdAt: string;
  expiresAt: string;
  canReview: boolean;
}

export interface RbacTemporaryAssignment {
  userId: string;
  displayName: string;
  moduleKey: RbacModuleKey;
  profileKey: string;
  profileName: string;
  expiresAt: string;
  justification: string;
  isExpired: boolean;
}

export interface RbacLeastPrivilegeRecommendation {
  id: string;
  userId: string;
  displayName: string;
  moduleKey: RbacModuleKey;
  profileKey: string;
  profileName: string;
  severity: "medium" | "high";
  kind: "expired_access" | "inactive_member_access" | "low_activity";
  lastActivityAt: string | null;
  events90d: number;
  evidence: string;
}

export interface RbacGovernanceOverview {
  pendingRequests: RbacGovernanceRequest[];
  temporaryAssignments: RbacTemporaryAssignment[];
  recommendations: RbacLeastPrivilegeRecommendation[];
  generatedAt: string;
  activityWindowDays: number;
}

export interface RbacAuditEvent {
  id: string;
  action: RbacAuditAction;
  actorId: string | null;
  actorName: string;
  subjectUserId: string | null;
  subjectName: string | null;
  profileKey: string | null;
  details: Record<string, unknown>;
  createdAt: string;
}

export interface RbacMemberOption {
  userId: string;
  displayName: string;
  email: string;
  membershipRole: string;
  isActive: boolean;
}

export interface RbacSimulatedPermission {
  key: string;
  label: string;
  description: string | null;
  groupKey: string;
}

export interface RbacSimulatedModuleProfile {
  moduleKey: RbacModuleKey;
  profileKey: string;
  profileName: string;
  isProfileActive: boolean;
  permissionCount: number;
  permissions: RbacSimulatedPermission[];
}

export interface RbacAccessSimulation {
  userId: string;
  displayName: string;
  membershipRole: string;
  isActive: boolean;
  hasAdministrativeBypass: boolean;
  permissionCount: number;
  moduleProfiles: RbacSimulatedModuleProfile[];
}
