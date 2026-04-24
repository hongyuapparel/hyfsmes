import { computed, type Component } from 'vue'
import {
  Sunny,
  StarFilled,
  CircleCheckFilled,
  TrendCharts,
  MagicStick,
  Present,
  Moon,
} from '@element-plus/icons-vue'

type PermissionChecker = {
  hasRoutePermission: (path: string) => boolean
  hasPermission: (code: string) => boolean
}

export type EncourageItem = {
  text: string
  icon: Component
  forRoutePath?: string
  forPermissionCode?: string
}

const ENCOURAGE_ITEMS: EncourageItem[] = [
  { text: '审单仔细一点，后续会轻松很多哦！✨', icon: CircleCheckFilled, forPermissionCode: 'orders_review' },
  { text: '待仓处理及时处理，数据更准。', icon: Present, forRoutePath: '/inventory/pending' },
  { text: '跟单有疑问先记一笔，集中沟通更高效。', icon: TrendCharts },
  { text: '今天阳光不错，有空望望窗外。', icon: Sunny },
  { text: '外面有风，开窗透透气。', icon: Moon },
  { text: '下雨天，记得带伞。', icon: Present },
  { text: '天晴，心情也会亮一点。', icon: StarFilled },
  { text: '阴天也适合专心干活。', icon: TrendCharts },
  { text: '入秋了，注意加件衣服呀~', icon: Sunny },
  { text: '夏天天热，多喝水哦~', icon: Moon },
  { text: '冬天注意保暖哟！', icon: Present },
  { text: '今天过节，尽量早点收工哟', icon: Present },
  { text: '假期快到了，撑住~', icon: TrendCharts },
  { text: '节后第一天，慢慢来！', icon: Sunny },
  { text: '周末愉快鸭！', icon: StarFilled },
  { text: '小长假前事多，别忘了喘口气~', icon: Moon },
  { text: '今天事多，辛苦了哟！', icon: StarFilled },
  { text: '午休记得动一动，换换脑子(*^_^*)', icon: Moon },
  { text: '下班路上一定要注意安全哟', icon: Present },
  { text: '歇一下喝口水，效率更高！', icon: Moon },
  { text: '桌面收一收，脑子会更清爽。', icon: CircleCheckFilled },
  { text: '喝口水，肩膀放松一下，再继续。', icon: Moon },
  { text: '完成一件就给自己一个小勾，成就感会回来。', icon: MagicStick },
  { text: '先把最不想做的那件做掉，后面会轻松很多。', icon: TrendCharts },
  { text: '今天也要好好吃饭哦~😜', icon: CircleCheckFilled },
  { text: '对自己好一点，也是今天的 KPI。', icon: Present },
  { text: '再忙也要留出一点时间给自己。', icon: Moon },
  { text: '忙完这一段，奖励一下认真工作的自己吧。✨', icon: Sunny },
  { text: '你今天的状态，比昨天又好了那么一点。', icon: Sunny },
  { text: '能把这些待办理清楚的人，可不简单。✨', icon: StarFilled },
  { text: '认真工作的你，真的在发光。', icon: MagicStick },
  { text: '别小看今天的每一步，都在把你带到更好的地方。', icon: TrendCharts },
  { text: '你经手的每一个订单，都在让事情变好。', icon: CircleCheckFilled },
  { text: '节奏稳、执行到位，本身就是一种厉害。', icon: Present },
  { text: '忙归忙，你比 KPI 重要。', icon: Moon },
  { text: '在意细节的人，说的就是你。✨', icon: StarFilled },
  { text: '待办一条条划掉，是不是有点爽？', icon: TrendCharts },
  { text: '和客户、工厂沟通留个痕，省心。', icon: Present },
  { text: '今日事今日毕，交期在心不慌张。', icon: Sunny },
  { text: '能搞定这些工作的你，真的很靠谱。✨', icon: StarFilled },
  { text: '你的时间很贵，别拿来跟不值得的事情生气~', icon: MagicStick },
  { text: '小事做稳了，大事才不慌。', icon: CircleCheckFilled },
  { text: '小目标：比昨天从容一点就好。', icon: TrendCharts },
  { text: '你的认真，客户和同事都看得到。', icon: CircleCheckFilled },
  { text: '问题一个一个解决，你就比昨天更强。', icon: MagicStick },
  { text: '别扛太多，该协作就协作。', icon: Moon },
  { text: '把事情捋顺的人，值得一句夸。✨', icon: TrendCharts },
  { text: '偶尔放空一下，脑子会更清楚。', icon: Sunny },
  { text: '进度在往前，就是好事。', icon: StarFilled },
  { text: '难搞的先记下来，别压在心里。', icon: Moon },
  { text: '你的节奏，就是最好的节奏。', icon: MagicStick },
  { text: '今天又推进了几件小事，已经很有成效了。', icon: Present },
  { text: '能把琐事理清的人，做事都有章法。', icon: StarFilled },
  { text: '交期在心、执行在手，你就稳了。', icon: CircleCheckFilled },
  { text: '问题会解决，你也会越做越顺。', icon: MagicStick },
  { text: '小成就也值得记一笔，呀呼~✨', icon: Present },
  { text: '一步一步来，比焦虑有用。', icon: Moon },
  { text: '你的靠谱，就是团队的底气。', icon: TrendCharts },
  { text: '愿意沟通、愿意改进的人，走得都不会慢。', icon: CircleCheckFilled },
  { text: '你在认真对待工作，工作也会回报你。', icon: Present },
  { text: '偶尔慢下来，是为了走更远。', icon: StarFilled },
  { text: '好好干活了，值得一句夸。', icon: CircleCheckFilled },
  { text: '你的存在，让很多事有了着落。✨', icon: Present },
  { text: '别和别人比节奏，和自己比进步就好。', icon: Moon },
  { text: '待办清空的感觉，留给你今天体验。', icon: TrendCharts },
  { text: '又是认真投入的一天。', icon: Sunny },
  { text: '节奏放稳一点，反而更容易做完。', icon: StarFilled },
  { text: '能动手在做，就已经比空想前进了一大步。✨', icon: CircleCheckFilled },
  { text: '把手头这一件收个尾，再开始下一件，思路会更清楚。', icon: MagicStick },
  { text: '重要沟通留个记录，日后少扯皮。', icon: Present },
  { text: '稳扎稳打，你就是那个靠谱的人。', icon: TrendCharts },
  { text: '休息好了，再冲也不迟。', icon: Sunny },
  { text: '你的付出，会有人看见的。', icon: CircleCheckFilled },
  { text: '能推进一点是一点，已经很好了。', icon: Present },
  { text: '工作上有问题，别憋着，该问就问！', icon: Moon },
  { text: '按自己的节奏来，就对了。', icon: Sunny },
  { text: '把事情一件件做完，超酷的。✨', icon: StarFilled },
  { text: '棘手的事先记下来，找时间集中处理。', icon: CircleCheckFilled },
  { text: '专业和靠谱，就是最好的名片。', icon: MagicStick },
  { text: '今天的每一点推进，都算数。✨', icon: Moon },
  { text: '路会越走越顺，前提是你一直在走。', icon: TrendCharts },
  { text: '把事捋顺，你行的。', icon: Sunny },
  { text: '分担出去一些，团队一起扛更轻松。', icon: StarFilled },
  { text: '把事情做完，本身就是一种能力。', icon: Present },
  { text: '你的认真，大家都看得到。✨', icon: TrendCharts },
  { text: '能理清待办的人，做事有条理。', icon: StarFilled },
  { text: '问题会一个一个解决的。', icon: MagicStick },
  { text: '有些事可以交给别人，不必全揽在自己身上。', icon: Moon },
  { text: '有你在跟进，事情就不会悬着。', icon: Sunny },
  { text: '把一件件事做到位的人，会越来越被看见。', icon: StarFilled },
  { text: '小事做稳，大事才不慌。', icon: CircleCheckFilled },
  { text: '小目标，完成一点是一点。', icon: MagicStick },
  { text: '不必和别人比，比昨天的自己好一点就很好。', icon: Moon },
  { text: '待办划掉的感觉，今天也体验一下。', icon: TrendCharts },
  { text: '事多的时候谁都容易急，能先喘口气再说话，已经很好了。', icon: Sunny },
  { text: '忙的时候记得喝口水，缓一缓再继续。', icon: Moon },
  { text: '难题解不开很正常，先放一放，换个时间说不定就通了。', icon: TrendCharts },
  { text: '心情不好的时候，先把能做的小事做掉，状态会慢慢回来。', icon: Present },
  { text: '出问题时，能先想「我能做点什么」的人，会越走越顺。', icon: CircleCheckFilled },
  { text: '卡壳时先想自己这边能怎么动一动，往往就通了。', icon: MagicStick },
  { text: '对自己有点要求、对别人多一分理解，身边的人都能感觉到。', icon: StarFilled },
  { text: '团队里有人多担一点、少推一点，大家都会轻松些。', icon: Sunny },
  { text: '听不清对方说什么的时候，先问清楚再回，会少很多误会。', icon: Moon },
  { text: '忙起来话容易急，能说清楚一句是一句。', icon: Present },
  { text: '卡住了就记下来，明天再想，说不定就有思路了。', icon: TrendCharts },
  { text: '情绪上来的时候，停几秒再开口，会省掉很多麻烦。', icon: CircleCheckFilled },
]

