"use client";

import {
  Building2,
  Check,
  Copy,
  Crown,
  LogOut,
  MoreHorizontal,
  Plus,
  Trash2,
  UserMinus,
  UserPlus,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { AsyncButton } from "@/components/ui/async-button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { authClient } from "@/lib/auth/auth-client";
import {
  ASSIGNABLE_ROLES,
  isOrganizationRole,
  ORGANIZATION_ROLE_LABELS,
  type OrganizationRole,
} from "@/lib/auth/organization-access";

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function firstRole(value: string): OrganizationRole {
  const role = value.split(",")[0] ?? "viewer";
  return isOrganizationRole(role) ? role : "viewer";
}

export function OrganizationManager({ userId }: { userId: string }) {
  const router = useRouter();
  const organizations = authClient.useListOrganizations();
  const activeOrganization = authClient.useActiveOrganization();
  const [error, setError] = useState<string>();
  const [pendingAction, setPendingAction] = useState<string>();

  const currentMember = activeOrganization.data?.members.find(
    (member) => member.userId === userId,
  );
  const currentRole = firstRole(currentMember?.role ?? "viewer");
  const canInvite = ASSIGNABLE_ROLES[currentRole].length > 0;
  const canManageRoles = currentRole === "owner";
  const canRemoveMembers = currentRole === "owner" || currentRole === "admin";

  async function refreshOrganizations() {
    await Promise.all([organizations.refetch(), activeOrganization.refetch()]);
    router.refresh();
  }

  async function runAction(
    key: string,
    action: () => Promise<{ error?: { message?: string } | null }>,
  ) {
    setPendingAction(key);
    setError(undefined);
    const result = await action();
    setPendingAction(undefined);
    if (result.error) {
      setError(
        result.error.message ??
          "The organization action could not be completed.",
      );
      return false;
    }
    await refreshOrganizations();
    return true;
  }

  if (organizations.isPending || activeOrganization.isPending)
    return <OrganizationSkeleton />;

  return (
    <div className="space-y-6">
      {error ? (
        <div
          className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive"
          role="alert"
        >
          {error}
        </div>
      ) : null}
      <div className="grid gap-6 xl:grid-cols-[18rem_1fr]">
        <Card className="h-fit">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base">Workspaces</CardTitle>
                <CardDescription>Switch organizations</CardDescription>
              </div>
              <CreateOrganizationDialog onCreated={refreshOrganizations} />
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {organizations.data?.length ? (
              organizations.data.map((organization) => {
                const isActive =
                  organization.id === activeOrganization.data?.id;
                return (
                  <button
                    className={`flex w-full items-center gap-3 rounded-lg border px-3 py-3 text-left transition-colors ${isActive ? "border-foreground/20 bg-accent" : "border-transparent hover:bg-accent/60"}`}
                    key={organization.id}
                    type="button"
                    onClick={async () => {
                      if (isActive) return;
                      await runAction(`switch-${organization.id}`, () =>
                        authClient.organization.setActive({
                          organizationId: organization.id,
                        }),
                      );
                    }}
                  >
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-md border bg-background">
                      <Building2 className="size-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">
                        {organization.name}
                      </span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {organization.slug}
                      </span>
                    </span>
                    {isActive ? (
                      <Check className="size-4" />
                    ) : pendingAction === `switch-${organization.id}` ? (
                      <span className="size-3 animate-pulse rounded-full bg-muted-foreground" />
                    ) : null}
                  </button>
                );
              })
            ) : (
              <EmptyState
                compact
                title="No organizations"
                description="Create your first organization to begin."
              />
            )}
          </CardContent>
        </Card>

        {activeOrganization.data ? (
          <div className="min-w-0 space-y-6">
            <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-2xl font-semibold tracking-tight">
                    {activeOrganization.data.name}
                  </h2>
                  <RoleBadge role={currentRole} />
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  /{activeOrganization.data.slug}
                </p>
              </div>
              {canInvite ? (
                <InviteMemberDialog
                  assignableRoles={ASSIGNABLE_ROLES[currentRole]}
                  organizationId={activeOrganization.data.id}
                  onInvited={refreshOrganizations}
                />
              ) : null}
            </div>

            <Tabs defaultValue="members">
              <TabsList>
                <TabsTrigger value="members">
                  Members ({activeOrganization.data.members.length})
                </TabsTrigger>
                <TabsTrigger value="invitations">
                  Invitations ({activeOrganization.data.invitations.length})
                </TabsTrigger>
                <TabsTrigger value="settings">Settings</TabsTrigger>
              </TabsList>
              <TabsContent className="mt-4" value="members">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">
                      Organization members
                    </CardTitle>
                    <CardDescription>
                      Roles determine what each person can access and manage.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="p-0">
                    <div className="divide-y">
                      {activeOrganization.data.members.map((member) => {
                        const role = firstRole(member.role);
                        const isCurrentUser = member.userId === userId;
                        return (
                          <div
                            className="flex items-center gap-3 px-6 py-4"
                            key={member.id}
                          >
                            <Avatar className="size-9">
                              <AvatarImage
                                alt=""
                                src={member.user.image ?? undefined}
                              />
                              <AvatarFallback>
                                {member.user.name.slice(0, 2).toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <p className="truncate text-sm font-medium">
                                  {member.user.name}
                                </p>
                                {isCurrentUser ? (
                                  <span className="text-xs text-muted-foreground">
                                    You
                                  </span>
                                ) : null}
                              </div>
                              <p className="truncate text-xs text-muted-foreground">
                                {member.user.email}
                              </p>
                            </div>
                            {canManageRoles &&
                            !isCurrentUser &&
                            role !== "owner" ? (
                              <Select
                                value={role}
                                onValueChange={async (
                                  value: OrganizationRole,
                                ) => {
                                  await runAction(`role-${member.id}`, () =>
                                    authClient.organization.updateMemberRole({
                                      memberId: member.id,
                                      organizationId:
                                        activeOrganization.data!.id,
                                      role: value,
                                    }),
                                  );
                                }}
                              >
                                <SelectTrigger
                                  className="w-32"
                                  disabled={
                                    pendingAction === `role-${member.id}`
                                  }
                                >
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {ASSIGNABLE_ROLES.owner.map((value) => (
                                    <SelectItem key={value} value={value}>
                                      {ORGANIZATION_ROLE_LABELS[value]}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            ) : (
                              <RoleBadge role={role} />
                            )}
                            {canRemoveMembers &&
                            !isCurrentUser &&
                            role !== "owner" ? (
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button size="icon" variant="ghost">
                                    <MoreHorizontal className="size-4" />
                                    <span className="sr-only">
                                      Member actions
                                    </span>
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem
                                    className="text-destructive focus:text-destructive"
                                    onSelect={async () => {
                                      await runAction(
                                        `remove-${member.id}`,
                                        () =>
                                          authClient.organization.removeMember({
                                            memberIdOrEmail: member.id,
                                            organizationId:
                                              activeOrganization.data!.id,
                                          }),
                                      );
                                    }}
                                  >
                                    <UserMinus className="size-4" />
                                    Remove member
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            ) : (
                              <div className="w-9" />
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
              <TabsContent className="mt-4" value="invitations">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">
                      Pending invitations
                    </CardTitle>
                    <CardDescription>
                      Invitations expire automatically and can be cancelled by
                      authorized roles.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {activeOrganization.data.invitations.length ? (
                      <div className="divide-y rounded-lg border">
                        {activeOrganization.data.invitations.map(
                          (invitation) => (
                            <div
                              className="flex items-center gap-4 p-4"
                              key={invitation.id}
                            >
                              <div className="flex size-9 items-center justify-center rounded-full bg-muted">
                                <UserPlus className="size-4" />
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="truncate text-sm font-medium">
                                  {invitation.email}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  Expires{" "}
                                  {new Date(
                                    invitation.expiresAt,
                                  ).toLocaleDateString()}
                                </p>
                              </div>
                              <RoleBadge role={firstRole(invitation.role)} />
                              {canInvite ? (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={async () => {
                                    await runAction(
                                      `cancel-${invitation.id}`,
                                      () =>
                                        authClient.organization.cancelInvitation(
                                          { invitationId: invitation.id },
                                        ),
                                    );
                                  }}
                                >
                                  Cancel
                                </Button>
                              ) : null}
                            </div>
                          ),
                        )}
                      </div>
                    ) : (
                      <EmptyState
                        compact
                        icon={UserPlus}
                        title="No pending invitations"
                        description="Invite teammates to collaborate in this organization."
                      />
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
              <TabsContent className="mt-4 space-y-4" value="settings">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">
                      Organization details
                    </CardTitle>
                    <CardDescription>
                      Use this identifier when integrating organization-scoped
                      APIs.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-2">
                      <Input readOnly value={activeOrganization.data.id} />
                      <Button
                        size="icon"
                        variant="outline"
                        onClick={() =>
                          navigator.clipboard.writeText(
                            activeOrganization.data!.id,
                          )
                        }
                      >
                        <Copy className="size-4" />
                        <span className="sr-only">Copy organization ID</span>
                      </Button>
                    </div>
                  </CardContent>
                </Card>
                <Card className="border-destructive/30">
                  <CardHeader>
                    <CardTitle className="text-base text-destructive">
                      Danger zone
                    </CardTitle>
                    <CardDescription>
                      Leaving or deleting an organization cannot be undone.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="flex flex-wrap gap-3">
                    {currentRole !== "owner" ? (
                      <ConfirmOrganizationAction
                        title="Leave organization?"
                        description="You will lose access to this organization's dashboards, reports, and datasets."
                        actionLabel="Leave organization"
                        triggerLabel="Leave organization"
                        icon={LogOut}
                        pending={pendingAction === "leave"}
                        onConfirm={() =>
                          runAction("leave", () =>
                            authClient.organization.leave({
                              organizationId: activeOrganization.data!.id,
                            }),
                          )
                        }
                      />
                    ) : null}
                    {currentRole === "owner" ? (
                      <ConfirmOrganizationAction
                        destructive
                        title="Delete organization permanently?"
                        description="All organization data, memberships, invitations, dashboards, reports, and datasets will be deleted."
                        actionLabel="Delete permanently"
                        triggerLabel="Delete organization"
                        icon={Trash2}
                        pending={pendingAction === "delete"}
                        onConfirm={() =>
                          runAction("delete", () =>
                            authClient.organization.delete({
                              organizationId: activeOrganization.data!.id,
                            }),
                          )
                        }
                      />
                    ) : null}
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>
        ) : (
          <EmptyState
            icon={Building2}
            title="Select an organization"
            description="Choose a workspace from the list or create a new organization."
          />
        )}
      </div>
    </div>
  );
}

function CreateOrganizationDialog({
  onCreated,
}: {
  onCreated: () => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="icon" variant="outline">
          <Plus className="size-4" />
          <span className="sr-only">Create organization</span>
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create organization</DialogTitle>
          <DialogDescription>
            Create a separate workspace for a company, client, or team.
          </DialogDescription>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={async (event) => {
            event.preventDefault();
            const slug = slugify(name);
            if (name.trim().length < 2 || !slug)
              return setError("Enter a valid organization name.");
            setPending(true);
            setError(undefined);
            const result = await authClient.organization.create({
              name: name.trim(),
              slug,
            });
            setPending(false);
            if (result.error)
              return setError(
                result.error.message ?? "Unable to create organization.",
              );
            if (result.data)
              await authClient.organization.setActive({
                organizationId: result.data.id,
              });
            setName("");
            setOpen(false);
            await onCreated();
          }}
        >
          <div className="space-y-2">
            <Label htmlFor="organization-name">Organization name</Label>
            <Input
              id="organization-name"
              maxLength={80}
              onChange={(event) => setName(event.target.value)}
              placeholder="Acme Inc."
              value={name}
            />
          </div>
          {error ? (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          ) : null}
          <DialogFooter>
            <AsyncButton
              loading={pending}
              loadingText="Creating…"
              type="submit"
            >
              Create organization
            </AsyncButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function InviteMemberDialog({
  organizationId,
  assignableRoles,
  onInvited,
}: {
  organizationId: string;
  assignableRoles: OrganizationRole[];
  onInvited: () => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<OrganizationRole>(
    assignableRoles[0] ?? "viewer",
  );
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <UserPlus className="size-4" />
          Invite member
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Invite a teammate</DialogTitle>
          <DialogDescription>
            They will receive an email with a secure invitation link.
          </DialogDescription>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={async (event) => {
            event.preventDefault();
            setPending(true);
            setError(undefined);
            const result = await authClient.organization.inviteMember({
              email: email.trim(),
              role,
              organizationId,
            });
            setPending(false);
            if (result.error)
              return setError(
                result.error.message ?? "Unable to send invitation.",
              );
            setEmail("");
            setOpen(false);
            await onInvited();
          }}
        >
          <div className="space-y-2">
            <Label htmlFor="invite-email">Email</Label>
            <Input
              id="invite-email"
              type="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="teammate@company.com"
            />
          </div>
          <div className="space-y-2">
            <Label>Role</Label>
            <Select
              value={role}
              onValueChange={(value: OrganizationRole) => setRole(value)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {assignableRoles.map((value) => (
                  <SelectItem key={value} value={value}>
                    {ORGANIZATION_ROLE_LABELS[value]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {error ? (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          ) : null}
          <DialogFooter>
            <AsyncButton loading={pending} loadingText="Sending…" type="submit">
              Send invitation
            </AsyncButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ConfirmOrganizationAction({
  title,
  description,
  actionLabel,
  triggerLabel,
  icon: Icon,
  onConfirm,
  pending,
  destructive = false,
}: {
  title: string;
  description: string;
  actionLabel: string;
  triggerLabel: string;
  icon: typeof Trash2;
  onConfirm: () => Promise<boolean>;
  pending: boolean;
  destructive?: boolean;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant={destructive ? "destructive" : "outline"}>
          <Icon className="size-4" />
          {triggerLabel}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <AsyncButton
            variant={destructive ? "destructive" : "default"}
            loading={pending}
            loadingText="Working…"
            onClick={async () => {
              const success = await onConfirm();
              if (success) setOpen(false);
            }}
          >
            {actionLabel}
          </AsyncButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RoleBadge({ role }: { role: OrganizationRole }) {
  return (
    <Badge variant={role === "owner" ? "default" : "secondary"}>
      {role === "owner" ? <Crown className="mr-1 size-3" /> : null}
      {ORGANIZATION_ROLE_LABELS[role]}
    </Badge>
  );
}

function OrganizationSkeleton() {
  return (
    <div
      className="grid gap-6 xl:grid-cols-[18rem_1fr]"
      aria-label="Loading organizations"
      aria-busy="true"
    >
      <Skeleton className="h-80 rounded-xl" />
      <div className="space-y-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-11 w-80" />
        <Skeleton className="h-96 rounded-xl" />
      </div>
    </div>
  );
}
