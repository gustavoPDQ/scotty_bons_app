"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { allNavItems } from "@/lib/nav-items";

interface SidebarProps {
  role: string;
}

export function Sidebar({ role }: SidebarProps) {
  const pathname = usePathname();
  const navItems = allNavItems.filter((item) => item.roles.includes(role));

  return (
    <aside className="hidden md:flex md:flex-col w-56 shrink-0 border-r min-h-screen bg-muted/30">
      <div className="flex items-center px-5 h-14 border-b">
        <Image
          src="/logo_scottybons.png"
          alt="ScottyBons"
          width={140}
          height={32}
          priority
        />
      </div>
      <nav className="flex flex-col gap-0.5 p-3 pt-4">
        {navItems.map(({ href, label, icon: Icon }) => {
          const isActive = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-primary/20 text-foreground font-semibold"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <Icon className={cn("size-4", isActive && "text-primary")} />
              {label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
