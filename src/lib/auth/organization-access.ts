import { createAccessControl } from "better-auth/plugins/access";
import { defaultStatements } from "better-auth/plugins/organization/access";

const statements = {
  ...defaultStatements,
  dashboard: ["create", "read", "update", "delete"],
  dataset: ["create", "read", "update", "delete"],
  report: ["create", "read", "update", "delete"],
  billing: ["read", "update"],
  audit: ["read"],
} as const;

export const organizationAccess = createAccessControl(statements);

export const ownerRole = organizationAccess.newRole({
  organization: ["update", "delete"],
  member: ["create", "update", "delete"],
  invitation: ["create", "cancel"],
  dashboard: ["create", "read", "update", "delete"],
  dataset: ["create", "read", "update", "delete"],
  report: ["create", "read", "update", "delete"],
  billing: ["read", "update"],
  audit: ["read"],
});

export const adminRole = organizationAccess.newRole({
  organization: ["update"],
  member: ["create", "delete"],
  invitation: ["create", "cancel"],
  dashboard: ["create", "read", "update", "delete"],
  dataset: ["create", "read", "update", "delete"],
  report: ["create", "read", "update", "delete"],
  billing: ["read"],
  audit: ["read"],
});

export const managerRole = organizationAccess.newRole({
  organization: [],
  member: [],
  invitation: ["create", "cancel"],
  dashboard: ["create", "read", "update", "delete"],
  dataset: ["create", "read", "update", "delete"],
  report: ["create", "read", "update", "delete"],
  billing: [],
  audit: ["read"],
});

export const analystRole = organizationAccess.newRole({
  organization: [],
  member: [],
  invitation: [],
  dashboard: ["create", "read", "update"],
  dataset: ["create", "read", "update"],
  report: ["create", "read", "update"],
  billing: [],
  audit: [],
});

export const viewerRole = organizationAccess.newRole({
  organization: [],
  member: [],
  invitation: [],
  dashboard: ["read"],
  dataset: ["read"],
  report: ["read"],
  billing: [],
  audit: [],
});

export const organizationRoles = {
  owner: ownerRole,
  admin: adminRole,
  manager: managerRole,
  analyst: analystRole,
  viewer: viewerRole,
} as const;

export type OrganizationRole = keyof typeof organizationRoles;

export const ORGANIZATION_ROLE_LABELS: Record<OrganizationRole, string> = {
  owner: "Owner",
  admin: "Admin",
  manager: "Manager",
  analyst: "Analyst",
  viewer: "Viewer",
};

export const ORGANIZATION_ROLE_RANK: Record<OrganizationRole, number> = {
  owner: 5,
  admin: 4,
  manager: 3,
  analyst: 2,
  viewer: 1,
};

export const ASSIGNABLE_ROLES: Record<OrganizationRole, OrganizationRole[]> = {
  owner: ["admin", "manager", "analyst", "viewer"],
  admin: ["manager", "analyst", "viewer"],
  manager: ["analyst", "viewer"],
  analyst: [],
  viewer: [],
};

export function isOrganizationRole(role: string): role is OrganizationRole {
  return role in organizationRoles;
}