function getDayOfYear(): number {
  const date = new Date()
  const start = new Date(date.getFullYear(), 0, 0)
  const diff = date.getTime() - start.getTime()
  return Math.floor(diff / 86400000)
}

export function useHomeWelcome(permissionChecker: PermissionChecker) {
  const greetingText = computed(() => {
    const hour = new Date().getHours()
    if (hour < 6) return '夜深了'
    if (hour < 9) return '早上好'
    if (hour < 12) return '上午好'
    if (hour < 14) return '中午好'
    if (hour < 18) return '下午好'
    if (hour < 22) return '晚上好'
    return '夜深了'
  })

  const filteredEncourageItems = computed(() => {
    return ENCOURAGE_ITEMS.filter((item) => {
      if (!item.forRoutePath && !item.forPermissionCode) return true
      if (item.forRoutePath && permissionChecker.hasRoutePermission(item.forRoutePath)) return true
      if (item.forPermissionCode && permissionChecker.hasPermission(item.forPermissionCode)) return true
      return false
    })
  })

  const encourageItem = computed(() => {
    const list = filteredEncourageItems.value
    if (!list.length) return null
    const index = (getDayOfYear() - 1) % list.length
    return list[index] ?? list[0]
  })

  return {
    greetingText,
    encourageItem,
  }
}
