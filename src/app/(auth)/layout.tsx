import type { ReactNode } from "react";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <main className="container flex min-h-screen items-center justify-center py-10">
      {children}
    </main>
  );
}
