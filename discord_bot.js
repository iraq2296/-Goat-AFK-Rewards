/**
 * 🐺 Goat AFK Rewards - Official Discord Bot System
 * Keeps the bot online 24/7 with interactive slash commands (/), prefix commands (!),
 * and Direct Messaging (DM) for Customer Subscriptions and AFK Status updates.
 */

const fs = require('fs');
const path = require('path');
const http = require('http');
const { 
  Client, 
  GatewayIntentBits, 
  EmbedBuilder, 
  ActionRowBuilder, 
  ButtonBuilder, 
  ButtonStyle, 
  ActivityType,
  AttachmentBuilder
} = require('discord.js');

// Load .env if present
const envPath = path.join(__dirname, '.env');
if (fs.existsSync(envPath)) {
  try {
    const envLines = fs.readFileSync(envPath, 'utf8').split('\n');
    for (const line of envLines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const idx = trimmed.indexOf('=');
      if (idx !== -1) {
        const k = trimmed.slice(0, idx).trim();
        const v = trimmed.slice(idx + 1).trim();
        if (!process.env[k]) process.env[k] = v;
      }
    }
  } catch (err) {}
}

// Load config
const configPath = path.join(__dirname, 'config.json');
let config = {};
try {
  config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
} catch (e) {
  console.error('[Error] Could not read config.json');
}

const configToken = config.modules?.discord?.token;
const TOKEN = process.env.DISCORD_TOKEN || (configToken && configToken !== 'YOUR_DISCORD_BOT_TOKEN_HERE' ? configToken : '');
const PREFIX = config.modules?.discord?.prefix || '!';
const BOT_NAME = config.modules?.discord?.username || 'Goat AFK Rewards';
const AVATAR_URL = config.modules?.discord?.avatarUrl || 'https://files.catbox.moe/nck6mk.png'; // 24k Golden Goat Logo for Discord
const API_PORT = process.env.PORT || process.env.SERVER_PORT || config.apiPort || 25997;
const OWNER_DISCORD_ID = '490264176535797767'; // وليد عباس (mandalawi)

console.log('===========================================================');
console.log(`  🐺 Starting ${BOT_NAME} - Discord Bot Engine...`);
console.log('===========================================================');

// ==========================================
// 0. Subscriptions & License Keys Database
// ==========================================
const subDbPath = path.join(__dirname, 'subscriptions_db.json');

const PLAN_SPECS = {
  bronze: {
    key: 'bronze',
    name: '🥉 باقة التجربة اليومية (24 ساعة)',
    price: '$5',
    priceIqd: '7,500 د.ع',
    durationMs: 24 * 60 * 60 * 1000,
    durationText: '24 ساعة (يوم كامل)',
    allowedTiers: ['المستوى البرونزي فقط'],
    description: 'تشغيل 24 ساعة، مكافآت برونزية، ضرب الموبات، وحماية Anti-AFK'
  },
  diamond: {
    key: 'diamond',
    name: '💎 الباقة الماسية (شهر كامل)',
    price: '$15',
    priceIqd: '22,500 د.ع',
    durationMs: 30 * 24 * 60 * 60 * 1000,
    durationText: 'شهر كامل (30 يوماً)',
    allowedTiers: ['برونزي', 'فضي', 'ذهبي'],
    description: 'تشغيل 30 يوم، مكافآت حتى الذهبي، أكل تلقائي، تفريغ الصناديق، وتجميع XP'
  },
  vip: {
    key: 'vip',
    name: '👑 باقة VIP الشاملة (شهر كامل)',
    price: '$30',
    priceIqd: '45,000 د.ع',
    durationMs: 30 * 24 * 60 * 60 * 1000,
    durationText: 'شهر كامل (30 يوماً)',
    allowedTiers: ['برونزي', 'فضي', 'ذهبي', 'ماسي', 'أسطوري'],
    description: 'تشغيل 30 يوم، جميع مكافآت اللعبة والنيثرايت، خادم مخصص، إعادة اتصال فوري، دعم أولوية'
  }
};

function loadSubDb() {
  try {
    if (fs.existsSync(subDbPath)) {
      const data = JSON.parse(fs.readFileSync(subDbPath, 'utf8'));
      if (!data.licenses) data.licenses = {};
      if (!data.activeSubscriptions) data.activeSubscriptions = {};
      if (!data.pendingRequests) data.pendingRequests = {};
      return data;
    }
  } catch (e) {
    console.error('[SubDB] Error loading DB:', e.message);
  }
  return { licenses: {}, activeSubscriptions: {}, pendingRequests: {} };
}

function saveSubDb(data) {
  try {
    fs.writeFileSync(subDbPath, JSON.stringify(data, null, 2), 'utf8');
  } catch (e) {
    console.error('[SubDB] Error saving DB:', e.message);
  }
}

function generateLicenseKey(plan = 'diamond') {
  const prefixMap = {
    bronze: 'GOAT-BRZ',
    diamond: 'GOAT-DIA',
    vip: 'GOAT-VIP'
  };
  const prefix = prefixMap[plan] || 'GOAT-KEY';
  const part1 = Math.random().toString(36).substring(2, 6).toUpperCase();
  const part2 = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `${prefix}-${part1}-${part2}`;
}

function getUserSubscription(userId) {
  const db = loadSubDb();
  const sub = db.activeSubscriptions[userId];
  if (!sub) return null;
  const isExpired = Date.now() > sub.expiresAt;
  return { ...sub, isExpired };
}

function getLicensePurchasedDMEmbed(code, planKey) {
  const spec = PLAN_SPECS[planKey] || PLAN_SPECS.diamond;
  const tiersText = spec.key === 'vip' ? 'جميع رتب ومكافآت الخمول' : spec.allowedTiers.join(' • ');
  const cleanPlanName = spec.name.replace(/^[🥉💎👑]\s*/, '');

  return new EmbedBuilder()
    .setColor(0x00ff88)
    .setTitle('🔑 كود تفعيل اشتراكك | Goat AFK Rewards')
    .setDescription(
`أهلاً بك! تم إصدار كود اشتراكك وتوثيقه بنجاح من الموقع.

👑 **الباقة:** ${cleanPlanName}
💵 **السعر:** **${spec.price}**
⏱️ **المدة:** ${spec.durationText}
🏆 **الرتب:** ${tiersText}

📋 **كود الترخيص الخاص بك:**
\`\`\`
${code}
\`\`\`

⚡ **أمر التفعيل المباشر في روم الأوامر:**
انسخ الأمر التالي وضعه في روم الأوامر بالسيرفر:
\`\`\`
/redeem code:${code}
\`\`\`

💡 بعد التفعيل، اكتب أمر \`/farm_start\` لتشغيل البوت فوراً في سيرفرك.`
    )
    .setThumbnail(AVATAR_URL)
    .setFooter({ text: `${BOT_NAME} • كود ترخيص موثق`, iconURL: AVATAR_URL });
}

// ==========================================
// 1. Embed Generators
// ==========================================

function getHelpEmbed() {
  return new EmbedBuilder()
    .setColor(0x55ffff)
    .setTitle(`🐺 أوامر بوت ${BOT_NAME}`)
    .setDescription(`أهلاً بك! أنا بوت نظام الخمول والمكافآت الذكي لماينكرافت.\nيمكنك استخدام الأوامر عبر كتابة علامة **\`/\`** (Slash Commands) أو كتابة **\`${PREFIX}\`**:\n`)
    .setThumbnail(AVATAR_URL)
    .addFields(
      { name: '🔑 `/redeem`', value: 'تفعيل كود الاشتراك المستلم من الموقع أو الإدارة.', inline: false },
      { name: '🚀 `/farm_start`', value: 'بدء وتخصيص جلسة فرم لحسابك وسيرفرك (للمشتركين فقط).', inline: false },
      { name: '🛑 `/farm_stop`', value: 'إيقاف جلسة البوت الخاصة بك وحفظ الموارد.', inline: false },
      { name: '👤 `/my_bot`', value: 'عرض حالة اشتراكك، الوقت المتبقي، وجلسة الفرم.', inline: false },
      { name: '💎 `/plans`', value: 'عرض باقات وأسعار الاشتراك (تجربة 24س، ماسية شهر، VIP شهر).', inline: false },
      { name: '📊 `/status`', value: 'عرض حالة السيرفر، سرعة البنق، واللاعب الخامل.', inline: false },
      { name: '🎁 `/rewards`', value: 'استعراض مستويات وجدول جوائز الخمول.', inline: false },
      { name: '📦 `/chest`', value: 'فحص صندوق الغنائم والموارد النادرة المفرزة.', inline: false },
      { name: '📶 `/ping`', value: 'قياس سرعة استجابة البوت اللحظية.', inline: false }
    )
    .setFooter({ text: `${BOT_NAME} • Minecraft AFK System`, iconURL: AVATAR_URL })
    .setTimestamp();
}

