import Link from "next/link";

export default function NotFound() {
  return (
    <main className="container flex min-h-screen flex-col items-center justify-center gap-4 text-center">
      <h1 className="text-2xl font-semibold">Page not found</h1>
      <Link className="underline underline-offset-4" href="/">
        Return home
      </Link>
    </main>
  );
}
