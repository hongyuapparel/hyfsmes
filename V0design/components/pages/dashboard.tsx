'use client'

import { BarChart3, Package, Users, ShoppingCart } from 'lucide-react'

export default function Dashboard() {
  return (
    <div className="p-8">
      {/* 欢迎区 */}
      <div className="mb-8">
        <h2 className="text-3xl font-bold mb-2 text-pretty">欢迎回来</h2>
        <p className="text-muted-foreground">实时监控您的生产流程和关键指标</p>
      </div>

      {/* KPI 卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {[
          { label: '今日订单', value: '2,450', change: '+12%', icon: ShoppingCart },
          { label: '在产数量', value: '15.2K', change: '+8%', icon: Package },
          { label: '完成率', value: '94.2%', change: '+2.3%', icon: BarChart3 },
          { label: '库存预警', value: '8', change: '-2%', icon: Users },
        ].map((card, i) => {
          const Icon = card.icon
          return (
            <div key={i} className="bg-card border border-border rounded-xl p-6 hover:border-primary/50 transition-colors">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <p className="text-muted-foreground text-sm font-medium">{card.label}</p>
                  <h3 className="text-2xl font-bold mt-2">{card.value}</h3>
                </div>
                <div className="p-3 rounded-lg bg-primary/10">
                  <Icon className="w-5 h-5 text-primary" />
                </div>
              </div>
              <p className="text-accent text-sm font-medium">{card.change}</p>
            </div>
          )
        })}
      </div>

      {/* 图表区域 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        {/* 左侧大图表 */}
        <div className="lg:col-span-2 bg-card border border-border rounded-xl p-6">
          <h3 className="text-lg font-bold mb-6">生产趋势</h3>
          <div className="h-64 bg-muted/50 rounded-lg flex items-end justify-around px-6 py-4 gap-2">
            {[40, 65, 45, 78, 55, 85, 60, 72].map((height, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-2 group cursor-pointer">
                <div className="text-xs text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity">{height}%</div>
                <div
                  className="w-full bg-gradient-to-t from-primary to-accent rounded-t-lg hover:from-accent hover:to-primary transition-all duration-300 hover:shadow-lg hover:shadow-primary/50"
                  style={{ height: `${height}%` }}
                ></div>
              </div>
            ))}
          </div>
        </div>

        {/* 右侧小卡片 */}
        <div className="space-y-6">
          <div className="bg-card border border-border rounded-xl p-6">
            <h3 className="text-sm font-bold text-muted-foreground mb-4">效率指标</h3>
            <div className="space-y-4">
              {[
                { name: '设备利用率', value: 87 },
                { name: '品质通过率', value: 94 },
                { name: '交期达成率', value: 91 },
              ].map((metric, i) => (
                <div key={i}>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm font-medium">{metric.name}</span>
                    <span className="text-primary font-bold">{metric.value}%</span>
                  </div>
                  <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-primary to-accent rounded-full"
                      style={{ width: `${metric.value}%` }}
                    ></div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-gradient-to-br from-primary/10 to-accent/10 border border-primary/30 rounded-xl p-6">
            <p className="text-sm font-medium text-muted-foreground mb-3">💡 优化建议</p>
            <p className="text-sm leading-relaxed">现在是调整生产计划以提高下周效率的最佳时机。</p>
          </div>
        </div>
      </div>

      {/* 底部表格 */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="p-6 border-b border-border">
          <h3 className="text-lg font-bold">最近订单</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-muted/50 border-b border-border">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-bold text-muted-foreground">订单号</th>
                <th className="px-6 py-3 text-left text-xs font-bold text-muted-foreground">客户名称</th>
                <th className="px-6 py-3 text-left text-xs font-bold text-muted-foreground">数量</th>
                <th className="px-6 py-3 text-left text-xs font-bold text-muted-foreground">状态</th>
                <th className="px-6 py-3 text-left text-xs font-bold text-muted-foreground">进度</th>
              </tr>
            </thead>
            <tbody>
              {[
                { id: 'PO-2024-001', customer: '品牌 A', qty: '500', status: '生产中', progress: 65 },
                { id: 'PO-2024-002', customer: '品牌 B', qty: '1200', status: '已完成', progress: 100 },
                { id: 'PO-2024-003', customer: '品牌 C', qty: '800', status: '待生产', progress: 0 },
                { id: 'PO-2024-004', customer: '品牌 D', qty: '350', status: '生产中', progress: 45 },
              ].map((order, i) => (
                <tr key={i} className="border-b border-border hover:bg-muted/30 transition-colors">
                  <td className="px-6 py-4 font-mono text-sm">{order.id}</td>
                  <td className="px-6 py-4 text-sm">{order.customer}</td>
                  <td className="px-6 py-4 text-sm">{order.qty}</td>
                  <td className="px-6 py-4 text-sm">
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                      order.status === '已完成' ? 'bg-accent/20 text-accent' :
                      order.status === '生产中' ? 'bg-primary/20 text-primary' :
                      'bg-muted text-muted-foreground'
                    }`}>
                      {order.status}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="w-24 h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-primary to-accent"
                        style={{ width: `${order.progress}%` }}
                      ></div>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
