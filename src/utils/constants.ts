import { Crown, Coffee, Utensils, Ticket, Heart, Zap, Shield, Gift, Music, Gamepad2, Mic, Clock, Shirt, Smile, Search } from 'lucide-react';

export const SHOP_ITEMS = [
  // 高价稀有类
  { id: 'item_king', name: '帝王体验卡', desc: '对方无条件服从一个指令(不违背原则)', price: 500, icon: Crown },
  { id: 'item_clear_cart', name: '清空购物车', desc: '帮忙清空购物车(限额200元)', price: 800, icon: Gift },
  { id: 'item_stop_angry', name: '免死金牌', desc: '立刻停止争吵，且不翻旧账', price: 600, icon: Shield },
  { id: 'item_trip', name: '周末游玩券', desc: '指定周末去哪玩，对方负责攻略', price: 400, icon: Ticket },
  
  // 服务享受类
  { id: 'item_cook', name: '厨神召唤令', desc: '指定对方做一顿大餐/买单', price: 300, icon: Utensils },
  { id: 'item_massage_20', name: '尊享按摩', desc: '指定部位按摩20分钟', price: 200, icon: Heart },
  { id: 'item_hair_dry', name: '吹发服务', desc: '洗完头后帮对方吹干头发', price: 150, icon: Zap },
  { id: 'item_feed', name: '喂饭服务', desc: '这顿饭我要你喂我吃', price: 150, icon: Utensils },
  { id: 'item_feet_wash', name: '洗脚服务', desc: '打好水帮对方洗脚', price: 250, icon: Coffee },

  // 家务豁免类
  { id: 'item_skip_housework', name: '家务反转卡', desc: '今天的家务全部推给对方', price: 150, icon: Shirt },
  { id: 'item_trash', name: '倒垃圾券', desc: '指定对方去倒垃圾', price: 50, icon: Shield },
  
  // 娱乐互动类
  { id: 'item_movie', name: '电影包场券', desc: '指定电影，对方必须陪看且不玩手机', price: 150, icon: Ticket },
  { id: 'item_game', name: '陪玩券', desc: '陪玩指定游戏1小时', price: 120, icon: Gamepad2 },
  { id: 'item_ktv', name: '专属点歌', desc: '指定对方唱一首歌给你听', price: 80, icon: Mic },
  { id: 'item_check_phone', name: '查岗券', desc: '突击检查手机一次(仅限当面)', price: 300, icon: Search },
  
  // 趣味小道具
  { id: 'item_wakeup', name: '叫醒服务', desc: '明天早上温柔/暴力叫醒', price: 50, icon: Clock },
  { id: 'item_choose_clothes', name: '穿搭指定', desc: '明天出门穿什么我说了算', price: 100, icon: Shirt },
  { id: 'item_praise', name: '夸夸卡', desc: '真心实意夸赞对方1分钟', price: 60, icon: Smile },
  { id: 'item_milk_tea', name: '奶茶召唤', desc: '立刻点一杯奶茶送到面前', price: 100, icon: Coffee },
];

export const PUNISHMENTS = [
  // 体能类
  "做 30 个深蹲，需拍视频认证",
  "平板支撑 2 分钟",
  "波比跳 15 个",
  "靠墙静蹲 2 分钟",
  "仰卧起坐 30 个",
  
  // 社死/才艺类
  "深情朗读一段肉麻情话并发语音",
  "在朋友圈发一张自己的丑照，保留 30 分钟",
  "学猫叫 10 声并录音发过来",
  "唱一首《征服》并发语音",
  "跳一段即兴舞蹈（不少于 30 秒）拍视频",
  "用方言说“我爱你”并录音",

  // 破财/劳力类
  "给对方发 52.0 元红包",
  "负责洗接下来 3 天的所有碗",
  "包揽本周的卫生打扫",
  "给对方买一杯想喝的饮料",
  "给对方按摩肩颈 10 分钟",
  "给对方拿快递一周",
  
  // 精神类
  "面对面夸对方 3 分钟不许重样",
  "承认自己是猪头 3 遍",
  "手机上交 1 小时，期间不能玩",
  "写 100 字检讨书（关于为什么没完成任务）",
];
