'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ArrowRight, Palette, Layout, Zap } from 'lucide-react';

export default function DesignPage() {
  return (
    <div className="min-h-screen bg-background">
      {/* 导航栏 */}
      <nav className="sticky top-0 z-50 border-b border-border/50 bg-card/95 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <span className="text-white font-bold text-sm">F</span>
            </div>
            <span className="font-bold text-foreground">生产管理系统</span>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/login">
              <Button variant="outline" size="sm">
                登录预览
              </Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="max-w-7xl mx-auto px-6 py-20 space-y-8 text-center">
        <div className="space-y-4">
          <h1 className="text-5xl font-bold text-foreground">
            专业的服装生产管理系统
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            简洁、专业、有活力的冷色调设计，完整的生产流程管理解决方案
          </p>
        </div>
        
        <div className="flex flex-wrap gap-4 justify-center pt-4">
          <Link href="/login">
            <Button size="lg" className="bg-primary hover:bg-primary/90 text-primary-foreground gap-2">
              进入系统 <ArrowRight className="w-4 h-4" />
            </Button>
          </Link>
          <Button size="lg" variant="outline">
            查看设计文档
          </Button>
        </div>

        {/* 背景装饰 */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-30">
          <div className="absolute top-20 right-0 w-96 h-96 rounded-full bg-secondary/20 blur-3xl" />
          <div className="absolute bottom-0 left-0 w-96 h-96 rounded-full bg-primary/20 blur-3xl" />
        </div>
      </section>

      {/* 色彩系统 */}
      <section className="max-w-7xl mx-auto px-6 py-16 space-y-8">
        <div className="text-center space-y-2">
          <h2 className="text-3xl font-bold text-foreground">色彩系统</h2>
          <p className="text-muted-foreground">专业冷色调 + 活力强调色</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          {[
            { name: '专业蓝', hex: '#0052CC', desc: '主要品牌色', className: 'bg-primary' },
            { name: '活力青', hex: '#00D9FF', desc: '次要强调', className: 'bg-secondary' },
            { name: '强调橙', hex: '#FF6B35', desc: '行动按钮', className: 'bg-accent' },
            { name: '中性灰', hex: '#F5F7FA', desc: '背景色', className: 'bg-muted border border-border' },
            { name: '深灰黑', hex: '#1F2937', desc: '文本色', className: 'bg-foreground' },
          ].map((color, idx) => (
            <Card key={idx} className="overflow-hidden border-border/50 hover:border-border transition-colors">
              <div className={`h-32 ${color.className}`} />
              <div className="p-4">
                <p className="font-semibold text-foreground">{color.name}</p>
                <p className="text-xs text-muted-foreground">{color.hex}</p>
                <p className="text-xs text-muted-foreground mt-2">{color.desc}</p>
              </div>
            </Card>
          ))}
        </div>
      </section>

      {/* 设计特点 */}
      <section className="max-w-7xl mx-auto px-6 py-16 space-y-8">
        <div className="text-center space-y-2">
          <h2 className="text-3xl font-bold text-foreground">设计特点</h2>
          <p className="text-muted-foreground">为企业级应用精心设计</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[
            {
              icon: Palette,
              title: '专业冷色调',
              desc: '蓝色和青色的组合传达专业、可信、稳定的品牌形象，适合企业应用'
            },
            {
              icon: Zap,
              title: '充满活力',
              desc: '活力的青色和强调橙色为界面注入生机，提升用户体验的动态感'
            },
            {
              icon: Layout,
              title: '简洁高效',
              desc: '最小化设计理念，清晰的视觉层级，让用户专注于核心功能和数据'
            },
          ].map((feature, idx) => {
            const Icon = feature.icon;
            return (
              <Card key={idx} className="p-6 border-border/50 hover:border-border/80 hover:shadow-md transition-all">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-lg bg-secondary/10 flex items-center justify-center flex-shrink-0">
                    <Icon className="w-6 h-6 text-secondary" />
                  </div>
                  <div className="space-y-2 flex-1">
                    <h3 className="font-semibold text-foreground">{feature.title}</h3>
                    <p className="text-sm text-muted-foreground">{feature.desc}</p>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      </section>

      {/* 功能模块 */}
      <section className="max-w-7xl mx-auto px-6 py-16 space-y-8">
        <div className="text-center space-y-2">
          <h2 className="text-3xl font-bold text-foreground">核心功能</h2>
          <p className="text-muted-foreground">完整的生产管理解决方案</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[
            { title: '仪表板', desc: '实时监控生产数据、订单进度和关键指标' },
            { title: '订单管理', desc: '完整的订单生命周期管理和跟踪' },
            { title: '生产计划', desc: '智能生产排期和资源分配' },
            { title: '员工管理', desc: '员工信息、考勤和绩效管理' },
            { title: '质量检查', desc: '产品质量检验和缺陷管理' },
            { title: '数据分析', desc: '生产效率分析和决策支持' },
          ].map((module, idx) => (
            <Card key={idx} className="p-6 border-border/50 hover:shadow-md hover:border-border/80 transition-all">
              <h3 className="text-lg font-semibold text-foreground mb-2">{module.title}</h3>
              <p className="text-sm text-muted-foreground">{module.desc}</p>
            </Card>
          ))}
        </div>
      </section>

      {/* 技术栈 */}
      <section className="max-w-7xl mx-auto px-6 py-16 space-y-8">
        <div className="text-center space-y-2">
          <h2 className="text-3xl font-bold text-foreground">技术栈</h2>
          <p className="text-muted-foreground">现代、高效、可扩展</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <Card className="p-8 border-border/50">
            <h3 className="text-xl font-semibold text-foreground mb-4">前端技术</h3>
            <ul className="space-y-3 text-sm text-muted-foreground">
              {['Vue 3 + TypeScript', 'Vite + Vue Router', 'Pinia 状态管理', 'Element Plus UI', 'Axios HTTP 请求'].map((item, i) => (
                <li key={i} className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-secondary" />
                  {item}
                </li>
              ))}
            </ul>
          </Card>

          <Card className="p-8 border-border/50">
            <h3 className="text-xl font-semibold text-foreground mb-4">后端技术</h3>
            <ul className="space-y-3 text-sm text-muted-foreground">
              {['NestJS REST API', 'MySQL + TypeORM', 'JWT + Passport 认证', 'RBAC 权限体系', 'Bcrypt 加密'].map((item, i) => (
                <li key={i} className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-secondary" />
                  {item}
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </section>

      {/* CTA Section */}
      <section className="max-w-7xl mx-auto px-6 py-16">
        <div className="relative bg-gradient-to-r from-primary/10 to-secondary/10 border border-primary/20 rounded-lg p-12 text-center space-y-6">
          <h2 className="text-3xl font-bold text-foreground">
            准备开始您的项目？
          </h2>
          <p className="text-muted-foreground max-w-xl mx-auto">
            这个完整的设计系统和项目框架已准备好进行开发。所有颜色、字体、组件和布局都已按照专业标准定义。
          </p>
          <div className="flex flex-wrap gap-4 justify-center pt-4">
            <Link href="/login">
              <Button size="lg" className="bg-primary hover:bg-primary/90 text-primary-foreground">
                进入系统演示
              </Button>
            </Link>
            <Button size="lg" variant="outline">
              下载项目文档
            </Button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/50 mt-16 py-8">
        <div className="max-w-7xl mx-auto px-6 text-center text-sm text-muted-foreground">
          <p>© 2024 服装生产管理系统 • 设计系统 v1.0 • 专业冷色调有活力简洁设计</p>
        </div>
      </footer>
    </div>
  );
}
