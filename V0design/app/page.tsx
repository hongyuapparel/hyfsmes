'use client'

import { useState } from 'react'
import { Menu, X, Zap } from 'lucide-react'
import Dashboard from '@/components/pages/dashboard'
import CustomerManagement from '@/components/pages/customer-management'
import VisualGuide from '@/components/pages/visual-guide'

type PageType = 'dashboard' | 'customers' | 'orders' | 'production' | 'inventory' | 'visual-guide'

export default function MainLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [currentPage, setCurrentPage] = useState<PageType>('dashboard')

  const menuItems = [
    { id: 'dashboard', icon: '📊', label: '主页' },
    { id: 'customers', icon: '👥', label: '客户管理' },
    { id: 'orders', icon: '📦', label: '订单管理' },
    { id: 'production', icon: '🏭', label: '生产管理' },
    { id: 'inventory', icon: '📂', label: '库存管理' },
    { id: 'visual-guide', icon: '🎨', label: '视觉指南' },
  ] as const

  return (
    <div className="flex h-screen bg-background text-foreground overflow-hidden">
      {/* 侧边栏 - 深色主题，精致设计 */}
      <div className={`${sidebarOpen ? 'w-56' : 'w-16'} transition-all duration-300 bg-slate-900 border-r border-slate-800 flex flex-col flex-shrink-0`}>
        {/* 标志区 - 与顶部导航对齐 */}
        <div className="h-16 px-4 border-b border-slate-800 flex items-center">
          <div className="flex items-center gap-2.5 w-full min-w-0">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-secondary flex items-center justify-center flex-shrink-0">
              <Zap className="w-4 h-4 text-white" />
            </div>
            {sidebarOpen && <span className="text-sm font-semibold text-white truncate">鸿宇服饰</span>}
          </div>
        </div>

        {/* 菜单 */}
        <nav className="flex-1 px-2 py-4 space-y-1 overflow-y-auto">
          {menuItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setCurrentPage(item.id)}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-md transition-all duration-200 text-sm ${
                currentPage === item.id
                  ? 'bg-slate-700 text-white font-medium'
                  : 'text-slate-400 hover:text-slate-300 hover:bg-slate-800/50'
              }`}
            >
              <span className="text-base flex-shrink-0">{item.icon}</span>
              {sidebarOpen && <span className="font-medium truncate">{item.label}</span>}
            </button>
          ))}
        </nav>

        {/* 底部用户 */}
        <div className="p-2 border-t border-slate-800">
          <button className="w-full flex items-center gap-2.5 px-3 py-2 rounded-md hover:bg-slate-800/50 transition-all">
            <div className="w-8 h-8 rounded-full bg-primary/25 flex items-center justify-center flex-shrink-0 text-sm font-semibold text-slate-300">A</div>
            {sidebarOpen && <span className="text-sm font-medium text-slate-400 truncate">Admin</span>}
          </button>
        </div>
      </div>

      {/* 主内容区 */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* 顶部导航 */}
        <div className="h-16 border-b border-slate-200 flex items-center justify-between px-6 bg-white flex-shrink-0">
          <div className="flex items-center gap-4">
            <button onClick={() => setSidebarOpen(!sidebarOpen)} className="p-2 hover:bg-slate-100 rounded-lg transition-colors text-slate-700">
              {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
            <h1 className="text-xl font-bold text-slate-900">
              {menuItems.find(item => item.id === currentPage)?.label}
            </h1>
          </div>
          <div className="flex items-center gap-4">
            <input
              type="text"
              placeholder="搜索..."
              className="px-4 py-2 rounded-lg bg-slate-50 border border-slate-200 text-slate-900 placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
            <div className="w-8 h-8 rounded-full bg-primary/20"></div>
          </div>
        </div>

        {/* 页面内容 */}
        <div className="flex-1 overflow-auto bg-background">
          {currentPage === 'dashboard' && <Dashboard />}
          {currentPage === 'customers' && <CustomerManagement />}
          {currentPage === 'orders' && <div className="p-8"><p className="text-muted-foreground">订单管理页面 - 开发中</p></div>}
          {currentPage === 'production' && <div className="p-8"><p className="text-muted-foreground">生产管理页面 - 开发中</p></div>}
          {currentPage === 'inventory' && <div className="p-8"><p className="text-muted-foreground">库存管理页面 - 开发中</p></div>}
          {currentPage === 'visual-guide' && <VisualGuide />}
        </div>
      </div>
    </div>
  )
}