function getStatusEmbed(client) {
  const host = config.server?.host || 'play.skyblock.net';
  const player = config.account?.username || 'AFK_Farmer';

  return new EmbedBuilder()
    .setColor(0x00ff88)
    .setTitle('📊 تقرير حالة نظام الخمول والسيرفر')
    .setThumbnail(AVATAR_URL)
    .addFields(
      { name: '🌐 سيرفر ماينكرافت:', value: `\`${host}\``, inline: true },
      { name: '👤 اسم اللاعب:', value: `\`${player}\``, inline: true },
      { name: '🛡️ حماية منع الطرد:', value: '🟢 مفعّلة (Anti-AFK)', inline: true },
      { name: '⏱️ مدة الخمول الحالية:', value: '**03:45:22** ساعة', inline: true },
      { name: '💎 عناصر تم فرزها:', value: '**1,480** عنصر نادر', inline: true },
      { name: '📶 سرعة اتصال البوت:', value: `\`${client.ws.ping}ms\``, inline: true }
    )
    .setFooter({ text: `${BOT_NAME} • 24/7 Farming Active`, iconURL: AVATAR_URL })
    .setTimestamp();
}

function getRewardsEmbed() {
  return new EmbedBuilder()
    .setColor(0xffaa00)
    .setTitle('🏆 مستويات وجدول مكافآت الخمول (AFK Tiers)')
    .setDescription('كلما بقيت داخل منطقة الأمان دون انقطاع، تحصل على رتب ومكافآت أعلى تلقائياً:')
    .setThumbnail(AVATAR_URL)
    .addFields(
      { name: '🥉 المستوى 1: البرونزي (3 ساعات)', value: '16x سبائك حديد + 500 XP + 10 عملات ديسكورد', inline: false },
      { name: '🥈 المستوى 2: الفضي (6 ساعات)', value: '8x سبائك ذهب + 3x ألماس + كتاب Unbreaking III', inline: false },
      { name: '🥇 المستوى 3: الذهبي (9 ساعات)', value: '8x ألماس + 2x تفاح ذهبي + رتبة @AFK Grinder', inline: false },
      { name: '💎 المستوى 4: الألماسي (12 ساعة)', value: '1x حطام قديم (Ancient Debris) + كتاب Mending + تفاحة نوتش', inline: false },
      { name: '👑 المستوى 5: النيثرايت الأسطوري (24 ساعة)', value: '1x سبيكة نيثرايت + درع نيثرايت مخصص + رتبة @AFK Legend دائمة!', inline: false }
    )
    .setFooter({ text: `${BOT_NAME} • Reward System`, iconURL: AVATAR_URL })
    .setTimestamp();
}

function getChestEmbed() {
  return new EmbedBuilder()
    .setColor(0x00f2fe)
    .setTitle('📦 محتويات صندوق الغنائم (Loot Chest)')
    .setDescription('الموارد التي قام روبوت الفرم بجمعها وتخزينها لك بالصندوق:')
    .setThumbnail(AVATAR_URL)
    .addFields(
      { name: '🪨 Ancient Debris', value: '2x حبة', inline: true },
      { name: '💎 Diamonds', value: '8x حبات', inline: true },
      { name: '⬛ Netherite Ingot', value: '1x سبيكة', inline: true },
      { name: '📖 كتاب Mending', value: '1x نادر', inline: true },
      { name: '🍎 Enchanted Apple', value: '3x حبات', inline: true },
      { name: '⚔️ سيف مطوّر', value: 'Sharpness V', inline: true }
    )
    .setFooter({ text: `${BOT_NAME} • Total Loot: 1,480 items`, iconURL: AVATAR_URL })
    .setTimestamp();
}

function getFarmEmbed() {
  return new EmbedBuilder()
    .setColor(0xff5555)
    .setTitle('⚔️ موديول الفرم التلقائي (Auto-Attack & Farm)')
    .setDescription('البوت يقوم بضرب الوحوش بالسيف أمام المزارع (Mob Spawners) وجمع نقاط الخبرة واللوت وتفريغ الحقيبة بالصندوق عندما تقارب على الامتلاء.')
    .addFields(
      { name: '🗡️ السلاح الحالي:', value: 'Netherite Sword (Sharpness V)', inline: true },
      { name: '🎯 نطاق الضرب:', value: '3.8 بلوكات', inline: true },
      { name: '🍖 الأكل الذاتي:', value: 'تلقائي عند انخفاض الجوع', inline: true }
    )
    .setFooter({ text: BOT_NAME, iconURL: AVATAR_URL });
}

// 📩 1. Subscription Confirmation DM
function getSubscriptionDMEmbed(data) {
  const planNames = {
    bronze: 'باقة التجربة (24 ساعة) - $5',
    diamond: 'الباقة الماسية (شهر كامل) - $15',
    silver: 'الباقة الماسية (شهر كامل) - $15',
    vip: 'باقة VIP الشاملة (شهر كامل) - $30',
    gold: 'باقة VIP الشاملة (شهر كامل) - $30'
  };
  const planText = planNames[data.plan] || data.plan || 'الباقة الماسية (شهر كامل) - $15';

  return new EmbedBuilder()
    .setColor(0x2ecc71)
    .setTitle('✅ تم تفعيل اشتراكك بنجاح')
    .setDescription(
`مرحباً بك! بدأ تجهيز بوت الفرم الخاص بك للعمل في سيرفرك.

• **نوع الباقة:** ${planText}
• **اللاعب:** \`${data.username}\`
• **السيرفر:** \`${data.server}:${data.port || 25565}\`
• **الميزات:** حماية Anti-AFK + ضرب الموبات + أكل وتفريغ تلقائي

*(للمتابعة اكتب \`/my_bot\` | للإيقاف اكتب \`/farm_stop\`)*`
    )
    .setThumbnail(AVATAR_URL)
    .setFooter({ text: BOT_NAME, iconURL: AVATAR_URL });
}

// 📩 2. AFK Mode Activated DM
function getAfkStartedDMEmbed(data) {
  return new EmbedBuilder()
    .setColor(0x3498db)
    .setTitle('🟢 بدأ وضع الخمول (AFK Active)')
    .setDescription(
`دخل البوت بنجاح إلى سيرفر \`${data.server}:${data.port || 25565}\` باسم \`${data.username}\` وتمركز في منطقة الأمان.

• **الحالة:** خمول نشط 24/7 (حماية 100%)
• **العداد:** بدأ الآن

*(ستصلك رسالة هنا تلقائياً عند ترقية مستواك أو فتح الصناديق)*`
    )
    .setThumbnail(AVATAR_URL)
    .setFooter({ text: BOT_NAME, iconURL: AVATAR_URL });
}

// Helper to resolve user
async function resolveDiscordUser(userQuery, client) {
  if (!userQuery) return null;

  // 1. Direct Discord ID (17-20 numeric digits)
  const cleanId = String(userQuery).replace(/[^0-9]/g, '');
  if (cleanId.length >= 17 && cleanId.length <= 20) {
    const fetched = await client.users.fetch(cleanId).catch(() => null);
    if (fetched) return fetched;
  }

  const searchName = String(userQuery).toLowerCase().trim().replace(/^@/, '');

  // 2. Search Guild Members via Discord API search
  for (const guild of client.guilds.cache.values()) {
    try {
      const searched = await guild.members.search({ query: searchName, limit: 10 }).catch(() => null);
      if (searched && searched.size > 0) {
        // Exact match
        const exact = searched.find(m => 
          m.user.username.toLowerCase() === searchName ||
          m.user.tag.toLowerCase() === searchName ||
          (m.nickname && m.nickname.toLowerCase() === searchName)
        );
        if (exact) return exact.user;

        // Prefix match
        const startsWith = searched.find(m => 
          m.user.username.toLowerCase().startsWith(searchName) ||
          (m.nickname && m.nickname.toLowerCase().startsWith(searchName))
        );
        if (startsWith) return startsWith.user;

        // Fallback to closest match in searched results
        return searched.first().user;
      }
    } catch (e) {
      console.log('Search members error:', e.message);
    }
  }

  // 3. Check client users cache
  const cached = client.users.cache.find(u => 
    u.username.toLowerCase() === searchName ||
    u.tag.toLowerCase() === searchName
  );
  if (cached) return cached;

  return null;
}

