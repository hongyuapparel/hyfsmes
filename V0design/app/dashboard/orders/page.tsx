'use client';

import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import SidebarNav from '@/components/sidebar-nav';
import TopNav from '@/components/top-nav';
import { Plus, Filter } from 'lucide-react';

export default function OrdersPage() {
  return (
    <div className="flex h-screen bg-background">
      <SidebarNav />
      <div className="flex-1 flex flex-col overflow-hidden">
        <TopNav />
        <main className="flex-1 overflow-auto">
          <div className="p-8 space-y-8">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold text-foreground">订单管理</h1>
                <p className="text-muted-foreground">
                  管理所有客户订单和生产计划
                </p>
              </div>
              <Button className="bg-primary hover:bg-primary/90 text-primary-foreground">
                <Plus className="w-4 h-4 mr-2" />
                新增订单
              </Button>
            </div>

            <Card className="p-6 border-border/50">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold text-foreground">订单列表</h3>
                <Button variant="outline" size="sm">
                  <Filter className="w-4 h-4 mr-2" />
                  筛选
                </Button>
              </div>
              <div className="text-center py-12">
                <p className="text-muted-foreground">订单管理功能开发中...</p>
              </div>
            </Card>
          </div>
        </main>
      </div>
    </div>
  );
}
