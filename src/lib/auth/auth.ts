import "server-only";

import { prismaAdapter } from "better-auth/adapters/prisma";
import { betterAuth } from "better-auth/minimal";
import { nextCookies } from "better-auth/next-js";
import { organization } from "better-auth/plugins";

import { assertWithinUsageLimit } from "@/features/billing/application/usage-limits";
import { safeRecordAudit } from "@/features/audit/application/audit-service";
import { authEmail, sendEmail } from "@/lib/email/email";
import { getServerEnv } from "@/lib/env";
import { prisma } from "@/lib/db/prisma";
import {
  ASSIGNABLE_ROLES,
  isOrganizationRole,
  organizationAccess,
  organizationRoles,
} from "@/lib/auth/organization-access";

const env = getServerEnv();

export const auth = betterAuth({
  appName: "Business Analytics Hub",
  baseURL: env.BETTER_AUTH_URL,
  secret: env.BETTER_AUTH_SECRET,
  database: prismaAdapter(prisma, { provider: "postgresql" }),
  databaseHooks: {
    session: {
      create: {
        async after(session) {
          await prisma.user.update({
            where: { id: session.userId },
            data: { lastLoginAt: new Date() },
          });
          const memberships = await prisma.organizationMember.findMany({
            where: { userId: session.userId, status: "ACTIVE" },
            select: { organizationId: true },
          });
          await Promise.all(
            memberships.map(({ organizationId }) =>
              safeRecordAudit({
                organizationId,
                userId: session.userId,
                action: "LOGIN",
                entityType: "Session",
                entityId: session.id,
                description: "User signed in",
                ipAddress: session.ipAddress,
                userAgent: session.userAgent,
              }),
            ),
          );
        },
      },
      delete: {
        async after(session) {
          const memberships = await prisma.organizationMember.findMany({
            where: { userId: session.userId, status: "ACTIVE" },
            select: { organizationId: true },
          });
          await Promise.all(
            memberships.map(({ organizationId }) =>
              safeRecordAudit({
                organizationId,
                userId: session.userId,
                action: "LOGOUT",
                entityType: "Session",
                entityId: session.id,
                description: "User signed out",
                ipAddress: session.ipAddress,
                userAgent: session.userAgent,
              }),
            ),
          );
        },
      },
    },
  },
  advanced: { database: { generateId: "uuid" } },
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,
    minPasswordLength: 8,
    maxPasswordLength: 128,
    resetPasswordTokenExpiresIn: 3600,
    async sendResetPassword({ user, url }) {
      const content = authEmail({
        heading: "Reset your password",
        message: `Hello ${user.name}, use the link below to choose a new password. It expires in one hour.`,
        action: "Reset password",
        url,
      });
      await sendEmail({
        to: user.email,
        subject: "Reset your Business Analytics Hub password",
        ...content,
      });
    },
  },
  emailVerification: {
    sendOnSignUp: true,
    autoSignInAfterVerification: true,
    expiresIn: 3600,
    async sendVerificationEmail({ user, url }) {
      const content = authEmail({
        heading: "Verify your email",
        message: `Hello ${user.name}, confirm your email address to activate your account.`,
        action: "Verify email",
        url,
      });
      await sendEmail({
        to: user.email,
        subject: "Verify your Business Analytics Hub email",
        ...content,
      });
    },
  },
  plugins: [
    organization({
      ac: organizationAccess,
      roles: organizationRoles,
      creatorRole: "owner",
      allowUserToCreateOrganization: true,
      requireEmailVerificationOnInvitation: true,
      schema: {
        session: { fields: { activeOrganizationId: "activeOrganizationId" } },
        organization: {
          modelName: "Organization",
          fields: { logo: "logoUrl" },
        },
        member: {
          modelName: "OrganizationMember",
          fields: { role: "authRole" },
        },
        invitation: {
          modelName: "Invitation",
          fields: { inviterId: "invitedById" },
        },
      },
      organizationHooks: {
        async afterCreateOrganization({ organization, user }) {
          await safeRecordAudit({
            organizationId: organization.id,
            userId: user.id,
            action: "ORGANIZATION_CHANGE",
            entityType: "Organization",
            entityId: organization.id,
            description: "Organization created",
            changes: { name: organization.name, slug: organization.slug },
          });
        },
        async afterUpdateOrganization({ organization, user }) {
          if (organization)
            await safeRecordAudit({
              organizationId: organization.id,
              userId: user.id,
              action: "ORGANIZATION_CHANGE",
              entityType: "Organization",
              entityId: organization.id,
              description: "Organization settings updated",
              changes: { name: organization.name, slug: organization.slug },
            });
        },
        async beforeDeleteOrganization({ organization, user }) {
          await safeRecordAudit({
            organizationId: organization.id,
            userId: user.id,
            action: "ORGANIZATION_CHANGE",
            entityType: "Organization",
            entityId: organization.id,
            description: "Organization deletion requested",
            changes: { name: organization.name, slug: organization.slug },
          });
        },
        async afterAddMember({ member, user, organization }) {
          await safeRecordAudit({
            organizationId: organization.id,
            userId: user.id,
            action: "CREATE",
            entityType: "OrganizationMember",
            entityId: member.id,
            description: "Organization member added",
            changes: { memberUserId: member.userId, role: member.role },
          });
        },
        async afterRemoveMember({ member, user, organization }) {
          await safeRecordAudit({
            organizationId: organization.id,
            userId: user.id,
            action: "DELETE",
            entityType: "OrganizationMember",
            entityId: member.id,
            description: "Organization member removed",
            changes: { memberUserId: member.userId, role: member.role },
          });
        },
        async afterUpdateMemberRole({
          member,
          previousRole,
          user,
          organization,
        }) {
          await safeRecordAudit({
            organizationId: organization.id,
            userId: user.id,
            action: "ROLE_CHANGE",
            entityType: "OrganizationMember",
            entityId: member.id,
            description: "Member role changed",
            changes: {
              memberUserId: member.userId,
              from: previousRole,
              to: member.role,
            },
          });
        },
        async beforeCreateInvitation({ invitation }) {
          await assertWithinUsageLimit(invitation.organizationId, "members");
          const inviterMembership = await prisma.organizationMember.findUnique({
            where: {
              organizationId_userId: {
                organizationId: invitation.organizationId,
                userId: invitation.inviterId,
              },
            },
            select: { authRole: true },
          });
          const requestedRole = invitation.role.split(",")[0] ?? "";
          if (
            !inviterMembership ||
            !isOrganizationRole(inviterMembership.authRole) ||
            !isOrganizationRole(requestedRole) ||
            !ASSIGNABLE_ROLES[inviterMembership.authRole].includes(
              requestedRole,
            )
          ) {
            throw new Error("You cannot assign that organization role.");
          }
        },
        async afterCreateInvitation({ invitation, inviter, organization }) {
          await safeRecordAudit({
            organizationId: organization.id,
            userId: inviter.id,
            action: "INVITE",
            entityType: "Invitation",
            entityId: invitation.id,
            description: "Organization invitation created",
            changes: { email: invitation.email, role: invitation.role },
          });
        },
        async afterAcceptInvitation({
          invitation,
          member,
          user,
          organization,
        }) {
          await safeRecordAudit({
            organizationId: organization.id,
            userId: user.id,
            action: "ACCEPT_INVITATION",
            entityType: "Invitation",
            entityId: invitation.id,
            description: "Organization invitation accepted",
            changes: { memberId: member.id, role: member.role },
          });
        },
      },
      async sendInvitationEmail(data) {
        const url = `${env.BETTER_AUTH_URL}/accept-invitation?id=${encodeURIComponent(data.id)}`;
        const content = authEmail({
          heading: `Join ${data.organization.name}`,
          message: `${data.inviter.user.name} invited you to join their organization in Business Analytics Hub.`,
          action: "Accept invitation",
          url,
        });
        await sendEmail({
          to: data.email,
          subject: `Invitation to ${data.organization.name}`,
          ...content,
        });
      },
    }),
    nextCookies(),
  ],
});

export type Session = typeof auth.$Infer.Session;
