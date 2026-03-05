'use client'

import { Search, Plus, Edit, Trash2, Phone, Mail } from 'lucide-react'
import { useState } from 'react'

export default function CustomerManagement() {
  const [searchTerm, setSearchTerm] = useState('')
  const [customers] = useState([
    {
      id: 'CUST-001',
      name: '优衣库（中国）',
      level: '钻石',
      contactPerson: '张三',
      phone: '010-1234-5678',
      email: 'zhang@uniqlo.cn',
      totalOrders: 45,
      amount: '¥2,450,000',
      status: '活跃',
    },
    {
      id: 'CUST-002',
      name: 'H&M 中国',
      level: '金牌',
      contactPerson: '李四',
      phone: '010-5678-1234',
      email: 'li@hm.cn',
      totalOrders: 32,
      amount: '¥1,680,000',
      status: '活跃',
    },
    {
      id: 'CUST-003',
      name: '太平鸟集团',
      level: '金牌',
      contactPerson: '王五',
      phone: '0571-1234-5678',
      email: 'wang@peacebird.cn',
      totalOrders: 28,
      amount: '¥1,420,000',
      status: '活跃',
    },
    {
      id: 'CUST-004',
      name: '波司登',
      level: '白银',
      contactPerson: '赵六',
      phone: '0512-5678-1234',
      email: 'zhao@bosideng.cn',
      totalOrders: 18,
      amount: '¥890,000',
      status: '活跃',
    },
    {
      id: 'CUST-005',
      name: '红豆集团',
      level: '白银',
      contactPerson: '孙七',
      phone: '0510-1234-5678',
      email: 'sun@honddou.cn',
      totalOrders: 15,
      amount: '¥720,000',
      status: '活跃',
    },
    {
      id: 'CUST-006',
      name: '江南布衣',
      level: '普通',
      contactPerson: '周八',
      phone: '0571-9876-5432',
      email: 'zhou@jnby.cn',
      totalOrders: 8,
      amount: '¥380,000',
      status: '暂停',
    },
  ])

  const filteredCustomers = customers.filter(customer =>
    customer.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    customer.contactPerson.toLowerCase().includes(searchTerm.toLowerCase()) ||
    customer.id.toLowerCase().includes(searchTerm.toLowerCase())
  )

  return (
    <div className="p-8">
      {/* 页面头部 */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold mb-2">客户列表</h2>
          <p className="text-muted-foreground">共 {customers.length} 个客户，总订单金额 {customers.reduce((sum, c) => sum + parseInt(c.amount.replace(/[^0-9]/g, '')), 0) / 1000000}M</p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors font-medium">
          <Plus className="w-5 h-5" />
          添加客户
        </button>
      </div>

      {/* 搜索和过滤 */}
      <div className="mb-6 bg-card border border-border rounded-lg p-4">
        <div className="flex gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="搜索客户名称、联系人或客户编号..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-border rounded-lg bg-input focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          <select className="px-4 py-2 border border-border rounded-lg bg-input focus:outline-none focus:ring-2 focus:ring-primary">
            <option>所有级别</option>
            <option>钻石</option>
            <option>金牌</option>
            <option>白银</option>
            <option>普通</option>
          </select>
          <select className="px-4 py-2 border border-border rounded-lg bg-input focus:outline-none focus:ring-2 focus:ring-primary">
            <option>所有状态</option>
            <option>活跃</option>
            <option>暂停</option>
          </select>
        </div>
      </div>

      {/* 统计卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        {[
          { label: '总客户数', value: customers.length, color: 'primary' },
          { label: '活跃客户', value: customers.filter(c => c.status === '活跃').length, color: 'accent' },
          { label: '本月新增', value: 3, color: 'secondary' },
          { label: '待审批', value: 2, color: 'destructive' },
        ].map((stat, i) => (
          <div key={i} className={`bg-card border border-border rounded-lg p-4`}>
            <p className="text-muted-foreground text-sm mb-2">{stat.label}</p>
            <h3 className={`text-2xl font-bold ${
              stat.color === 'primary' ? 'text-primary' :
              stat.color === 'accent' ? 'text-accent' :
              stat.color === 'secondary' ? 'text-secondary' :
              'text-destructive'
            }`}>{stat.value}</h3>
          </div>
        ))}
      </div>

      {/* 客户表格 */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-muted/50 border-b border-border">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-bold text-muted-foreground">客户编号</th>
                <th className="px-6 py-4 text-left text-xs font-bold text-muted-foreground">客户名称</th>
                <th className="px-6 py-4 text-left text-xs font-bold text-muted-foreground">等级</th>
                <th className="px-6 py-4 text-left text-xs font-bold text-muted-foreground">联系人</th>
                <th className="px-6 py-4 text-left text-xs font-bold text-muted-foreground">订单数</th>
                <th className="px-6 py-4 text-left text-xs font-bold text-muted-foreground">合作金额</th>
                <th className="px-6 py-4 text-left text-xs font-bold text-muted-foreground">状态</th>
                <th className="px-6 py-4 text-left text-xs font-bold text-muted-foreground">操作</th>
              </tr>
            </thead>
            <tbody>
              {filteredCustomers.map((customer, i) => (
                <tr key={i} className="border-b border-border hover:bg-muted/30 transition-colors">
                  <td className="px-6 py-4 font-mono text-sm font-medium text-primary">{customer.id}</td>
                  <td className="px-6 py-4">
                    <div>
                      <p className="font-medium text-foreground">{customer.name}</p>
                      <p className="text-xs text-muted-foreground mt-1 flex items-center gap-2">
                        <Mail className="w-3 h-3" />
                        {customer.email}
                      </p>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                      customer.level === '钻石' ? 'bg-blue-100 text-blue-700' :
                      customer.level === '金牌' ? 'bg-yellow-100 text-yellow-700' :
                      customer.level === '白银' ? 'bg-gray-100 text-gray-700' :
                      'bg-stone-100 text-stone-700'
                    }`}>
                      {customer.level}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div>
                      <p className="font-medium text-foreground">{customer.contactPerson}</p>
                      <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                        <Phone className="w-3 h-3" />
                        {customer.phone}
                      </p>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm font-medium">{customer.totalOrders}</td>
                  <td className="px-6 py-4 text-sm font-bold text-primary">{customer.amount}</td>
                  <td className="px-6 py-4">
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                      customer.status === '活跃' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                    }`}>
                      {customer.status}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <button className="p-2 hover:bg-muted rounded-lg transition-colors" title="编辑">
                        <Edit className="w-4 h-4 text-primary" />
                      </button>
                      <button className="p-2 hover:bg-muted rounded-lg transition-colors" title="删除">
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 分页 */}
      <div className="mt-6 flex items-center justify-between">
        <p className="text-sm text-muted-foreground">显示 1 到 {filteredCustomers.length} 的 {customers.length} 条记录</p>
        <div className="flex gap-2">
          <button className="px-3 py-2 border border-border rounded-lg hover:bg-muted transition-colors text-sm font-medium">上一页</button>
          <button className="px-3 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium">1</button>
          <button className="px-3 py-2 border border-border rounded-lg hover:bg-muted transition-colors text-sm font-medium">下一页</button>
        </div>
      </div>
    </div>
  )
}
