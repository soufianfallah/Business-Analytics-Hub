import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function HelpPage() {
  return (
    <section className="space-y-6">
      <div>
        <p className="text-sm text-muted-foreground">Support</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight">
          Help &amp; support
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Quick links for testing the analytics workflow.
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Start with data</CardTitle>
            <CardDescription>
              Upload a CSV, validate its columns, and create a dataset.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <Link href="/dashboard/datasets/upload">Upload CSV</Link>
            </Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Manage your workspace</CardTitle>
            <CardDescription>
              Create an organization and manage its members and roles.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild variant="outline">
              <Link href="/dashboard/organizations">Open organizations</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
