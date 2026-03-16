"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { allNavItems } from "@/lib/nav-items";

export function Breadcrumbs() {
  const pathname = usePathname();

  const currentItem = allNavItems.find((item) => item.href === pathname);
  const label = currentItem?.label ?? null;

  return (
    <nav aria-label="Breadcrumb" className="text-sm flex items-center gap-1.5">
      {label && pathname !== "/dashboard" ? (
        <>
          <Link
            href="/dashboard"
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            Home
          </Link>
          <span className="text-muted-foreground">/</span>
          <span className="font-medium">{label}</span>
        </>
      ) : (
        <span className="font-medium">Home</span>
      )}
    </nav>
  );
}
