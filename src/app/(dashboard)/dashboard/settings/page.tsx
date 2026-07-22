import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { requireSession } from "@/lib/auth/session";

export default async function SettingsPage() {
  const session = await requireSession();

  return (
    <section className="space-y-6">
      <div>
        <p className="text-sm text-muted-foreground">Workspace</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight">Settings</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Review your account and current test-environment configuration.
        </p>
      </div>
      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>Account</CardTitle>
          <CardDescription>
            Your authenticated Business Analytics Hub profile.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 text-sm sm:grid-cols-2">
          <div>
            <p className="text-muted-foreground">Name</p>
            <p className="mt-1 font-medium">{session.user.name}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Email</p>
            <p className="mt-1 font-medium">{session.user.email}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Environment</p>
            <Badge className="mt-1" variant="secondary">
              Production test
            </Badge>
          </div>
          <div>
            <p className="text-muted-foreground">Email delivery</p>
            <Badge className="mt-1" variant="outline">
              Temporarily disabled
            </Badge>
          </div>
        </CardContent>
      </Card>
    </section>
  );
}
