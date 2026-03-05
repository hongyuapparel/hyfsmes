'use client'

export default function DesignShowcase() {
  const colors = [
    {
      name: '主色 (Primary)',
      hex: '#5B4DB0',
      usage: '按钮、链接、品牌元素',
    },
    {
      name: '次色 (Secondary)',
      hex: '#2E92C9',
      usage: '次要操作、辅助信息',
    },
    {
      name: '强调色 (Accent)',
      hex: '#D4A537',
      usage: '重要数据、关键提示',
    },
    {
      name: '中性浅 (Muted)',
      hex: '#F0F0F0',
      usage: '背景、禁用状态',
    },
    {
      name: '深灰 (Foreground)',
      hex: '#2D2D2D',
      usage: '主要文本',
    },
  ]

  const typography = [
    {
      category: '标题字体',
      font: 'Inter',
      examples: [
        { name: 'H1', size: '36px', weight: 'Bold', text: '管理系统标题' },
        { name: 'H2', size: '28px', weight: 'Bold', text: '区块标题' },
        { name: 'H3', size: '22px', weight: 'SemiBold', text: '子标题' },
      ],
    },
    {
      category: '正文字体',
      font: 'Inter',
      examples: [
        { name: '正文', size: '16px', weight: 'Regular', text: '这是标准的正文段落文本' },
        { name: '小字', size: '14px', weight: 'Regular', text: '这是较小的辅助文本' },
        { name: '标签', size: '12px', weight: 'Regular', text: '这是标签和提示' },
      ],
    },
  ]

  const spacing = [
    { name: 'xs', value: '4px' },
    { name: 'sm', value: '8px' },
    { name: 'md', value: '12px' },
    { name: 'lg', value: '16px' },
    { name: 'xl', value: '24px' },
    { name: '2xl', value: '32px' },
  ]

  return (
    <main className="min-h-screen bg-white">
      {/* Header */}
      <div className="max-w-6xl mx-auto px-8 py-12 border-b border-gray-200">
        <div className="inline-block px-3 py-1 bg-blue-50 text-blue-600 rounded-full text-sm font-medium mb-4">
          设计系统 v1.0
        </div>
        <h1 className="text-5xl font-bold text-gray-900 mb-3">服装生产管理系统</h1>
        <p className="text-gray-600 text-lg">专业、高效、简洁的生产管理平台</p>
      </div>

      {/* Color System Section */}
      <div className="max-w-6xl mx-auto px-8 py-16">
        <h2 className="text-3xl font-bold text-gray-900 mb-12">色彩系统</h2>
        <div className="grid grid-cols-5 gap-6">
          {colors.map((color, idx) => (
            <div key={idx}>
              <div
                className="w-full h-40 rounded-xl mb-4 shadow-sm border border-gray-100"
                style={{ backgroundColor: color.hex }}
              />
              <h3 className="font-semibold text-gray-900 mb-1">{color.name}</h3>
              <p className="text-sm font-mono text-gray-600 mb-2">{color.hex}</p>
              <p className="text-xs text-gray-500">{color.usage}</p>
            </div>
          ))}
        </div>
      </div>

      <hr className="border-gray-200" />

      {/* Typography Section */}
      <div className="max-w-6xl mx-auto px-8 py-16">
        <h2 className="text-3xl font-bold text-gray-900 mb-12">字体系统</h2>
        <div className="grid grid-cols-2 gap-12">
          {typography.map((type, idx) => (
            <div key={idx}>
              <h3 className="text-lg font-semibold text-gray-900 mb-1">{type.category}</h3>
              <p className="text-sm text-gray-600 mb-8">{type.font} 字族</p>

              <div className="space-y-8">
                {type.examples.map((example, i) => (
                  <div key={i}>
                    <div className="flex items-center justify-between mb-3">
                      <span className="font-semibold text-gray-900">{example.name}</span>
                      <span className="text-xs text-gray-500">
                        {example.size} • {example.weight}
                      </span>
                    </div>
                    <div
                      style={{
                        fontSize: example.size,
                        fontWeight:
                          example.weight === 'Bold'
                            ? 700
                            : example.weight === 'SemiBold'
                              ? 600
                              : 400,
                      }}
                      className="text-gray-900 mb-2"
                    >
                      {example.text}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      <hr className="border-gray-200" />

      {/* Spacing Section */}
      <div className="max-w-6xl mx-auto px-8 py-16">
        <h2 className="text-3xl font-bold text-gray-900 mb-12">间距系统</h2>
        <div className="space-y-6">
          {spacing.map((space, idx) => (
            <div key={idx} className="flex items-center gap-8">
              <div className="w-24">
                <p className="font-semibold text-gray-900">{space.name}</p>
                <p className="text-sm text-gray-600">{space.value}</p>
              </div>
              <div className="flex items-center gap-3">
                <div
                  className="bg-blue-500 rounded"
                  style={{ width: space.value, height: '32px' }}
                />
                <span className="text-sm text-gray-600">
                  {space.name === 'xs' && '极小间距'}
                  {space.name === 'sm' && '小间距'}
                  {space.name === 'md' && '中间距'}
                  {space.name === 'lg' && '标准间距（推荐）'}
                  {space.name === 'xl' && '大间距'}
                  {space.name === '2xl' && '特大间距'}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <hr className="border-gray-200" />

      {/* Components Section */}
      <div className="max-w-6xl mx-auto px-8 py-16">
        <h2 className="text-3xl font-bold text-gray-900 mb-12">组件示例</h2>
        <div className="grid grid-cols-2 gap-8">
          {/* Button Primary */}
          <div className="border border-gray-200 rounded-lg p-8 bg-gray-50">
            <h3 className="font-semibold text-gray-900 mb-2">按钮 (Primary)</h3>
            <p className="text-sm text-gray-600 mb-6">主要操作按钮</p>
            <div className="flex items-center justify-center p-8 bg-white border border-gray-200 rounded">
              <button className="px-6 py-2.5 bg-blue-600 text-white rounded-md font-medium hover:bg-blue-700 transition-colors">
                主要按钮
              </button>
            </div>
          </div>

          {/* Button Secondary */}
          <div className="border border-gray-200 rounded-lg p-8 bg-gray-50">
            <h3 className="font-semibold text-gray-900 mb-2">按钮 (Secondary)</h3>
            <p className="text-sm text-gray-600 mb-6">次要操作按钮</p>
            <div className="flex items-center justify-center p-8 bg-white border border-gray-200 rounded">
              <button className="px-6 py-2.5 bg-gray-200 text-gray-900 rounded-md font-medium hover:bg-gray-300 transition-colors">
                次要按钮
              </button>
            </div>
          </div>

          {/* Card */}
          <div className="border border-gray-200 rounded-lg p-8 bg-gray-50">
            <h3 className="font-semibold text-gray-900 mb-2">卡片</h3>
            <p className="text-sm text-gray-600 mb-6">内容容器组件</p>
            <div className="flex items-center justify-center p-8 bg-white border border-gray-200 rounded">
              <div className="w-full p-6 border border-gray-200 rounded-lg bg-white">
                <h4 className="font-semibold text-gray-900 mb-2">卡片标题</h4>
                <p className="text-sm text-gray-600">这是一个卡片组件的示例。</p>
              </div>
            </div>
          </div>

          {/* Input */}
          <div className="border border-gray-200 rounded-lg p-8 bg-gray-50">
            <h3 className="font-semibold text-gray-900 mb-2">输入框</h3>
            <p className="text-sm text-gray-600 mb-6">表单输入组件</p>
            <div className="flex items-center justify-center p-8 bg-white border border-gray-200 rounded">
              <input
                type="text"
                placeholder="输入文本..."
                className="px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 w-full"
              />
            </div>
          </div>
        </div>
      </div>

      <hr className="border-gray-200" />

      {/* Design Principles */}
      <div className="max-w-6xl mx-auto px-8 py-16">
        <h2 className="text-3xl font-bold text-gray-900 mb-12">设计原则</h2>
        <div className="grid grid-cols-2 gap-8">
          <div className="border border-gray-200 rounded-lg p-6 bg-gray-50">
            <h3 className="font-semibold text-gray-900 mb-2">清晰的视觉层级</h3>
            <p className="text-sm text-gray-600">通过字体大小、颜色和间距明确信息优先级，帮助用户快速定位关键信息。</p>
          </div>
          <div className="border border-gray-200 rounded-lg p-6 bg-gray-50">
            <h3 className="font-semibold text-gray-900 mb-2">一致的交互模式</h3>
            <p className="text-sm text-gray-600">统一的组件设计和交互逻辑，降低用户学习成本，提高操作效率。</p>
          </div>
          <div className="border border-gray-200 rounded-lg p-6 bg-gray-50">
            <h3 className="font-semibold text-gray-900 mb-2">专业高端感</h3>
            <p className="text-sm text-gray-600">深色导航栏搭配白色内容区，提供企业级的视觉体验和可信度。</p>
          </div>
          <div className="border border-gray-200 rounded-lg p-6 bg-gray-50">
            <h3 className="font-semibold text-gray-900 mb-2">响应式布局</h3>
            <p className="text-sm text-gray-600">完全适配各种屏幕尺寸，从移动设备到桌面都能提供最佳体验。</p>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="border-t border-gray-200 py-8 text-center text-sm text-gray-600">
        <p>© 2024 鸿宇服饰生产管理系统 • 设计系统 v1.0</p>
      </div>
    </main>
  )
}
