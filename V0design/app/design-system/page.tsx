'use client'

export default function DesignSystem() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="border-b border-border bg-card sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-8">
          <div className="mb-4 inline-flex items-center gap-2 px-3 py-1 rounded-full bg-secondary/10 text-secondary text-sm font-medium">
            <span className="h-2 w-2 rounded-full bg-secondary animate-pulse"></span>
            设计系统 v1.0
          </div>
          <h1 className="text-4xl font-bold mb-2">
            服装生产管理系统
          </h1>
          <p className="text-muted-foreground text-lg">
            专业、冷色调、有活力、简洁的企业管理平台
          </p>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 py-16">
        {/* Color System */}
        <section className="mb-20">
          <h2 className="text-3xl font-bold mb-3">🎨 色彩系统</h2>
          <p className="text-muted-foreground mb-8 text-lg">采用冷色调搭配，传达专业感与现代感</p>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
            {/* Primary */}
            <div className="space-y-4">
              <div className="h-32 rounded-xl bg-primary shadow-lg hover:shadow-xl transition-shadow"></div>
              <div>
                <p className="font-bold text-foreground">主色 (Primary)</p>
                <p className="text-sm text-muted-foreground">深蓝色</p>
                <p className="text-xs text-muted-foreground mt-1">专业、稳定、信任</p>
              </div>
            </div>

            {/* Secondary */}
            <div className="space-y-4">
              <div className="h-32 rounded-xl bg-secondary shadow-lg hover:shadow-xl transition-shadow"></div>
              <div>
                <p className="font-bold text-foreground">次色 (Secondary)</p>
                <p className="text-sm text-muted-foreground">青色</p>
                <p className="text-xs text-muted-foreground mt-1">活力、清爽、现代</p>
              </div>
            </div>

            {/* Accent */}
            <div className="space-y-4">
              <div className="h-32 rounded-xl bg-accent shadow-lg hover:shadow-xl transition-shadow"></div>
              <div>
                <p className="font-bold text-foreground">强调色 (Accent)</p>
                <p className="text-sm text-muted-foreground">青蓝色</p>
                <p className="text-xs text-muted-foreground mt-1">交互、关键操作</p>
              </div>
            </div>

            {/* Muted */}
            <div className="space-y-4">
              <div className="h-32 rounded-xl bg-muted shadow-lg hover:shadow-xl transition-shadow border border-border"></div>
              <div>
                <p className="font-bold text-foreground">中性浅色</p>
                <p className="text-sm text-muted-foreground">浅灰色</p>
                <p className="text-xs text-muted-foreground mt-1">背景、禁用状态</p>
              </div>
            </div>

            {/* Destructive */}
            <div className="space-y-4">
              <div className="h-32 rounded-xl bg-destructive shadow-lg hover:shadow-xl transition-shadow"></div>
              <div>
                <p className="font-bold text-foreground">警告色</p>
                <p className="text-sm text-muted-foreground">红色</p>
                <p className="text-xs text-muted-foreground mt-1">删除、危险操作</p>
              </div>
            </div>
          </div>
        </section>

        {/* Typography */}
        <section className="mb-20">
          <h2 className="text-3xl font-bold mb-3">✍️ 字体系统</h2>
          <p className="text-muted-foreground mb-8 text-lg">使用 Inter 字族，确保最佳可读性</p>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Headings */}
            <div className="bg-card border border-border rounded-xl p-8">
              <h3 className="text-xl font-bold mb-6 text-primary">标题字体</h3>
              <div className="space-y-8">
                <div>
                  <p className="text-xs text-muted-foreground mb-2 font-mono">H1 - 36px Bold</p>
                  <h1 className="text-4xl font-bold">系统主标题</h1>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-2 font-mono">H2 - 28px Bold</p>
                  <h2 className="text-2xl font-bold">板块标题</h2>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-2 font-mono">H3 - 22px SemiBold</p>
                  <h3 className="text-lg font-semibold">卡片标题</h3>
                </div>
              </div>
            </div>

            {/* Body */}
            <div className="bg-card border border-border rounded-xl p-8">
              <h3 className="text-xl font-bold mb-6 text-primary">正文字体</h3>
              <div className="space-y-6">
                <div>
                  <p className="text-xs text-muted-foreground mb-2 font-mono">Body - 16px Regular</p>
                  <p className="leading-relaxed">这是标准的正文段落，用于显示主要内容和详细描述信息。确保清晰易读。</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-2 font-mono">Small - 14px Regular</p>
                  <p className="text-sm leading-relaxed">较小的辅助文本，用于次要信息、说明和标签。</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-2 font-mono">XSmall - 12px Regular</p>
                  <p className="text-xs leading-relaxed">最小文本，用于时间戳、提示和其他微观信息。</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Components */}
        <section className="mb-20">
          <h2 className="text-3xl font-bold mb-3">🎛️ 组件库</h2>
          <p className="text-muted-foreground mb-8 text-lg">构建系统的基础元素</p>
          
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Buttons */}
            <div className="bg-card border border-border rounded-xl p-8 space-y-4">
              <h3 className="text-lg font-bold mb-6">按钮</h3>
              <button className="w-full px-4 py-2.5 bg-primary text-primary-foreground rounded-lg font-medium hover:opacity-90 transition-opacity">
                主要按钮
              </button>
              <button className="w-full px-4 py-2.5 bg-secondary text-secondary-foreground rounded-lg font-medium hover:opacity-90 transition-opacity">
                次要按钮
              </button>
              <button className="w-full px-4 py-2.5 border border-border text-foreground rounded-lg font-medium hover:bg-muted transition-colors">
                边框按钮
              </button>
              <button className="w-full px-4 py-2.5 text-primary font-medium hover:bg-primary/10 rounded-lg transition-colors">
                文字按钮
              </button>
            </div>

            {/* Input */}
            <div className="bg-card border border-border rounded-xl p-8 space-y-4">
              <h3 className="text-lg font-bold mb-6">输入框</h3>
              <input
                type="text"
                placeholder="文本输入框"
                className="w-full px-4 py-2.5 bg-input border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary transition-all"
              />
              <input
                type="email"
                placeholder="邮箱输入框"
                className="w-full px-4 py-2.5 bg-input border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary transition-all"
              />
              <select className="w-full px-4 py-2.5 bg-input border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary transition-all">
                <option>选择项目</option>
                <option>选项 1</option>
                <option>选项 2</option>
              </select>
            </div>

            {/* Status Tags */}
            <div className="bg-card border border-border rounded-xl p-8 space-y-4">
              <h3 className="text-lg font-bold mb-6">状态标签</h3>
              <div className="space-y-2">
                <span className="inline-block px-3 py-1 rounded-full text-xs font-medium bg-primary/20 text-primary">生产中</span>
                <span className="inline-block px-3 py-1 rounded-full text-xs font-medium bg-accent/20 text-accent ml-2">已完成</span>
                <span className="inline-block px-3 py-1 rounded-full text-xs font-medium bg-muted text-muted-foreground ml-2">待处理</span>
              </div>
              <div className="space-y-2 pt-4 border-t border-border">
                <span className="inline-block px-3 py-1 rounded-full text-xs font-medium bg-green-500/20 text-green-500">✓ 成功</span>
                <span className="inline-block px-3 py-1 rounded-full text-xs font-medium bg-yellow-500/20 text-yellow-500 ml-2">⚠ 警告</span>
                <span className="inline-block px-3 py-1 rounded-full text-xs font-medium bg-destructive/20 text-destructive ml-2">✕ 错误</span>
              </div>
            </div>
          </div>
        </section>

        {/* Data Visualization */}
        <section className="mb-20">
          <h2 className="text-3xl font-bold mb-3">📊 数据可视化</h2>
          <p className="text-muted-foreground mb-8 text-lg">图表和数据展示方案</p>
          
          <div className="bg-card border border-border rounded-xl p-8">
            <h3 className="text-lg font-bold mb-6">图表色彩</h3>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
              {[
                { name: '数据1', class: 'bg-chart-1' },
                { name: '数据2', class: 'bg-chart-2' },
                { name: '数据3', class: 'bg-chart-3' },
                { name: '数据4', class: 'bg-chart-4' },
                { name: '数据5', class: 'bg-chart-5' },
              ].map((item, i) => (
                <div key={i} className="space-y-2">
                  <div className={`h-24 rounded-lg ${item.class} shadow-md`}></div>
                  <p className="text-sm font-medium text-center">{item.name}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Card Patterns */}
        <section className="mb-20">
          <h2 className="text-3xl font-bold mb-3">💳 卡片模式</h2>
          <p className="text-muted-foreground mb-8 text-lg">数据展示容器</p>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* KPI Card */}
            <div className="bg-card border border-border rounded-xl p-6 hover:border-primary/50 transition-colors">
              <p className="text-muted-foreground text-sm font-medium mb-2">KPI指标</p>
              <h3 className="text-3xl font-bold mb-2">2,450</h3>
              <p className="text-accent text-sm font-medium">↑ 12.5% vs 昨日</p>
            </div>

            {/* Alert Card */}
            <div className="bg-gradient-to-br from-primary/20 to-accent/20 border border-primary/30 rounded-xl p-6">
              <p className="text-sm font-bold mb-2">💡 优化建议</p>
              <p className="text-sm leading-relaxed">现在是调整生产计划以提高下周效率的最佳时机。</p>
            </div>

            {/* Progress Card */}
            <div className="bg-card border border-border rounded-xl p-6">
              <p className="text-muted-foreground text-sm font-medium mb-4">生产进度</p>
              <div className="space-y-3">
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm font-medium">PO-001</span>
                    <span className="text-primary text-sm font-bold">75%</span>
                  </div>
                  <div className="w-full h-2 bg-[#0f1620] rounded-full overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-primary to-accent" style={{ width: '75%' }}></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Layout Spacing */}
        <section className="mb-20">
          <h2 className="text-3xl font-bold mb-3">📏 间距系统</h2>
          <p className="text-muted-foreground mb-8 text-lg">保持界面节奏和视觉层级</p>
          
          <div className="bg-card border border-border rounded-xl p-8 space-y-8">
            <div className="space-y-4">
              <p className="text-sm font-mono text-muted-foreground">间距基准单位: 4px</p>
              {[
                { name: 'xs (0.5rem)', value: 8 },
                { name: 'sm (1rem)', value: 16 },
                { name: 'md (1.5rem)', value: 24 },
                { name: 'lg (2rem)', value: 32 },
                { name: 'xl (3rem)', value: 48 },
              ].map((item, i) => (
                <div key={i} className="flex items-center gap-4">
                  <div className="w-20 text-sm font-mono text-muted-foreground">{item.name}</div>
                  <div className="bg-primary rounded h-4" style={{ width: `${item.value}px` }}></div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Design Principles */}
        <section className="mb-20">
          <h2 className="text-3xl font-bold mb-3">🎯 设计原则</h2>
          <p className="text-muted-foreground mb-8 text-lg">系统设计的核心理念</p>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {[
              {
                icon: '✓',
                title: '专业第一',
                description: '冷色调和高对比度传达专业、可信和稳定感，适合企业管理系统。'
              },
              {
                icon: '⚡',
                title: '活力融合',
                description: '在专业基调上加入青色和活力元素，避免沉闷，激发用户积极性。'
              },
              {
                icon: '📱',
                title: '简洁优先',
                description: '去除不必要的装饰，每个元素都有其存在的意义，让用户专注核心功能。'
              },
              {
                icon: '♿',
                title: '易用至上',
                description: '充分的色彩对比度和清晰的视觉层级，确保所有用户都能舒适使用。'
              },
            ].map((principle, i) => (
              <div key={i} className="bg-card border border-border rounded-xl p-6">
                <div className="flex items-start gap-4">
                  <span className="text-2xl flex-shrink-0">{principle.icon}</span>
                  <div>
                    <h3 className="text-lg font-bold mb-2">{principle.title}</h3>
                    <p className="text-muted-foreground text-sm leading-relaxed">{principle.description}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* CTA */}
        <section className="py-12 px-8 rounded-xl bg-gradient-to-r from-primary/10 to-accent/10 border border-primary/20 mb-8">
          <h2 className="text-3xl font-bold mb-4">🚀 准备好开始了吗？</h2>
          <p className="text-muted-foreground mb-6 leading-relaxed max-w-2xl">
            这个完整的设计系统已为你规定了所有色彩、字体、组件和交互模式。现在你可以高效地构建整个服装生产管理系统，同时保持视觉一致性和用户体验质量。
          </p>
          <div className="flex flex-wrap gap-4">
            <button className="px-6 py-3 bg-primary text-primary-foreground rounded-lg font-medium hover:opacity-90 transition-opacity">
              开始构建
            </button>
            <button className="px-6 py-3 border border-border text-foreground rounded-lg font-medium hover:bg-muted transition-colors">
              查看仪表板
            </button>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-border bg-card">
        <div className="max-w-7xl mx-auto px-6 py-8 text-center text-muted-foreground">
          <p className="text-sm">
            服装生产管理系统 • 设计系统 v1.0 • © 2024 • 专业 • 冷色调 • 有活力 • 简洁
          </p>
        </div>
      </footer>
    </div>
  )
}
