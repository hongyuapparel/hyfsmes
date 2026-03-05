'use client';

import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { ArrowUpRight, ArrowDownRight, Users, Package, TrendingUp, Clock } from 'lucide-react';
import SidebarNav from '@/components/sidebar-nav';
import TopNav from '@/components/top-nav';

// 模拟数据
const productionData = [
  { name: '周一', 完成: 240, 计划: 280, 进行中: 40 },
  { name: '周二', 完成: 290, 计划: 300, 进行中: 10 },
  { name: '周三', 完成: 200, 计划: 250, 进行中: 50 },
  { name: '周四', 完成: 320, 计划: 320, 进行中: 0 },
  { name: '周五', 完成: 280, 计划: 280, 进行中: 0 },
];

const orderStatusData = [
  { name: '已完成', value: 45, fill: '#10B981' },
  { name: '进行中', value: 30, fill: '#3B82F6' },
  { name: '待处理', value: 15, fill: '#F59E0B' },
  { name: '已延迟', value: 10, fill: '#EF4444' },
];

const stats = [
  {
    title: '本周生产',
    value: '1,330',
    unit: '件',
    change: '+12.5%',
    trend: 'up',
    icon: Package,
  },
  {
    title: '订单完成率',
    value: '94.2%',
    unit: '',
    change: '+2.3%',
    trend: 'up',
    icon: TrendingUp,
  },
  {
    title: '在线员工',
    value: '48',
    unit: '人',
    change: '+8.1%',
    trend: 'up',
    icon: Users,
  },
  {
    title: '平均周期',
    value: '3.2',
    unit: '天',
    change: '-0.5%',
    trend: 'down',
    icon: Clock,
  },
];

