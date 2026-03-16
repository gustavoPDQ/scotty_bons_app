"use client";

import { MobileSidebar } from "@/components/shared/mobile-sidebar";
import { Breadcrumbs } from "@/components/shared/breadcrumbs";
import { UserMenu } from "@/components/shared/user-menu";

interface HeaderProps {
  role: string;
  userName: string;
  userEmail: string;
}

export function Header({ role, userName, userEmail }: HeaderProps) {
  return (
    <header className="h-14 border-b flex items-center justify-between px-4 shrink-0">
      <div className="flex items-center gap-3">
        <MobileSidebar role={role} />
        <Breadcrumbs />
      </div>
      <UserMenu userName={userName} userEmail={userEmail} />
    </header>
  );
}
