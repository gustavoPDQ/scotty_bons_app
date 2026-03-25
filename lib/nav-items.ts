import { ClipboardCheck, FileText, LayoutDashboard, Package, Settings, ShoppingBasket, Users } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  roles: string[];
}

export const allNavItems: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, roles: ["admin"] },
  { href: "/orders", label: "Orders", icon: Package, roles: ["admin", "commissary", "store"] },
  { href: "/invoices", label: "Invoices", icon: FileText, roles: ["admin", "commissary", "store"] },
  { href: "/audits", label: "Audits", icon: ClipboardCheck, roles: ["admin", "commissary", "store"] },
  { href: "/products", label: "Products", icon: ShoppingBasket, roles: ["admin", "store"] },
  { href: "/users", label: "Users", icon: Users, roles: ["admin"] },
  { href: "/settings", label: "Settings", icon: Settings, roles: ["admin", "commissary", "store"] },
];
