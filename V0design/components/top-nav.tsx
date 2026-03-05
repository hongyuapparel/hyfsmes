'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Bell, Search, Settings, User } from 'lucide-react';

export default function TopNav() {
  return (
    <header className="h-16 border-b border-border/50 bg-card flex items-center justify-between px-8 sticky top-0 z-40">
      {/* 搜索框 */}
      <div className="flex-1 max-w-md">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="搜索订单、员工、产品..."
            className="pl-10 h-9 text-sm bg-muted border-border/50"
          />
        </div>
      </div>

      {/* 右侧操作 */}
      <div className="flex items-center gap-4 ml-auto">
        {/* 通知 */}
        <Button
          variant="ghost"
          size="icon"
          className="relative text-muted-foreground hover:text-foreground"
        >
          <Bell className="w-5 h-5" />
          <span className="absolute top-2 right-2 w-2 h-2 bg-destructive rounded-full" />
        </Button>

        {/* 设置 */}
        <Button
          variant="ghost"
          size="icon"
          className="text-muted-foreground hover:text-foreground"
        >
          <Settings className="w-5 h-5" />
        </Button>

        {/* 用户菜单 */}
        <Button
          variant="ghost"
          size="icon"
          className="text-muted-foreground hover:text-foreground"
        >
          <User className="w-5 h-5" />
        </Button>

        {/* 用户信息 */}
        <div className="flex items-center gap-2 ml-2 pl-4 border-l border-border/50">
          <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-xs font-bold text-primary-foreground">
            A
          </div>
          <div className="text-sm">
            <div className="font-semibold text-foreground">张管理员</div>
            <div className="text-xs text-muted-foreground">系统管理员</div>
          </div>
        </div>
      </div>
    </header>
  );
}
