'use client'

import Link from 'next/link'
import { ArrowRight, Palette, LayoutDashboard, FileText } from 'lucide-react'

export default function Index() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="border-b border-border bg-card sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-secondary/10 text-secondary text-sm font-medium mb-4">
            <span className="h-2 w-2 rounded-full bg-secondary animate-pulse"></span>
            新系统预览
          </div>
          <h1 className="text-4xl font-bold">服装生产管理系统</h1>
          <p className="text-muted-foreground mt-2 text-lg">专业 · 冷色调 · 有活力 · 简洁</p>
        </div>
      </header>

      {/* Hero Section */}
      <section className="max-w-7xl mx-auto px-6 py-16">
        <div className="mb-16">
          <h2 className="text-3xl font-bold mb-4">✨ 完整的设计系统已就绪</h2>
          <p className="text-muted-foreground text-lg leading-relaxed">
            这是一个为服装生产企业精心打造的管理系统。采用专业冷色调（深蓝 + 青色）搭配简洁设计，
            为你提供高效、美观、易用的用户界面。现在就开始预览吧！
          </p>
        </div>

        {/* Quick Links Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          {/* Dashboard */}
          <Link href="/" className="group">
            <div className="bg-card border border-border rounded-xl p-8 h-full hover:border-primary/50 transition-all hover:shadow-lg hover:shadow-primary/10">
              <div className="flex items-start justify-between mb-6">
                <div className="p-3 rounded-lg bg-primary/10 group-hover:bg-primary/20 transition-colors">
                  <LayoutDashboard className="w-6 h-6 text-primary" />
                </div>
                <ArrowRight className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
              </div>
              <h3 className="text-xl font-bold mb-2">生产仪表板</h3>
              <p className="text-muted-foreground text-sm leading-relaxed">
                完整的生产管理界面演示，包括KPI指标、趋势图表、订单表格等。
              </p>
            </div>
          </Link>

          {/* Design System */}
          <Link href="/design-system" className="group">
            <div className="bg-card border border-border rounded-xl p-8 h-full hover:border-secondary/50 transition-all hover:shadow-lg hover:shadow-secondary/10">
              <div className="flex items-start justify-between mb-6">
                <div className="p-3 rounded-lg bg-secondary/10 group-hover:bg-secondary/20 transition-colors">
                  <Palette className="w-6 h-6 text-secondary" />
                </div>
                <ArrowRight className="w-5 h-5 text-muted-foreground group-hover:text-secondary transition-colors" />
              </div>
              <h3 className="text-xl font-bold mb-2">设计系统</h3>
              <p className="text-muted-foreground text-sm leading-relaxed">
                完整的设计规范展示，包括色彩、字体、组件、间距等所有设计元素。
              </p>
            </div>
          </Link>

          {/* Documentation */}
          <Link href="/design-system#documentation" className="group">
            <div className="bg-card border border-border rounded-xl p-8 h-full hover:border-accent/50 transition-all hover:shadow-lg hover:shadow-accent/10">
              <div className="flex items-start justify-between mb-6">
                <div className="p-3 rounded-lg bg-accent/10 group-hover:bg-accent/20 transition-colors">
                  <FileText className="w-6 h-6 text-accent" />
                </div>
                <ArrowRight className="w-5 h-5 text-muted-foreground group-hover:text-accent transition-colors" />
              </div>
              <h3 className="text-xl font-bold mb-2">完整文档</h3>
              <p className="text-muted-foreground text-sm leading-relaxed">
                详细的设计规范文档，包括用法示例和最佳实践指南。
              </p>
            </div>
          </Link>
        </div>

        {/* Features Grid */}
        <div className="mb-16">
          <h2 className="text-2xl font-bold mb-8">🎯 核心特性</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              {
                icon: '🎨',
                title: '专业配色',
                description: '深蓝 + 青色冷色系，传达专业感'
              },
              {
                icon: '📱',
                title: '响应式设计',
                description: '完美适配所有设备尺寸'
              },
              {
                icon: '⚡',
                title: '高效快速',
                description: 'Tailwind CSS，即写即得'
              },
              {
                icon: '♿',
                title: '无障碍支持',
                description: 'WCAG AA 色彩对比度标准'
              },
            ].map((feature, i) => (
              <div key={i} className="bg-card border border-border rounded-lg p-4">
                <div className="text-2xl mb-2">{feature.icon}</div>
                <h4 className="font-bold mb-1">{feature.title}</h4>
                <p className="text-sm text-muted-foreground">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Color Palette Preview */}
        <div className="mb-16">
          <h2 className="text-2xl font-bold mb-6">🎨 核心色彩</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
            {[
              { name: '主色', color: 'bg-primary', desc: 'Primary' },
              { name: '次色', color: 'bg-secondary', desc: 'Secondary' },
              { name: '强调', color: 'bg-accent', desc: 'Accent' },
              { name: '背景', color: 'bg-[#0a1220]', desc: 'Background' },
              { name: '警告', color: 'bg-destructive', desc: 'Warning' },
            ].map((c, i) => (
              <div key={i} className="space-y-2 text-center">
                <div className={`${c.color} h-20 rounded-lg shadow-md`}></div>
                <div>
                  <p className="font-bold text-sm">{c.name}</p>
                  <p className="text-xs text-muted-foreground">{c.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Design Principles */}
        <div className="bg-gradient-to-br from-primary/20 to-accent/20 border border-primary/30 rounded-xl p-8 mb-16">
          <h2 className="text-2xl font-bold mb-6">💡 设计原则</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              {
                num: '1',
                title: '专业第一',
                desc: '冷色主导，传达稳定和信任'
              },
              {
                num: '2',
                title: '活力融合',
                desc: '适度强调，避免沉闷'
              },
              {
                num: '3',
                title: '简洁至上',
                desc: '最小化设计，无多余装饰'
              },
              {
                num: '4',
                title: '易用至上',
                desc: '清晰层级，易于理解'
              },
            ].map((p, i) => (
              <div key={i} className="text-center">
                <div className="w-10 h-10 rounded-full bg-primary/30 flex items-center justify-center mx-auto mb-3">
                  <span className="font-bold text-primary">{p.num}</span>
                </div>
                <h4 className="font-bold mb-1">{p.title}</h4>
                <p className="text-sm text-muted-foreground">{p.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* File Structure */}
        <div className="mb-16">
          <h2 className="text-2xl font-bold mb-6">📁 项目结构</h2>
          <div className="bg-card border border-border rounded-xl p-6 font-mono text-sm overflow-x-auto">
            <pre className="text-muted-foreground">
{`app/
├── page.tsx                  ← 主仪表板
├── design-system/
│   └── page.tsx             ← 设计系统演示
├── layout.tsx               ← 根布局配置
├── globals.css              ← 全局样式 & 设计令牌
└── ...

public/
└── design-system-overview.jpg

components/ui/               ← shadcn/ui 组件库

DESIGN_SYSTEM.md             ← 完整文档`}
            </pre>
          </div>
        </div>

        {/* Quick Start */}
        <div className="bg-card border border-border rounded-xl p-8">
          <h2 className="text-2xl font-bold mb-6">🚀 快速开始</h2>
          <div className="space-y-4">
            <div className="flex gap-4">
              <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold flex-shrink-0">1</div>
              <div>
                <p className="font-bold">查看仪表板演示</p>
                <p className="text-sm text-muted-foreground">点击上方"生产仪表板"链接，查看完整的生产管理界面</p>
              </div>
            </div>
            <div className="flex gap-4">
              <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold flex-shrink-0">2</div>
              <div>
                <p className="font-bold">探索设计系统</p>
                <p className="text-sm text-muted-foreground">访问"设计系统"页面，查看所有颜色、字体、组件等规范</p>
              </div>
            </div>
            <div className="flex gap-4">
              <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold flex-shrink-0">3</div>
              <div>
                <p className="font-bold">阅读完整文档</p>
                <p className="text-sm text-muted-foreground">打开 DESIGN_SYSTEM.md 了解详细的使用指南和最佳实践</p>
              </div>
            </div>
            <div className="flex gap-4">
              <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold flex-shrink-0">4</div>
              <div>
                <p className="font-bold">开始开发</p>
                <p className="text-sm text-muted-foreground">使用 Tailwind CSS 类名创建新的页面和功能模块</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border bg-card mt-20">
        <div className="max-w-7xl mx-auto px-6 py-12">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">
            <div>
              <h4 className="font-bold mb-4">文档</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><a href="/design-system" className="hover:text-primary transition-colors">设计系统</a></li>
                <li><a href="/" className="hover:text-primary transition-colors">仪表板演示</a></li>
                <li><a href="/DESIGN_SYSTEM.md" className="hover:text-primary transition-colors">完整规范</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-bold mb-4">技术栈</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>Next.js 16</li>
                <li>Tailwind CSS v4</li>
                <li>shadcn/ui</li>
                <li>TypeScript</li>
              </ul>
            </div>
            <div>
              <h4 className="font-bold mb-4">关键特性</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>✓ 暗色模式优化</li>
                <li>✓ 响应式设计</li>
                <li>✓ 无障碍访问</li>
                <li>✓ 高性能</li>
              </ul>
            </div>
          </div>
          <div className="border-t border-border pt-8">
            <p className="text-sm text-muted-foreground text-center">
              服装生产管理系统设计系统 v1.0 • 2026-03-02 • 专业 · 冷色调 · 有活力 · 简洁
            </p>
          </div>
        </div>
      </footer>
    </div>
  )
}