export default function DashboardPage() {
  return (
    <div className="flex h-screen bg-background">
      {/* 侧边栏 */}
      <SidebarNav />

      {/* 主内容区 */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* 顶部导航 */}
        <TopNav />

        {/* 主要内容 */}
        <main className="flex-1 overflow-auto">
          <div className="p-8 space-y-8">
            {/* 欢迎语 */}
            <div className="space-y-2">
              <h1 className="text-3xl font-bold text-foreground">欢迎回来，管理员</h1>
              <p className="text-muted-foreground">
                您的生产系统状态一切正常，本周订单进度良好
              </p>
            </div>

            {/* 统计卡片 */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {stats.map((stat, index) => {
                const Icon = stat.icon;
                const isUp = stat.trend === 'up';
                return (
                  <Card key={index} className="p-6 border-border/50 hover:border-border/80 transition-colors">
                    <div className="flex items-start justify-between">
                      <div className="space-y-3 flex-1">
                        <p className="text-sm font-medium text-muted-foreground">{stat.title}</p>
                        <div className="flex items-baseline gap-1">
                          <span className="text-3xl font-bold text-foreground">{stat.value}</span>
                          <span className="text-sm text-muted-foreground">{stat.unit}</span>
                        </div>
                      </div>
                      <div className="w-10 h-10 rounded-lg bg-secondary/10 flex items-center justify-center">
                        <Icon className="w-5 h-5 text-secondary" />
                      </div>
                    </div>
                    <div className={`flex items-center gap-1 mt-4 text-sm ${isUp ? 'text-green-600' : 'text-red-600'}`}>
                      {isUp ? (
                        <ArrowUpRight className="w-4 h-4" />
                      ) : (
                        <ArrowDownRight className="w-4 h-4" />
                      )}
                      <span className="font-semibold">{stat.change}</span>
                      <span className="text-muted-foreground">较上周</span>
                    </div>
                  </Card>
                );
              })}
            </div>

            {/* 图表区域 */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* 生产进度 */}
              <Card className="lg:col-span-2 p-6 border-border/50">
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-semibold text-foreground">本周生产进度</h3>
                      <p className="text-sm text-muted-foreground">完成 vs 计划 vs 进行中</p>
                    </div>
                    <Button variant="outline" size="sm" className="text-xs">
                      导出报表
                    </Button>
                  </div>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={productionData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" />
                      <YAxis stroke="hsl(var(--muted-foreground))" />
                      <Tooltip contentStyle={{
                        backgroundColor: 'hsl(var(--card))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '0.5rem',
                      }} />
                      <Legend />
                      <Bar dataKey="完成" fill="hsl(0, 84%, 60%)" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="进行中" fill="hsl(210, 100%, 50%)" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="计划" fill="hsl(210, 40%, 96%)" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </Card>

              {/* 订单状态分布 */}
              <Card className="p-6 border-border/50">
                <div className="space-y-6">
                  <div>
                    <h3 className="text-lg font-semibold text-foreground">订单状态分布</h3>
                    <p className="text-sm text-muted-foreground">当前订单统计</p>
                  </div>
                  <ResponsiveContainer width="100%" height={250}>
                    <PieChart>
                      <Pie
                        data={orderStatusData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={90}
                        paddingAngle={2}
                        dataKey="value"
                      >
                        {orderStatusData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.fill} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="space-y-2 text-sm">
                    {orderStatusData.map((item, index) => (
                      <div key={index} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: item.fill }} />
                          <span className="text-muted-foreground">{item.name}</span>
                        </div>
                        <span className="font-semibold text-foreground">{item.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </Card>
            </div>

            {/* 最近订单 */}
            <Card className="p-6 border-border/50">
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-semibold text-foreground">最近订单</h3>
                    <p className="text-sm text-muted-foreground">过去 7 天的订单列表</p>
                  </div>
                  <Button variant="ghost" size="sm" className="text-xs">
                    查看全部
                  </Button>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border/50">
                        <th className="text-left py-3 px-4 font-semibold text-foreground">订单号</th>
                        <th className="text-left py-3 px-4 font-semibold text-foreground">客户</th>
                        <th className="text-left py-3 px-4 font-semibold text-foreground">产品</th>
                        <th className="text-left py-3 px-4 font-semibold text-foreground">数量</th>
                        <th className="text-left py-3 px-4 font-semibold text-foreground">状态</th>
                        <th className="text-left py-3 px-4 font-semibold text-foreground">截止日期</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[
                        { id: 'ORD-2024001', customer: '品牌服饰A', product: 'T恤', qty: 500, status: '已完成', date: '2024-01-15' },
                        { id: 'ORD-2024002', customer: '快时尚B', product: '牛仔裤', qty: 300, status: '进行中', date: '2024-01-18' },
                        { id: 'ORD-2024003', customer: '运动品牌C', product: '运动服', qty: 800, status: '进行中', date: '2024-01-20' },
                        { id: 'ORD-2024004', customer: '高端品牌D', product: '衬衫', qty: 200, status: '待处理', date: '2024-01-25' },
                        { id: 'ORD-2024005', customer: '休闲品牌E', product: '连衣裙', qty: 450, status: '已完成', date: '2024-01-22' },
                      ].map((order) => (
                        <tr key={order.id} className="border-b border-border/30 hover:bg-muted/50 transition-colors">
                          <td className="py-3 px-4 font-semibold text-foreground">{order.id}</td>
                          <td className="py-3 px-4 text-foreground">{order.customer}</td>
                          <td className="py-3 px-4 text-foreground">{order.product}</td>
                          <td className="py-3 px-4 text-foreground">{order.qty}</td>
                          <td className="py-3 px-4">
                            <span className={`inline-block px-2 py-1 rounded text-xs font-semibold ${
                              order.status === '已完成' ? 'bg-green-100 text-green-800' :
                              order.status === '进行中' ? 'bg-blue-100 text-blue-800' :
                              'bg-amber-100 text-amber-800'
                            }`}>
                              {order.status}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-foreground">{order.date}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </Card>
          </div>
        </main>
      </div>
    </div>
  );
}
