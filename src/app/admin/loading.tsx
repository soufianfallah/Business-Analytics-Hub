import { Skeleton } from "@/components/ui/skeleton";
export default function AdminLoading() {
  return (
    <div className="mx-auto max-w-[1600px] space-y-6 p-6">
      <Skeleton className="h-10 w-72" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <Skeleton key={index} className="h-32 rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-[520px] rounded-xl" />
    </div>
  );
}
