'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import {
  LayoutDashboard,
  Package,
  Users,
  Settings,
  BarChart3,
  Zap,
  CheckSquare,
  LogOut,
} from 'lucide-react';

const navItems = [
  {
    title: '仪表板',
    href: '/dashboard',
    icon: LayoutDashboard,
  },
  {
    title: '订单管理',
    href: '/dashboard/orders',
    icon: Package,
  },
  {
    title: '生产计划',
    href: '/dashboard/production',
    icon: Zap,
  },
  {
    title: '员工管理',
    href: '/dashboard/employees',
    icon: Users,
  },
  {
    title: '质量检查',
    href: '/dashboard/quality',
    icon: CheckSquare,
  },
  {
    title: '数据分析',
    href: '/dashboard/analytics',
    icon: BarChart3,
  },
  {
    title: '系统设置',
    href: '/dashboard/settings',
    icon: Settings,
  },
];

export default function SidebarNav() {
  const pathname = usePathname();

  return (
    <aside className="w-64 bg-sidebar border-r border-sidebar-border flex flex-col">
      {/* Logo */}
      <div className="h-16 flex items-center px-6 border-b border-sidebar-border">
        <Link href="/dashboard" className="flex items-center gap-2">
          <div className="w-10 h-10 rounded-lg bg-sidebar-accent flex items-center justify-center">
            <span className="text-white font-bold text-lg">F</span>
          </div>
          <div>
            <div className="font-bold text-sidebar-foreground text-sm leading-none">生产管理</div>
            <div className="text-xs text-sidebar-accent">Pro</div>
          </div>
        </Link>
      </div>

      {/* 导航菜单 */}
      <nav className="flex-1 px-3 py-6 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
          
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-colors text-sm font-medium ${
                isActive
                  ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                  : 'text-sidebar-foreground hover:bg-sidebar-border/50'
              }`}
            >
              <Icon className="w-5 h-5" />
              <span>{item.title}</span>
            </Link>
          );
        })}
      </nav>

      {/* 底部用户菜单 */}
      <div className="p-3 border-t border-sidebar-border space-y-2">
        <button className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sidebar-foreground hover:bg-sidebar-border/50 transition-colors text-sm font-medium">
          <LogOut className="w-5 h-5" />
          <span>退出登录</span>
        </button>
      </div>
    </aside>
  );
}