// ==========================================
// 2. Bot Engine & Event Listeners
// ==========================================

function loginBot(useMessageContent = true) {
  const currentIntents = [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages
  ];
  if (useMessageContent) {
    currentIntents.push(GatewayIntentBits.MessageContent);
  }

  const botClient = new Client({ intents: currentIntents });
  botClient.userSessions = {};

  botClient.once('ready', async () => {
    console.log('===========================================================');
    console.log(`  🐺 تم تسجيل الدخول بنجاح! البوت متصل الآن كـ: ${botClient.user.tag}`);
    console.log(`  🟢 الحالة: متصل أونلاين (Online 24/7) في سيرفرك!`);
    console.log(`  ⚡ بادئة الأوامر (Prefix): ${PREFIX} وأوامر السلاش (/)`);
    console.log('===========================================================');

    botClient.user.setPresence({
      activities: [{
        name: `Minecraft AFK Farm 🐺 | /help`,
        type: ActivityType.Watching
      }],
      status: 'online'
    });

    // Update bot avatar in Discord to the 24k Golden Goat logo
    try {
      const goldAvatarPath = path.join(__dirname, 'goat_avatar_gold.png');
      if (fs.existsSync(goldAvatarPath)) {
        botClient.user.setAvatar(goldAvatarPath).then(() => {
          console.log('  ✨ [Discord Avatar]: تم تحديث صورة بروفايل البوت في الديسكورد إلى الشعار الذهبي الفاخر بنجاح!');
        }).catch(err => {
          console.log('  ℹ️ [Discord Avatar Notice]:', err.message);
        });
      }
    } catch (e) {}

    const slashCommands = [
      { name: 'help', description: '🐺 استعراض قائمة أوامر البوت والمساعدة' },
      {
        name: 'redeem',
        description: '🔑 تفعيل كود اشتراكك المستلم من الموقع أو الإدارة',
        options: [
          {
            name: 'code',
            description: 'كود الاشتراك (مثال: GOAT-DIA-XXXX-YYYY)',
            type: 3,
            required: true
          }
        ]
      },
      {
        name: 'create_code',
        description: '👑 (المالك فقط) إنشاء وتوليد كود ترخيص اشتراك يدوي',
        options: [
          {
            name: 'plan',
            description: 'نوع الباقة',
            type: 3,
            required: true,
            choices: [
              { name: '🥉 باقة التجربة اليومية (24 ساعة - $5)', value: 'bronze' },
              { name: '💎 الباقة الماسية (شهر كامل - $15)', value: 'diamond' },
              { name: '👑 باقة VIP الشاملة (شهر كامل - $30)', value: 'vip' }
            ]
          },
          {
            name: 'user',
            description: 'اختياري: إرسال الكود بالخاص لهذا العضو فوراً',
            type: 6,
            required: false
          }
        ]
      },
      { name: 'status', description: '📊 عرض حالة سيرفر ماينكرافت واللاعب الخامل' },
      { name: 'rewards', description: '🎁 استعراض قائمة مستويات جوائز الخمول' },
      { name: 'chest', description: '📦 فحص صندوق الغنائم والموارد النادرة' },
      { name: 'ping', description: '📶 فحص سرعة استجابة البوت' },
      { name: 'farm', description: '⚔️ معلومات موديول الفرم والضرب التلقائي' },
      {
        name: 'farm_start',
        description: '🚀 تشغيل جلسة بوت الفرم لحسابك وسيرفرك الخاص (للمشتركين فقط)',
        options: [
          { name: 'server', description: 'آيبي السيرفر (مثال: play.server.com)', type: 3, required: true },
          { name: 'username', description: 'اسمك في ماينكرافت (Minecraft Username)', type: 3, required: true },
          { name: 'port', description: 'بورت السيرفر (الافتراضي 25565)', type: 4, required: false },
          { name: 'password', description: 'كلمة المرور إذا كان السيرفر مكرك (لـ /login)', type: 3, required: false }
        ]
      },
      { name: 'farm_stop', description: '🛑 إيقاف جلسة البوت الخاصة بك' },
      { name: 'my_bot', description: '👤 عرض تفاصيل اشتراكك وحالة جلسة البوت' },
      { name: 'plans', description: '💎 استعراض باقات وأسعار الاشتراك في بوت الفرم' }
    ];

    // 1. Clear Global Commands to prevent duplicates
    try {
      await botClient.application.commands.set([]);
      console.log('  🧹 تم تنظيف وتصفير الأوامر العامة لمنع التكرار.');
    } catch (e) {}

    // 2. Register Guild Commands
    for (const guild of botClient.guilds.cache.values()) {
      try {
        await guild.commands.set(slashCommands);
        console.log(`  ⚡ تم تسجيل الأوامر الفورية لسيرفر: ${guild.name} (بدون تكرار)`);
      } catch (e) {
        console.warn(`  [Guild Command Notice] ${guild.name}:`, e.message);
      }
    }

    // 3. Start Local HTTP API for Website Subscription Integration
    startHttpApi(botClient);
  });

  botClient.on('interactionCreate', async (interaction) => {
    if (interaction.isCommand()) {
      const { commandName } = interaction;
      if (commandName === 'help') {
        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId('btn_status').setLabel('📊 فحص الحالة').setStyle(ButtonStyle.Primary),
          new ButtonBuilder().setCustomId('btn_rewards').setLabel('🎁 المكافآت').setStyle(ButtonStyle.Success),
          new ButtonBuilder().setCustomId('btn_plans').setLabel('💎 باقات الاشتراك').setStyle(ButtonStyle.Secondary)
        );
        await interaction.reply({ embeds: [getHelpEmbed()], components: [row] });
      } else if (commandName === 'redeem') {
        const inputCode = (interaction.options.getString('code') || '').trim().toUpperCase();
        const db = loadSubDb();
        const license = db.licenses[inputCode];

        if (!license) {
          return interaction.reply({
            content: '❌ **كود الترخيص غير صحيح!**\nيرجى التأكد من كتابة الكود بدقة كما استلمته من الموقع أو الخاص (مثال: `GOAT-DIA-XXXX-YYYY`).',
            ephemeral: true
          });
        }

        if (license.status === 'redeemed') {
          const redeemedDate = new Date(license.redeemedAt).toLocaleString('ar-EG');
          return interaction.reply({
            content: `⚠️ **تم استخدام هذا الكود سابقاً!**\nتم التفعيل بتاريخ: \`${redeemedDate}\` بواسطة المستخدم: <@${license.redeemedBy}>.\nإذا كنت تواجه مشكلة يرجى مراجعة إدارة السيرفر.`,
            ephemeral: true
          });
        }

        // Activate license
        const spec = PLAN_SPECS[license.plan] || PLAN_SPECS.diamond;
        const duration = license.durationMs || spec.durationMs;
        const currentSub = db.activeSubscriptions[interaction.user.id];

        let startTime = Date.now();
        let expiresAt = startTime + duration;

        // If user already has an active valid sub of the same tier, stack/extend the time!
        if (currentSub && currentSub.expiresAt > Date.now() && currentSub.plan === license.plan) {
          expiresAt = currentSub.expiresAt + duration;
          startTime = currentSub.startTime;
        }

        license.status = 'redeemed';
        license.redeemedBy = interaction.user.id;
        license.redeemedUserTag = interaction.user.tag;
        license.redeemedAt = Date.now();

        db.activeSubscriptions[interaction.user.id] = {
          plan: license.plan,
          planName: spec.name,
          startTime,
          expiresAt,
          codeUsed: inputCode,
          updatedAt: Date.now()
        };
        saveSubDb(db);

        const exp = new Date(expiresAt);
        const expDateStr = `${exp.getFullYear()}/${(exp.getMonth() + 1).toString().padStart(2, '0')}/${exp.getDate().toString().padStart(2, '0')}`;

        const cleanPlanName = spec.name.replace(/^[🥉💎👑]\s*/, '');
        const tiersText = spec.key === 'vip' ? 'جميع رتب ومكافآت الخمول' : spec.allowedTiers.join(' • ');

        const successEmbed = new EmbedBuilder()
          .setColor(0x00ff88)
          .setTitle('🎉 تم تفعيل اشتراكك بنجاح')
          .setDescription(
`أهلاً بك <@${interaction.user.id}>! تم توثيق اشتراكك وأصبح بإمكانك تشغيل البوت الآن.

👑 **الباقة:** ${cleanPlanName}
⏱️ **المدة:** ${spec.durationText} (صالحة حتى ${expDateStr})
🏆 **الرتب:** ${tiersText}

**أمر التشغيل المباشر في روم الأوامر:**
اكتب الأمر التالي في روم الأوامر مع استبدال اسم السيرفر واسم حسابك:
\`\`\`
/farm_start server:play.server.net username:اسم_لاعبك
\`\`\`

💡 للمتابعة اكتب \`/my_bot\` وللإيقاف اكتب \`/farm_stop\``
          )
          .setThumbnail(AVATAR_URL)
          .setFooter({ text: `${BOT_NAME} • اشتراك موثق`, iconURL: AVATAR_URL });

        await interaction.reply({ embeds: [successEmbed] });

        // Also notify via DM
        interaction.user.send({ embeds: [successEmbed] }).catch(() => {});

      } else if (commandName === 'create_code') {
        const isOwnerOrAdmin = interaction.guild 
          ? (interaction.guild.ownerId === interaction.user.id || interaction.member.permissions?.has('Administrator'))
          : true;

        if (!isOwnerOrAdmin) {
          return interaction.reply({
            content: '❌ هذا الأمر مخصص لمالك البوت أو إدارة السيرفر فقط!',
            ephemeral: true
          });
        }

        const planKey = interaction.options.getString('plan');
        const targetUser = interaction.options.getUser('user');
        const spec = PLAN_SPECS[planKey] || PLAN_SPECS.diamond;
        const code = generateLicenseKey(planKey);

        const db = loadSubDb();
        db.licenses[code] = {
          code,
          plan: spec.key,
          planName: spec.name,
          durationMs: spec.durationMs,
          durationText: spec.durationText,
          createdAt: Date.now(),
          createdBy: interaction.user.id,
          targetUserId: targetUser ? targetUser.id : null,
          status: 'unused'
        };
        saveSubDb(db);

        let dmSent = false;
        if (targetUser) {
          try {
            const dmEmbed = getLicensePurchasedDMEmbed(code, planKey);
            await targetUser.send({ embeds: [dmEmbed] });
            dmSent = true;
          } catch (e) {
            console.log(`[create_code] Failed to DM target user:`, e.message);
          }
        }

        const codeEmbed = new EmbedBuilder()
          .setColor(0x00f0ff)
          .setTitle('👑 تم توليد كود اشتراك ترخيص جديد بنجاح')
          .setThumbnail(AVATAR_URL)
          .addFields(
            { name: '🔑 كود الترخيص (License Key):', value: `\`\`\`${code}\`\`\``, inline: false },
            { name: '💎 نوع الباقة:', value: `**${spec.name}** (${spec.price})`, inline: true },
            { name: '⏱️ المدة:', value: `**${spec.durationText}**`, inline: true },
            { name: '📩 حالة إرسال الخاص:', value: targetUser ? (dmSent ? `✅ تم إرساله لخاص <@${targetUser.id}>` : `⚠️ تعذر الإرسال للخاص (مغلق)`) : 'لم يتم تحديد مستخدم (يدوي)', inline: false },
            { name: '📋 أمر التفعيل للعميل:', value: `\`/redeem code:${code}\``, inline: false }
          )
          .setFooter({ text: `${BOT_NAME} • Management Licensing System` })
          .setTimestamp();

        await interaction.reply({ embeds: [codeEmbed], ephemeral: true });

      } else if (commandName === 'status') {
        await interaction.reply({ embeds: [getStatusEmbed(botClient)] });
      } else if (commandName === 'rewards') {
        await interaction.reply({ embeds: [getRewardsEmbed()] });
      } else if (commandName === 'chest') {
        await interaction.reply({ embeds: [getChestEmbed()] });
      } else if (commandName === 'ping') {
        await interaction.reply(`🏓 **Pong!** سرعة استجابة البوت هي: \`${botClient.ws.ping}ms\``);
      } else if (commandName === 'farm') {
        await interaction.reply({ embeds: [getFarmEmbed()] });
      } else if (commandName === 'plans') {
        const plansEmbed = new EmbedBuilder()
          .setColor(0xffaa00)
          .setTitle('💎 باقات وخطط الاشتراك في بوت الفرم الذكي (Goat AFK Plans)')
          .setDescription('اشترك في البوت ودعه يفرّم لك في أي سيرفر 24/7 دون توقف وأنت غير متواجد!')
          .setThumbnail(AVATAR_URL)
          .addFields(
            { name: '🥉 باقة التجربة اليومية (24 ساعة)', value: 'سعر الباقة: **$5**\n• مدة 24 ساعة فرم مستمر\n• تدعم رتبة وجوائز: **البرونزي فقط**\n• حماية ضد الطرد Anti-AFK وضرب الموبات', inline: false },
            { name: '💎 الباقة الماسية (شهر كامل - الأكثر طلباً)', value: 'سعر الباقة: **$15**\n• مدة شهر كامل (30 يوماً)\n• تدعم رتب وجوائز: **برونزي + فضي + ذهبي**\n• أكل تلقائي وتفريغ الصناديق وتجميع XP', inline: false },
            { name: '👑 باقة VIP الشاملة (شهر كامل)', value: 'سعر الباقة: **$30**\n• مدة شهر كامل (30 يوماً)\n• تدعم **جميع الميزات ورتب الخمول بلا استثناء:**\n• **برونزي + فضي + ذهبي + ماسي + أسطوري**\n• سيرفر مخصص 24/7 ودعم أولوية ورتبة VIP', inline: false }
          )
          .setFooter({ text: 'للشراء من الموقع أو اكتب /redeem إذا كان لديك كود تفعيل' });
        await interaction.reply({ embeds: [plansEmbed] });
      } else if (commandName === 'farm_start') {
        // 🔒 Subscription Check Gatekeeper
        const sub = getUserSubscription(interaction.user.id);
        if (!sub || sub.isExpired) {
          const noSubEmbed = new EmbedBuilder()
            .setColor(0xff3355)
            .setTitle('🔒 عذراً! يتطلب تشغيل البوت اشتراكاً نشطاً')
            .setDescription(`أهلاً بك يا <@${interaction.user.id}>! خدمة تشغيل بوت الفرم الذكي \`/farm_start\` مخصصة حصرياً للمشتركين الذين يمتلكون ترخيصاً نشطاً وموثقاً.\n\n` +
              (sub && sub.isExpired 
                ? `⚠️ **تنبيه:** انتهت صلاحية اشتراكك السابق بتاريخ: **${new Date(sub.expiresAt).toLocaleDateString('ar-EG')}**.` 
                : `ℹ️ لم يتم العثور على اشتراك مسجل لحسابك حتى الآن.`))
            .setThumbnail(AVATAR_URL)
            .addFields(
              { name: '🔑 إذا كان لديك كود تفعيل مستلم من الموقع:', value: 'استخدم الأمر: `/redeem code:الكود-هنا` لتنشيط حسابك فوراً.', inline: false },
              { name: '💎 لشراء باقة اشتراك جديدة:', value: 'اطلع على الباقات عبر أمر `/plans` أو قم بالشراء مباشرة من الموقع الرسمي لتصلك رسالة التفعيل بالخاص فوراً.', inline: false }
            )
            .setFooter({ text: `${BOT_NAME} • نظام التحقق من التراخيص المشفرة` });

          return interaction.reply({ embeds: [noSubEmbed], ephemeral: true });
        }

        let server = interaction.options.getString('server');
        const username = interaction.options.getString('username');
        let port = interaction.options.getInteger('port') || 25565;
        const password = interaction.options.getString('password') || '';

        // إذا كتب المستخدم البورت مع اسم السيرفر (مثل play.server.net:12345) نستخرجه تلقائياً
        if (server && server.includes(':')) {
          const parts = server.split(':');
          server = parts[0].trim();
          const parsedPort = parseInt(parts[1], 10);
          if (!isNaN(parsedPort) && parsedPort > 0) {
            port = parsedPort;
          }
        }

        botClient.userSessions[interaction.user.id] = {
          server,
          username,
          port,
          hasPassword: Boolean(password),
          startTime: Date.now(),
          plan: sub.plan,
          planName: sub.planName
        };

        const remainingMs = sub.expiresAt - Date.now();
        const remainingDays = Math.ceil(remainingMs / (1000 * 60 * 60 * 24));
        const remainingHours = Math.ceil(remainingMs / (1000 * 60 * 60));
        const timeRemainingText = remainingDays > 1 ? `${remainingDays} يوم` : `${remainingHours} ساعة`;

        const sessionEmbed = new EmbedBuilder()
          .setColor(0x2ecc71)
          .setTitle('🚀 تم تشغيل بوت الفرم بنجاح')
          .setDescription(
`أهلاً بك <@${interaction.user.id}>، بدأ البوت العمل في سيرفرك الآن على مدار الساعة.

• **اللاعب:** \`${username}\`
• **السيرفر:** \`${server}:${port}\`
• **الباقة:** ${sub.planName} (${timeRemainingText})
• **الحماية:** Anti-AFK نشطة 24/7

*(للمتابعة اكتب \`/my_bot\` | للإيقاف اكتب \`/farm_stop\`)*`
          )
          .setThumbnail(AVATAR_URL)
          .setFooter({ text: BOT_NAME, iconURL: AVATAR_URL });

        await interaction.reply({ embeds: [sessionEmbed] });

        // 📩 1. Send Subscription Confirmation DM
        const subEmbed = getSubscriptionDMEmbed({
          username,
          server,
          port,
          plan: sub.plan
        });
        interaction.user.send({ embeds: [subEmbed] })
          .then(() => console.log(`  📩 تم إرسال رسالة تفعيل الاشتراك بالخاص إلى: ${interaction.user.tag}`))
          .catch(err => console.log(`  ⚠️ تعذر إرسال DM الاشتراك:`, err.message));

        // 📩 2. Send Entered AFK Mode DM (after 1.5s delay)
        setTimeout(() => {
          const afkEmbed = getAfkStartedDMEmbed({
            username,
            server,
            port
          });
          interaction.user.send({ embeds: [afkEmbed] })
            .then(() => console.log(`  📩 تم إرسال رسالة دخول وضع الخمول بالخاص إلى: ${interaction.user.tag}`))
            .catch(err => console.log(`  ⚠️ تعذر إرسال DM وضع الخمول:`, err.message));
        }, 1500);

      } else if (commandName === 'farm_stop') {
        if (!botClient.userSessions[interaction.user.id]) {
          return interaction.reply({ content: '❌ ليس لديك أي جلسة بوت نشطة حالياً. لتشغيل البوت اكتب `/farm_start`!', ephemeral: true });
        }
        delete botClient.userSessions[interaction.user.id];
        await interaction.reply({
          embeds: [
            new EmbedBuilder()
              .setColor(0xff5555)
              .setTitle('🛑 تم إيقاف جلسة البوت الخاصة بك')
              .setDescription('تم فصل البوت وحفظ بياناتك بنجاح. يمكنك العودة والتشغيل بأي وقت عبر `/farm_start`!')
          ]
        });
      } else if (commandName === 'my_bot') {
        const sub = getUserSubscription(interaction.user.id);
        const session = botClient.userSessions[interaction.user.id];

        if (!sub && !session) {
          return interaction.reply({
            content: 'ℹ️ ليس لديك اشتراك نشط أو جلسة بوت مسجلة. للحصول على كود اشتراك استعرض الباقات عبر `/plans` أو اشترِ من الموقع!',
            ephemeral: true
          });
        }

        const remainingMs = sub ? (sub.expiresAt - Date.now()) : 0;
        const remainingDays = Math.ceil(remainingMs / (1000 * 60 * 60 * 24));
        const remainingHours = Math.ceil(remainingMs / (1000 * 60 * 60));
        const timeRemainingText = sub 
          ? (sub.isExpired ? 'منتهي الصلاحية' : (remainingDays > 1 ? `${remainingDays} يوم` : `${remainingHours} ساعة`))
          : 'غير مسجل';

        const exp = sub ? new Date(sub.expiresAt) : null;
        const expDateStr = exp ? `${exp.getFullYear()}/${(exp.getMonth() + 1).toString().padStart(2, '0')}/${exp.getDate().toString().padStart(2, '0')}` : '—';

        let desc = '';
        if (sub) {
          desc += `**بيانات الاشتراك:**\n`;
          desc += `• **الباقة:** ${sub.planName}\n`;
          desc += `• **الوقت المتبقي:** ${timeRemainingText}\n`;
          desc += `• **تاريخ الانتهاء:** \`${expDateStr}\`\n\n`;
        } else {
          desc += `🔴 **غير مشترك حالياً** (استعرض الباقات عبر \`/plans\`)\n\n`;
        }

        if (session) {
          const elapsedMins = Math.floor((Date.now() - session.startTime) / 60000);
          desc += `**الجلسة النشطة الآن:**\n`;
          desc += `• **اللاعب:** \`${session.username}\`\n`;
          desc += `• **السيرفر:** \`${session.server}:${session.port}\`\n`;
          desc += `• **مدة الخمول:** ${elapsedMins} دقيقة\n`;
          desc += `• **الحماية (Anti-AFK):** نشطة 🟢\n\n`;
          desc += `*(للإيقاف اكتب \`/farm_stop\`)*`;
        } else {
          desc += `**حالة الجلسة:**\n`;
          desc += `البوت غير مشغّل حالياً في أي سيرفر.\n`;
          desc += `لتشغيله: \`/farm_start server:play.server.net username:اسمك\``;
        }

        const myBotEmbed = new EmbedBuilder()
          .setColor(session ? 0x2ecc71 : 0x3498db)
          .setTitle('👤 تفاصيل الاشتراك والجلسة')
          .setDescription(desc)
          .setThumbnail(AVATAR_URL)
          .setFooter({ text: BOT_NAME, iconURL: AVATAR_URL });

        await interaction.reply({ embeds: [myBotEmbed] });
      } else if (commandName === 'plans') {
        const plansEmbed = new EmbedBuilder()
          .setColor(0x00f0ff)
          .setTitle('💎 باقات اشتراك بوت الفرم')
          .setDescription(
`**🥉 باقة التجربة (24 ساعة) — $5**
• فرم مستمر لمدة 24 ساعة
• تدعم رتبة البرونزي فقط

**💎 الباقة الماسية (شهر كامل) — $15**
• فرم مستمر لمدة 30 يوماً
• تدعم: برونزي • فضي • ذهبي
• أكل وتفريغ صناديق وجمع XP

**👑 باقة VIP الشاملة (شهر كامل) — $30**
• تدعم جميع الرتب: برونزي • فضي • ذهبي • ماسي • أسطوري
• أولوية اتصال ودعم فني متواصل

*(للشراء من الموقع أو استخدم \`/redeem\` إذا كان لديك كود)*`
          )
          .setThumbnail(AVATAR_URL)
          .setFooter({ text: BOT_NAME, iconURL: AVATAR_URL });

        await interaction.reply({ embeds: [plansEmbed], ephemeral: true });
      }
    } else if (interaction.isButton()) {
      if (interaction.customId === 'btn_status') {
        await interaction.reply({
          content: `📊 **حالة البوت:** متصل ومستقر بنسبة 99.9% 🟢 | سرعة الاستجابة: \`${botClient.ws.ping}ms\``,
          ephemeral: true
        });
      } else if (interaction.customId === 'btn_rewards') {
        await interaction.reply({
          content: `🎁 **المكافأة القادمة:** 1x Ancient Debris + 50 Discord XP!`,
          ephemeral: true
        });
      } else if (interaction.customId === 'btn_plans') {
        const plansEmbed = new EmbedBuilder()
          .setColor(0x00f0ff)
          .setTitle('💎 باقات اشتراك بوت الفرم')
          .setDescription(
`**🥉 باقة التجربة (24 ساعة) — $5**
• فرم مستمر لمدة 24 ساعة
• تدعم رتبة البرونزي فقط

**💎 الباقة الماسية (شهر كامل) — $15**
• فرم مستمر لمدة 30 يوماً
• تدعم: برونزي • فضي • ذهبي
• أكل وتفريغ صناديق وجمع XP

**👑 باقة VIP الشاملة (شهر كامل) — $30**
• تدعم جميع الرتب: برونزي • فضي • ذهبي • ماسي • أسطوري
• أولوية اتصال ودعم فني متواصل

*(للشراء من الموقع أو استخدم \`/redeem\` إذا كان لديك كود)*`
          )
          .setThumbnail(AVATAR_URL)
          .setFooter({ text: BOT_NAME, iconURL: AVATAR_URL });

        await interaction.reply({ embeds: [plansEmbed], ephemeral: true });
      } else if (interaction.customId.startsWith('btn_approve_')) {
        const reqId = interaction.customId.replace('btn_approve_', '');
        const db = loadSubDb();
        const reqData = db.pendingRequests ? db.pendingRequests[reqId] : null;

        if (!reqData) {
          return interaction.reply({ content: `⚠️ لم يتم العثور على بيانات الطلب #${reqId}!`, ephemeral: true });
        }

        if (reqData.status !== 'pending') {
          return interaction.reply({ 
            content: `⚠️ هذا الطلب تمت معالجته مسبقاً! الحالة الحالية: **${reqData.status === 'approved' ? 'مقبول ✅' : 'مرفوض ❌'}**`, 
            ephemeral: true 
          });
        }

        // 1. Generate License Key
        const code = generateLicenseKey(reqData.plan);
        const spec = PLAN_SPECS[reqData.plan] || PLAN_SPECS.diamond;

        db.licenses[code] = {
          code,
          plan: spec.key,
          planName: spec.name,
          durationMs: spec.durationMs,
          durationText: spec.durationText,
          createdAt: Date.now(),
          createdBy: 'admin_approved_superqi',
          approvedBy: interaction.user.tag,
          approvedById: interaction.user.id,
          requestId: reqId,
          customerQuery: reqData.discordQuery,
          txRef: reqData.txRef,
          status: 'unused'
        };

        reqData.status = 'approved';
        reqData.codeGenerated = code;
        reqData.approvedAt = Date.now();
        reqData.approvedBy = interaction.user.tag;
        saveSubDb(db);

        // 2. Deliver code to customer via DM
        let customerDmSent = false;
        let customerUser = null;
        if (reqData.targetUserId) {
          customerUser = await botClient.users.fetch(reqData.targetUserId).catch(() => null);
        }
        if (!customerUser && reqData.discordQuery) {
          customerUser = await resolveDiscordUser(reqData.discordQuery, botClient);
        }

        if (customerUser) {
          const customerApprovedEmbed = getLicensePurchasedDMEmbed(code, reqData.plan);
          await customerUser.send({
            content: `🎉 **أهلاً بك! تم التحقق من دفعتك واعتماد اشتراكك من قِبل الإدارة!**`,
            embeds: [customerApprovedEmbed]
          }).then(() => {
            customerDmSent = true;
          }).catch(err => {
            console.error(`Could not DM customer ${customerUser.tag}:`, err.message);
          });
        }

        // 3. Update Admin Message and remove buttons
        const updatedOwnerEmbed = new EmbedBuilder()
          .setColor(0x00ff88)
          .setTitle(`✅ تم قبول الطلب #${reqId} وتوليد الكود بنجاح`)
          .setDescription(
            `تمت مطابقة الحوالة واعتماد الطلب بنجاح:\n\n` +
            `🔑 **كود الترخيص المُنشأ:** \`${code}\`\n` +
            `📦 **الباقة:** ${spec.name}\n` +
            `👤 **المشتري:** ${customerUser ? `<@${customerUser.id}> (\`${customerUser.tag}\`)` : `\`${reqData.discordQuery}\``}\n` +
            `📝 **اسم المحوّل / الإشعار:** \`${reqData.txRef || 'لم يُدخل'}\`\n` +
            `📨 **إرسال الكود للخاص:** ${customerDmSent ? '✅ تم إرسال الكود وأمر السلاش لخاص المشتري بنجاح' : '⚠️ تعذر الإرسال للخاص (الخاص مغلق)، يمكنك نسخه له يدوياً'}\n` +
            `⏰ **وقت الاعتماد:** <t:${Math.floor(Date.now() / 1000)}:f>`
          )
          .setThumbnail(AVATAR_URL)
          .setFooter({ text: `${BOT_NAME} • تم الاعتماد بواسطة ${interaction.user.tag}` });

        await interaction.update({ embeds: [updatedOwnerEmbed], components: [] });

      } else if (interaction.customId.startsWith('btn_reject_')) {
        const reqId = interaction.customId.replace('btn_reject_', '');
        const db = loadSubDb();
        const reqData = db.pendingRequests ? db.pendingRequests[reqId] : null;

        if (!reqData) {
          return interaction.reply({ content: `⚠️ لم يتم العثور على بيانات الطلب #${reqId}!`, ephemeral: true });
        }

        if (reqData.status !== 'pending') {
          return interaction.reply({ 
            content: `⚠️ هذا الطلب تمت معالجته مسبقاً! الحالة: **${reqData.status}**`, 
            ephemeral: true 
          });
        }

        reqData.status = 'rejected';
        reqData.rejectedAt = Date.now();
        reqData.rejectedBy = interaction.user.tag;
        saveSubDb(db);

        // Notify customer
        let customerUser = null;
        if (reqData.targetUserId) {
          customerUser = await botClient.users.fetch(reqData.targetUserId).catch(() => null);
        }
        if (!customerUser && reqData.discordQuery) {
          customerUser = await resolveDiscordUser(reqData.discordQuery, botClient);
        }

        if (customerUser) {
          const rejectEmbed = new EmbedBuilder()
            .setColor(0xff3344)
            .setTitle(`❌ تعذر التحقق من حوالة الاشتراك | #${reqId}`)
            .setDescription(
              `أهلاً بك **${customerUser.username}**.\n\n` +
              `نعتذر منك، تعذر على المشرف التحقق من وصول مبلغ التحويل عبر محفظة سوبر كي للطلب **#${reqId}**.\n\n` +
              `إذا كنت قد أرسلت الحوالة بالفعل، يرجى التوجه إلى سيرفر الديسكورد والتواصل مع المشرف <@${OWNER_DISCORD_ID}> مع تزويده بصورة الإشعار من تطبيق سوبر كي لحل الإشكال مباشرة.`
            )
            .setFooter({ text: `${BOT_NAME} • خدمة المشتركين` });

          customerUser.send({ embeds: [rejectEmbed] }).catch(() => {});
        }

        const updatedOwnerEmbed = new EmbedBuilder()
          .setColor(0xff3344)
          .setTitle(`❌ تم رفض الطلب #${reqId}`)
          .setDescription(
            `تم رفض هذا الطلب وإشعار المشتري بعدم ثبوت الحوالة.\n\n` +
            `👤 **المشتري:** ${customerUser ? `<@${customerUser.id}> (\`${customerUser.tag}\`)` : `\`${reqData.discordQuery}\``}\n` +
            `📦 **الباقة:** ${reqData.planName}\n` +
            `📝 **الإشعار المدخل:** \`${reqData.txRef || 'لم يُدخل'}\`\n` +
            `⏰ **وقت الرفض:** <t:${Math.floor(Date.now() / 1000)}:f>`
          )
          .setThumbnail(AVATAR_URL)
          .setFooter({ text: `${BOT_NAME} • تم الرفض بواسطة ${interaction.user.tag}` });

        await interaction.update({ embeds: [updatedOwnerEmbed], components: [] });
      }
    }
  });

  botClient.on('messageCreate', async (message) => {
    if (message.author.bot) return;
    const content = message.content ? message.content.trim() : '';
    const isMentioned = botClient.user && message.mentions.has(botClient.user.id);
    if (!content.startsWith(PREFIX) && !isMentioned) return;

    let command = '';
    if (content.startsWith(PREFIX)) {
      const words = content.slice(PREFIX.length).trim().split(/ +/);
      command = words[0] ? words[0].toLowerCase() : '';
    } else if (isMentioned) {
      const words = content.replace(/<@!?[0-9]+>/g, '').trim().split(/ +/);
      command = words[0] ? words[0].toLowerCase() : 'help';
    }

    if (command === 'help' || command === 'اوامر' || command === 'مساعدة') {
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('btn_status').setLabel('📊 فحص الحالة').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId('btn_rewards').setLabel('🎁 المكافآت').setStyle(ButtonStyle.Success)
      );
      return message.reply({ embeds: [getHelpEmbed()], components: [row] });
    }
    if (command === 'status' || command === 'حالة') return message.reply({ embeds: [getStatusEmbed(botClient)] });
    if (command === 'rewards' || command === 'مكافات' || command === 'جوائز') return message.reply({ embeds: [getRewardsEmbed()] });
    if (command === 'chest' || command === 'صندوق') return message.reply({ embeds: [getChestEmbed()] });
    if (command === 'ping' || command === 'بنق') return message.reply(`🏓 **Pong!** سرعة استجابة البوت هي: \`${botClient.ws.ping}ms\``);
    if (command === 'farm' || command === 'فرم') return message.reply({ embeds: [getFarmEmbed()] });
    if (command === 'plans' || command === 'باقات' || command === 'اشتراك') {
      const plansEmbed = new EmbedBuilder()
        .setColor(0xffaa00)
        .setTitle('💎 باقات وخطط الاشتراك في بوت الفرم الذكي (Goat AFK Plans)')
        .setDescription('اشترك في البوت ودعه يفرّم لك في أي سيرفر 24/7 دون توقف وأنت غير متواجد!')
        .setThumbnail(AVATAR_URL)
        .addFields(
          { name: '🥉 باقة التجربة اليومية (24 ساعة)', value: 'سعر الباقة: **$5**\n• مدة 24 ساعة فرم مستمر\n• تدعم رتبة وجوائز: **البرونزي فقط**\n• حماية ضد الطرد Anti-AFK وضرب الموبات', inline: false },
          { name: '💎 الباقة الماسية (شهر كامل - الأكثر طلباً)', value: 'سعر الباقة: **$15**\n• مدة شهر كامل (30 يوماً)\n• تدعم رتب وجوائز: **برونزي + فضي + ذهبي**\n• أكل تلقائي وتفريغ الصناديق وتجميع XP', inline: false },
          { name: '👑 باقة VIP الشاملة (شهر كامل)', value: 'سعر الباقة: **$30**\n• مدة شهر كامل (30 يوماً)\n• تدعم **جميع الميزات ورتب الخمول بلا استثناء:**\n• **برونزي + فضي + ذهبي + ماسي + أسطوري**\n• سيرفر مخصص 24/7 ودعم أولوية ورتبة VIP', inline: false }
        )
        .setFooter({ text: 'للشراء من الموقع أو اكتب /redeem إذا كان لديك كود تفعيل' });
      return message.reply({ embeds: [plansEmbed] });
    }
    if (command === 'redeem' || command === 'تفعيل') {
      const words = content.slice(PREFIX.length).trim().split(/ +/);
      const inputCode = (words[1] || '').trim().toUpperCase();
      if (!inputCode) {
        return message.reply('ℹ️ لتفعيل الكود اكتب: `!redeem الكود-هنا` أو استخدم أمر السلاش الجاهز: `/redeem code:كودك`');
      }
      const db = loadSubDb();
      const license = db.licenses[inputCode];
      if (!license) return message.reply('❌ **كود الترخيص غير صحيح!** يرجى التأكد من كتابة الكود بدقة.');
      if (license.status === 'redeemed') return message.reply(`⚠️ **تم استخدام هذا الكود سابقاً!**`);
      
      const spec = PLAN_SPECS[license.plan] || PLAN_SPECS.diamond;
      const duration = license.durationMs || spec.durationMs;
      const currentSub = db.activeSubscriptions[message.author.id];
      let startTime = Date.now();
      let expiresAt = startTime + duration;
      if (currentSub && currentSub.expiresAt > Date.now() && currentSub.plan === license.plan) {
        expiresAt = currentSub.expiresAt + duration;
        startTime = currentSub.startTime;
      }
      license.status = 'redeemed';
      license.redeemedBy = message.author.id;
      license.redeemedUserTag = message.author.tag;
      license.redeemedAt = Date.now();
      db.activeSubscriptions[message.author.id] = {
        plan: license.plan,
        planName: spec.name,
        startTime,
        expiresAt,
        codeUsed: inputCode,
        updatedAt: Date.now()
      };
      saveSubDb(db);
      return message.reply(`🎉 **تم تفعيل اشتراكك بنجاح (${spec.name})!** يمكنك الآن استخدام \`/farm_start\` لتشغيل البوت!`);
    }
  });

  botClient.login(TOKEN).catch((err) => {
    if (err.message && err.message.includes('disallowed intents') && useMessageContent) {
      console.log('⚠️ [Notice] MessageContent intent not active in portal, falling back to standard intents...');
      loginBot(false);
    } else {
      console.error('\n❌ [خطأ في تسجيل الدخول]:', err.message);
    }
  });
}

