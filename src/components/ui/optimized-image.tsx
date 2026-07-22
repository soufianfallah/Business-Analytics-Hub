import Image, { type ImageProps } from "next/image";
import { cn } from "@/lib/utils";

/** Responsive image primitive with lazy loading, modern formats, and CLS prevention. */
export function OptimizedImage({
  alt,
  className,
  sizes = "(max-width: 768px) 100vw, 50vw",
  ...props
}: ImageProps) {
  return (
    <Image
      alt={alt}
      className={cn("object-cover", className)}
      loading={props.priority ? "eager" : "lazy"}
      sizes={sizes}
      {...props}
    />
  );
}
