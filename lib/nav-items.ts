import { LayoutDashboard, Package, Settings, ShoppingBasket, Users } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  roles: string[];
}

export const allNavItems: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, roles: ["admin"] },
  { href: "/orders", label: "Orders", icon: Package, roles: ["admin", "factory", "store"] },
  { href: "/products", label: "Products", icon: ShoppingBasket, roles: ["admin", "store"] },
  { href: "/users", label: "Users", icon: Users, roles: ["admin"] },
  { href: "/settings", label: "Settings", icon: Settings, roles: ["admin", "factory", "store"] },
];