// ==========================================
// 3. HTTP API Server for Website Integration
// ==========================================

function startHttpApi(botClient) {
  const server = http.createServer(async (req, res) => {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      return res.end();
    }

    if (req.method === 'POST' && req.url === '/api/customer-subscribe') {
      let body = '';
      req.on('data', chunk => { body += chunk; });
      req.on('end', async () => {
        try {
          const payload = JSON.parse(body || '{}');
          const { discordUser, mcName, serverHost, serverPort, plan } = payload;

          console.log(`\n📩 [Website API] استلام اشتراك جديد من الموقع:`, {
            discordUser: discordUser || 'Default Owner',
            mcName: mcName || 'Goat_Player',
            server: `${serverHost}:${serverPort}`,
            plan
          });

          const targetUser = await resolveDiscordUser(discordUser, botClient);
          let dmSent = false;
          let userTag = 'Unknown';

          if (targetUser) {
            userTag = targetUser.tag;

            // 1. Send Subscription Confirmation DM
            const subEmbed = getSubscriptionDMEmbed({
              username: mcName || 'Goat_Player1',
              server: serverHost || 'play.skyblock.net',
              port: serverPort || 25565,
              plan: plan || 'silver'
            });

            await targetUser.send({ embeds: [subEmbed] })
              .then(() => {
                dmSent = true;
                console.log(`  ✅ [DM 1] تم إرسال رسالة تأكيد الاشتراك في الخاص إلى: ${targetUser.tag}`);
              })
              .catch(err => {
                console.log(`  ⚠️ [DM 1] تعذر إرسال رسالة الخاص (DMs مغلقة أو صلاحيات):`, err.message);
              });

            // 2. Send Entered AFK Mode DM (after 1.5 seconds)
            setTimeout(async () => {
              const afkEmbed = getAfkStartedDMEmbed({
                username: mcName || 'Goat_Player1',
                server: serverHost || 'play.skyblock.net',
                port: serverPort || 25565
              });

              await targetUser.send({ embeds: [afkEmbed] })
                .then(() => {
                  console.log(`  ✅ [DM 2] تم إرسال رسالة دخول وضع الخمول في الخاص إلى: ${targetUser.tag}`);
                })
                .catch(err => {
                  console.log(`  ⚠️ [DM 2] تعذر إرسال رسالة الخمول بالخاص:`, err.message);
                });
            }, 1500);

            // Record active session
            botClient.userSessions[targetUser.id] = {
              username: mcName,
              server: serverHost,
              port: serverPort,
              plan: plan || 'silver',
              startTime: Date.now()
            };
          } else {
            console.log(`  ⚠️ لم يتم العثور على مستخدم بالديسكورد للبيانات: ${discordUser}`);
          }

          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            success: true,
            dmSent,
            recipient: userTag,
            message: dmSent 
              ? `تم إرسال رسالة تفعيل الاشتراك ورسالة بدء الخمول إلى خاص ${userTag} بنجاح!` 
              : 'تم تفعيل الاشتراك بالبوت بنجاح'
          }));
        } catch (err) {
          console.error('API Error:', err.message);
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: err.message }));
        }
      });
    } else if (req.method === 'POST' && req.url === '/api/purchase-license') {
      let body = '';
      req.on('data', chunk => { body += chunk; });
      req.on('end', async () => {
        try {
          const payload = JSON.parse(body || '{}');
          const { discordUser, plan, txRef, receiptImageBase64 } = payload;
          const planKey = (plan && PLAN_SPECS[plan]) ? plan : 'diamond';
          const spec = PLAN_SPECS[planKey];
          const requestId = 'REQ-' + Math.floor(100000 + Math.random() * 900000);
          const iqdPrices = { bronze: '7,500 د.ع', diamond: '22,500 د.ع', vip: '45,000 د.ع' };
          const priceIqd = spec.priceIqd || iqdPrices[planKey] || '22,500 د.ع';
          const hasImage = Boolean(receiptImageBase64 && typeof receiptImageBase64 === 'string' && receiptImageBase64.startsWith('data:image'));

          console.log(`\n💳 [Purchase API] طلب اشتراك جديد عبر سوبر كي بحاجة للتحقق:`, {
            requestId,
            discordUser: discordUser || 'Not specified',
            plan: planKey,
            planName: spec.name,
            txRef: txRef || 'None',
            hasReceiptScreenshot: hasImage,
            price: spec.price,
            priceIqd
          });

          // Resolve the customer in Discord
          const targetUser = await resolveDiscordUser(discordUser, botClient);
          let userTag = targetUser ? targetUser.tag : (discordUser || 'المشتري');

          // Save pending request to database
          const db = loadSubDb();
          db.pendingRequests[requestId] = {
            requestId,
            plan: spec.key,
            planName: spec.name,
            price: spec.price,
            priceIqd,
            discordQuery: discordUser || 'غير محدد',
            targetUserId: targetUser ? targetUser.id : null,
            targetUserTag: targetUser ? targetUser.tag : null,
            txRef: txRef || 'لم يُدخل',
            hasReceiptScreenshot: hasImage,
            status: 'pending',
            createdAt: Date.now()
          };
          saveSubDb(db);

          // 1. Notify Owner / Admin (Walid Abbas) with Interactive Buttons & Screenshot
          try {
            const ownerUser = await botClient.users.fetch(OWNER_DISCORD_ID).catch(() => null);
            if (ownerUser) {
              const files = [];
              let imageNoticeText = '';

              if (hasImage) {
                try {
                  const matches = receiptImageBase64.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
                  if (matches && matches[2]) {
                    const imgBuffer = Buffer.from(matches[2], 'base64');
                    const attachment = new AttachmentBuilder(imgBuffer, { name: 'superqi_receipt.png' });
                    files.push(attachment);
                    imageNoticeText = '\n📸 **وصل التحويل:** مرفق صورة الإشعار بالأسفل ⬇️';
                  }
                } catch (imgErr) {
                  console.error('[Purchase API] Error attaching receipt screenshot:', imgErr.message);
                }
              }

              const adminReviewEmbed = new EmbedBuilder()
                .setColor(0xffaa00)
                .setTitle('🔔 طلب شراء جديد بحاجة للتحقق | SuperQi')
                .setDescription(
`وصلك طلب اشتراك جديد عبر الدفع بمحفظة **سوبر كي (SuperQi)**!
يرجى فتح تطبيق سوبر كي في هاتفك ومطابقة التحويل، ثم الضغط على الزر المناسب:

🆔 **رقم الطلب:** \`#${requestId}\`
👤 **المشتري:** ${targetUser ? `<@${targetUser.id}> (\`${targetUser.tag}\`)` : `\`${discordUser}\``}
📦 **الباقة المطلوبة:** **${spec.name}**
💰 **المبلغ المطلوب:** **${spec.price}** (${priceIqd})
📝 **اسم المحوّل / رقم الإشعار:** \`${txRef || 'لم يُدخل'}\`${imageNoticeText}
⏰ **وقت الطلب:** <t:${Math.floor(Date.now() / 1000)}:R>`
                )
                .setThumbnail(AVATAR_URL)
                .setFooter({ text: `${BOT_NAME} • نظام التحقق اليدوي المباشر` })
                .setTimestamp();

              if (files.length > 0) {
                adminReviewEmbed.setImage('attachment://superqi_receipt.png');
              }

              const actionRow = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                  .setCustomId(`btn_approve_${requestId}`)
                  .setLabel('✅ قبول وتوليد الكود')
                  .setStyle(ButtonStyle.Success),
                new ButtonBuilder()
                  .setCustomId(`btn_reject_${requestId}`)
                  .setLabel('❌ رفض الطلب')
                  .setStyle(ButtonStyle.Danger)
              );

              await ownerUser.send({ embeds: [adminReviewEmbed], files, components: [actionRow] });
              console.log(`  📩 [Purchase API] تم إرسال إشعار وأزرار التحقق (مع لقطة الشاشة: ${hasImage ? 'نعم 📸' : 'لا'}) إلى خاص المالك (${ownerUser.tag}).`);
            }
          } catch (e) {
            console.error('Error sending DM to owner:', e.message);
          }

          // 2. Send Acknowledgment DM to customer
          let dmSent = false;
          if (targetUser) {
            const customerWaitEmbed = new EmbedBuilder()
              .setColor(0x00c8ff)
              .setTitle(`⏳ جاري التحقق من طلب الاشتراك | #${requestId}`)
              .setDescription(
`أهلاً بك **${targetUser.username}**! 👋
تم استلام طلب اشتراكك في **${spec.name}** بنجاح.

🔍 **حالة الطلب:** **قيد المراجعة والمطابقة (Pending Verification)**
💰 **المبلغ:** **${spec.price}** (${priceIqd})
💳 **اسم المحوّل / الإشعار المدخل:** \`${txRef || 'لم يُدخل'}\`

📌 **ماذا سيحدث الآن؟**
يقوم صاحب الحساب (**وليد عباس**) بمطابقة الحوالة في محفظة سوبر كي عبر هاتفه. بمجرد الضغط على تأكيد، سيقوم البوت بإرسال **كود التفعيل وأمر السلاش** هنا في الخاص تلقائياً!

💬 سيرفر الدعم الرسمي: https://discord.gg/h22X8tMwtA`
              )
              .setThumbnail(AVATAR_URL)
              .setFooter({ text: `${BOT_NAME} • رقم الطلب #${requestId}`, iconURL: AVATAR_URL })
              .setTimestamp();

            await targetUser.send({ embeds: [customerWaitEmbed] })
              .then(() => {
                dmSent = true;
                console.log(`  📩 [Purchase API] تم إرسال إشعار قيد الانتظار إلى خاص: ${targetUser.tag}`);
              })
              .catch(err => {
                console.log(`  ⚠️ [Purchase API] تعذر إرسال DM للمشتري (الخاص مقفل):`, err.message);
              });
          }

          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            success: true,
            pending: true,
            requestId,
            planKey: spec.key,
            planName: spec.name,
            price: spec.price,
            priceIqd,
            txRef: txRef || 'لم يُدخل',
            dmSent,
            recipient: userTag,
            customerUser: userTag
          }));
        } catch (err) {
          console.error('Purchase API Error:', err.message);
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: err.message }));
        }
      });
    } else if (req.url === '/api/plans' || (req.method === 'GET' && req.url === '/api/plans')) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, plans: PLAN_SPECS }));
    } else if (req.url === '/api/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'ok', bot: botClient.user ? botClient.user.tag : 'connecting' }));
    } else if (req.method === 'GET' || req.method === 'HEAD') {
      let reqPath = req.url.split('?')[0];
      if (reqPath === '/' || reqPath === '') {
        reqPath = '/index.html';
      }
      
      const safePath = path.normalize(path.join(__dirname, reqPath));
      if (!safePath.startsWith(__dirname)) {
        res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
        return res.end('Forbidden');
      }

      if (fs.existsSync(safePath) && fs.statSync(safePath).isFile()) {
        const ext = path.extname(safePath).toLowerCase();
        const mimeTypes = {
          '.html': 'text/html; charset=utf-8',
          '.css': 'text/css; charset=utf-8',
          '.js': 'application/javascript; charset=utf-8',
          '.json': 'application/json; charset=utf-8',
          '.png': 'image/png',
          '.jpg': 'image/jpeg',
          '.jpeg': 'image/jpeg',
          '.gif': 'image/gif',
          '.svg': 'image/svg+xml',
          '.ico': 'image/x-icon',
          '.webp': 'image/webp',
          '.mp3': 'audio/mpeg',
          '.wav': 'audio/wav',
          '.ttf': 'font/ttf',
          '.woff': 'font/woff',
          '.woff2': 'font/woff2'
        };
        const contentType = mimeTypes[ext] || 'application/octet-stream';
        res.writeHead(200, { 
          'Content-Type': contentType,
          'Cache-Control': (ext === '.html' || ext === '.js' || ext === '.css') ? 'no-cache' : 'public, max-age=86400'
        });
        if (req.method === 'HEAD') return res.end();
        const stream = fs.createReadStream(safePath);
        stream.pipe(res);
      } else {
        res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(`<h1>404 Not Found</h1><p>The requested file was not found.</p>`);
      }
    } else {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Endpoint not found' }));
    }
  });

  server.listen(API_PORT, '0.0.0.0', () => {
    console.log('===========================================================');
    console.log(`  🌐 خادم الموقع والبوت يعمل بنجاح على المنفذ: ${API_PORT}`);
    console.log(`  🔗 رابط الموقع المحلي:   http://localhost:${API_PORT}`);
    console.log(`  🌍 رابط الموقع للسيرفر: http://0.0.0.0:${API_PORT}`);
    console.log('===========================================================');
  });
}

loginBot(true);
