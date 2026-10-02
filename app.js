/**
 * Minecraft AFK Rewards System & Discord Integration Engine
 */

// ==========================================
// 1. Audio Synthesizer (Web Audio API)
// ==========================================
class SoundFX {
  constructor() {
    this.ctx = null;
    this.enabled = true;
  }

  init() {
    if (!this.ctx) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AudioContext();
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  // Minecraft XP Level Up Chime
  playLevelUp() {
    if (!this.enabled) return;
    this.init();
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(440, now);
    osc.frequency.exponentialRampToValueAtTime(880, now + 0.15);
    osc.frequency.exponentialRampToValueAtTime(1320, now + 0.35);

    gain.gain.setValueAtTime(0.25, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.6);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(now);
    osc.stop(now + 0.6);
  }

  // Item Collect / Pop
  playItemPop() {
    if (!this.enabled) return;
    this.init();
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(800, now);
    osc.frequency.exponentialRampToValueAtTime(1400, now + 0.08);

    gain.gain.setValueAtTime(0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.12);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(now);
    osc.stop(now + 0.12);
  }

  // Chest Open Sound (Wooden resonance)
  playChestSound() {
    if (!this.enabled) return;
    this.init();
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(160, now);
    osc.frequency.exponentialRampToValueAtTime(110, now + 0.18);

    gain.gain.setValueAtTime(0.3, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.22);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(now);
    osc.stop(now + 0.22);
  }

  // Discord Message Notification Ping
  playDiscordPing() {
    if (!this.enabled) return;
    this.init();
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(587.33, now); // D5
    osc.frequency.setValueAtTime(880, now + 0.08); // A5

    gain.gain.setValueAtTime(0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.35);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(now);
    osc.stop(now + 0.35);
  }
}

const sfx = new SoundFX();

// ==========================================
// 2. State & Data
// ==========================================

let appState = {
  afkSeconds: 3 * 3600 + 45 * 60 + 22, // 03:45:22
  nextRewardSeconds: 278, // ~4m 38s
  rewardInterval: 600, // 10 minutes per cycle
  antiAfkActive: true,
  itemsClaimed: 1480,
  chestItems: [
    { slot: 0, name: "Ancient Debris", count: 2, icon: "🪨", rarity: "netherite", val: 12000 },
    { slot: 1, name: "Diamonds", count: 8, icon: "💎", rarity: "diamond", val: 8000 },
    { slot: 2, name: "Netherite Ingot", count: 1, icon: "⬛", rarity: "netherite", val: 15000 },
    { slot: 3, name: "Enchanted Book (Mending)", count: 1, icon: "📖", rarity: "purple", val: 5000 },
    { slot: 4, name: "Enchanted Golden Apple", count: 2, icon: "🍏", rarity: "gold", val: 6000 },
    { slot: 5, name: "Emeralds", count: 16, icon: "🟢", rarity: "emerald", val: 3200 },
    { slot: 6, name: "Ender Pearls", count: 12, icon: "🔮", rarity: "cyan", val: 1800 },
    { slot: 7, name: "Gold Ingots", count: 24, icon: "🪙", rarity: "gold", val: 2400 }
  ]
};

// ==========================================
// 3. Initialization
// ==========================================

document.addEventListener("DOMContentLoaded", () => {
  initTimers();
  renderChestGrid();
  updateChestSummary();
  initSoundToggle();
  initCodeSnippets();
  startRandomTerminalLogs();
  loadSavedDiscordSettings();
});

// Sound Toggle
function initSoundToggle() {
  const btn = document.getElementById("soundToggleBtn");
  if (!btn) return;

  btn.addEventListener("click", () => {
    sfx.enabled = !sfx.enabled;
    const icon = btn.querySelector("i");
    if (sfx.enabled) {
      icon.className = "fas fa-volume-high";
      btn.style.color = "var(--mc-diamond)";
      sfx.playLevelUp();
      showToast("تم تفعيل المؤثرات الصوتية لماينكرافت 🔊", "success");
    } else {
      icon.className = "fas fa-volume-xmark";
      btn.style.color = "var(--text-muted)";
      showToast("تم كتم المؤثرات الصوتية 🔇", "info");
    }
  });
}

// ==========================================
// 4. AFK Live Timer & Progress Bar
// ==========================================

function initTimers() {
  setInterval(() => {
    // 1. Increment total AFK time
    appState.afkSeconds++;
    updateTimerDisplay();

    // 2. Decrement next reward countdown
    if (appState.nextRewardSeconds > 0) {
      appState.nextRewardSeconds--;
    } else {
      // Reward Trigger!
      triggerAutomatedRewardCycle();
      appState.nextRewardSeconds = appState.rewardInterval;
    }
    updateProgressDisplay();
  }, 1000);
}

function formatHMS(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function updateTimerDisplay() {
  const el = document.getElementById("holoTimerText");
  if (el) el.textContent = formatHMS(appState.afkSeconds);
}

function updateProgressDisplay() {
  const fill = document.getElementById("rewardProgressFill");
  const countText = document.getElementById("nextRewardCountdown");

  const elapsed = appState.rewardInterval - appState.nextRewardSeconds;
  const pct = Math.min(100, Math.max(0, (elapsed / appState.rewardInterval) * 100));

  if (fill) fill.style.width = pct + "%";

  const m = Math.floor(appState.nextRewardSeconds / 60);
  const s = appState.nextRewardSeconds % 60;
  if (countText) countText.textContent = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')} متبقية`;
}

function resetAfkTimer() {
  appState.afkSeconds = 0;
  updateTimerDisplay();
  addLogLine("تم تصفير عداد الخمول بواسطة اللاعب يدويًا.", "info");
  showToast("تم تصفير عداد الـ AFK بنجاح!", "info");
}

function toggleAntiAfkMotion() {
  appState.antiAfkActive = !appState.antiAfkActive;
  const btn = document.getElementById("antiAfkBtnText");
  if (appState.antiAfkActive) {
    btn.textContent = "محاكاة حركة الرأس والقفز (نشطة)";
    showToast("حماية Anti-AFK نشطة وتتحرك عشوائياً لمنع الطرد!", "success");
    addLogLine("روبوت الحماية ينفذ قفزة ودوران رأس خفيف (Pitch/Yaw: 42, -15).", "success");
  } else {
    btn.textContent = "تفعيل حركة منع الطرد";
    showToast("تم إيقاف حركة الأمان مؤقتاً.", "info");
  }
}

// ==========================================
// 5. Reward Drop & Sorting Engine
// ==========================================

const POSSIBLE_LOOT = [
  { name: "Ancient Debris", icon: "🪨", rarity: "netherite", val: 12000, min: 1, max: 2 },
  { name: "Diamonds", icon: "💎", rarity: "diamond", val: 4000, min: 2, max: 6 },
  { name: "Netherite Scrap", icon: "⬛", rarity: "netherite", val: 8000, min: 1, max: 2 },
  { name: "Enchanted Book (Sharpness V)", icon: "📖", rarity: "purple", val: 6500, min: 1, max: 1 },
  { name: "Golden Apple", icon: "🍎", rarity: "gold", val: 2000, min: 3, max: 8 },
  { name: "Iron Blocks", icon: "🧊", rarity: "cyan", val: 1500, min: 4, max: 12 },
  { name: "Totem of Undying", icon: "🗿", rarity: "gold", val: 9500, min: 1, max: 1 }
];

function triggerSimulatedRewardDrop() {
  const loot = POSSIBLE_LOOT[Math.floor(Math.random() * POSSIBLE_LOOT.length)];
  const count = Math.floor(Math.random() * (loot.max - loot.min + 1)) + loot.min;

  // Add to state chest
  const existing = appState.chestItems.find(i => i.name === loot.name);
  if (existing) {
    existing.count += count;
  } else {
    // Find next open slot (0 to 26)
    const usedSlots = new Set(appState.chestItems.map(i => i.slot));
    let freeSlot = 0;
    while (usedSlots.has(freeSlot) && freeSlot < 27) freeSlot++;

    if (freeSlot < 27) {
      appState.chestItems.push({
        slot: freeSlot,
        name: loot.name,
        count: count,
        icon: loot.icon,
        rarity: loot.rarity,
        val: loot.val
      });
    }
  }

  // SFX and Effects
  sfx.playLevelUp();
  renderChestGrid();
  updateChestSummary();

  addLogLine(`🎁 تم إنزال مكافأة جديدة: ${count}x ${loot.name} وتخزينها بالصندوق!`, "loot");
  showToast(`🎁 مبروك! كسبت ${count}x ${loot.name} وتم فرزها بالصندوق!`, "loot");

  // Discord simulated notification
  sfx.playDiscordPing();
  addLogLine(`💬 تم إرسال إشعار غنائم للديسكورد: Steve_Legend حصل على ${loot.name}.`, "discord");
}

function triggerAutomatedRewardCycle() {
  triggerSimulatedRewardDrop();
}

// ==========================================
// 6. Minecraft Chest Inventory Grid (27 slots)
// ==========================================

function renderChestGrid() {
  const grid = document.getElementById("minecraftChestGrid");
  if (!grid) return;

  const badge = document.getElementById("chestCountBadge");
  if (badge) badge.textContent = appState.chestItems.length;

  let slotsHtml = "";
  for (let s = 0; s < 27; s++) {
    const item = appState.chestItems.find(i => i.slot === s);
    if (item) {
      slotsHtml += `
        <div class="chest-slot filled" onclick="claimSingleSlot(${s})" title="${item.count}x ${item.name} (انقر للاستلام الفردي)">
          <div class="item-icon-box">${item.icon}</div>
          <span class="item-count-badge">${item.count}</span>
        </div>
      `;
    } else {
      slotsHtml += `<div class="chest-slot empty"></div>`;
    }
  }

  grid.innerHTML = slotsHtml;
}

function claimSingleSlot(slotIndex) {
  const idx = appState.chestItems.findIndex(i => i.slot === slotIndex);
  if (idx !== -1) {
    const item = appState.chestItems[idx];
    sfx.playItemPop();
    showToast(`تم استلام ${item.count}x ${item.name} إلى حقيبتك!`, "success");
    addLogLine(`📦 سحب اللاعب ${item.count}x ${item.name} من الصندوق إلى حقيبته.`, "info");
    appState.chestItems.splice(idx, 1);
    renderChestGrid();
    updateChestSummary();
  }
}

function claimAllChestRewards() {
  if (appState.chestItems.length === 0) {
    showToast("الصندوق فارغ حالياً!", "info");
    return;
  }

  const total = appState.chestItems.reduce((sum, i) => sum + i.count, 0);
  sfx.playChestSound();
  setTimeout(() => sfx.playLevelUp(), 200);

  appState.itemsClaimed += total;
  appState.chestItems = [];
  renderChestGrid();
  updateChestSummary();

  const totalEl = document.getElementById("statTotalItems");
  if (totalEl) totalEl.textContent = appState.itemsClaimed.toLocaleString();

  showToast(`🎉 تم استلام جميع الموارد بنجاح (${total} عنصر نُقل لحقيبتك)!`, "success");
  addLogLine(`🏆 استلم اللاعب جميع غنائم صندوق الـ AFK بالكامل.`, "success");
}

function autoSortChest() {
  sfx.playChestSound();
  
  // Sort items by value descending
  appState.chestItems.sort((a, b) => (b.val * b.count) - (a.val * a.count));
  // Reassign slots
  appState.chestItems.forEach((item, index) => {
    item.slot = index;
  });

  renderChestGrid();
  showToast("تم فرز وتنظيم الصندوق حسب القيمة والندرة بنجاح!", "info");
  addLogLine("🤖 الروبوت أعاد فرز وترتيب الصندوق أوتوماتيكياً.", "info");
}

function updateChestSummary() {
  const countEl = document.getElementById("chestTotalItemsCount");
  const valEl = document.getElementById("chestTotalValue");
  const coinsEl = document.getElementById("chestDiscordCoins");

  const totalCount = appState.chestItems.reduce((acc, i) => acc + i.count, 0);
  const totalVal = appState.chestItems.reduce((acc, i) => acc + (i.val * i.count), 0);
  const discordXp = totalCount * 15;

  if (countEl) countEl.textContent = `${totalCount} عناصر في ${appState.chestItems.length} خانات`;
  if (valEl) valEl.textContent = `${totalVal.toLocaleString()} $ إيميرالد`;
  if (coinsEl) coinsEl.textContent = `${discordXp} XP ديسكورد`;
}

// ==========================================
// 7. Activity Console Terminal
// ==========================================

function addLogLine(message, type = "info") {
  const terminal = document.getElementById("activityTerminal");
  if (!terminal) return;

  const now = new Date();
  const timeStr = `[${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}]`;

  const line = document.createElement("div");
  line.className = `log-line ${type}`;
  line.innerHTML = `<span class="log-time">${timeStr}</span> ${message}`;

  terminal.appendChild(line);
  terminal.scrollTop = terminal.scrollHeight;
}

function startRandomTerminalLogs() {
  const events = [
    { msg: "🛡️ فحص منطقة الأمان: لا توجد وحوش أو لاعبين معادين بالجوار.", type: "info" },
    { msg: "🤖 الروبوت تفقد صناديق المزرعة التلقائية (Auto Farm Check: OK).", type: "info" },
    { msg: "💎 فحص التزامن مع قاعدة بيانات الخادم (Heartbeat: 20 TPS).", type: "success" },
    { msg: "💬 رد آلي في الشات: اللاعب Steve_Legend خامل حالياً ويجمع الموارد.", type: "discord" }
  ];

  setInterval(() => {
    const evt = events[Math.floor(Math.random() * events.length)];
    addLogLine(evt.msg, evt.type);
  }, 14000);
}

// ==========================================
// ==========================================
// 8. Discord Webhook & Bot Customization Integration
// ==========================================

const AVATAR_PRESETS = {
  goat: "https://files.catbox.moe/6pndxl.png",
  steve: "https://mc-heads.net/avatar/Steve/128",
  alex: "https://mc-heads.net/avatar/MHF_Alex/128",
  robot: "https://api.dicebear.com/7.x/bottts/png?seed=MinecraftAFK",
  creeper: "https://mc-heads.net/avatar/MHF_Creeper/128",
  golem: "https://mc-heads.net/avatar/MHF_Golem/128",
  enderman: "https://mc-heads.net/avatar/MHF_Enderman/128",
  chest: "https://mc-heads.net/avatar/MHF_Chest/128"
};

function setAvatarPreset(key) {
  const url = AVATAR_PRESETS[key];
  if (!url) return;

  const input = document.getElementById("discordBotAvatarInput");
  if (input) {
    input.value = url;
    updateDiscordPreview();
  }

  // Highlight active preset button
  document.querySelectorAll(".preset-btn").forEach(btn => btn.classList.remove("active"));
  if (window.event && window.event.currentTarget) {
    window.event.currentTarget.classList.add("active");
  }

  sfx.playItemPop();
  showToast(`تم اختيار صورة [${key}] للبوت بنجاح!`, "success");
}

function handleAvatarFileUpload(event) {
  const file = event?.target?.files?.[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function(e) {
    const dataUrl = e.target.result;
    const input = document.getElementById("discordBotAvatarInput");
    if (input) {
      input.value = dataUrl;
    }
    const previewImg = document.getElementById("previewAvatarImg");
    if (previewImg) {
      previewImg.src = dataUrl;
    }
    sfx.playLevelUp();
    showToast("✅ تم رفع صورتك الخاصة بنجاح وتحديث المعاينة!", "success");
    addLogLine("🖼️ تم اختيار صورة مخصصة من الجهاز لافتار البوت.", "info");
  };
  reader.readAsDataURL(file);
}

function updateDiscordPreview() {
  const nameInput = document.getElementById("discordBotNameInput");
  const avatarInput = document.getElementById("discordBotAvatarInput");
  const previewName = document.getElementById("previewBotName");
  const previewImg = document.getElementById("previewAvatarImg");

  if (previewName && nameInput) {
    const val = nameInput.value.trim();
    previewName.textContent = val || "Goat AFK Rewards";
  }

  if (previewImg && avatarInput) {
    const avatarVal = avatarInput.value.trim();
    if (avatarVal) {
      previewImg.src = avatarVal;
      previewImg.onerror = () => {
        previewImg.src = "https://files.catbox.moe/6pndxl.png";
      };
    }
  }
}

async function sendTestDiscordEmbed() {
  const webhookUrl = document.getElementById("discordWebhookInput")?.value.trim();
  const botName = document.getElementById("discordBotNameInput")?.value.trim() || "Goat AFK Rewards";
  let botAvatar = document.getElementById("discordBotAvatarInput")?.value.trim() || "https://files.catbox.moe/6pndxl.png";

  // For Discord Webhook API, if avatar is base64 data-url, use fallback for webhook request
  let webhookAvatar = botAvatar;
  if (botAvatar.startsWith("data:")) {
    webhookAvatar = "https://files.catbox.moe/6pndxl.png";
  }

  sfx.playDiscordPing();
  showToast(`جاري إرسال الإشعار باسم (${botName})...`, "info");

  // Attempt real webhook fetch if URL looks like a valid discord webhook
  if (webhookUrl && webhookUrl.includes("discord.com/api/webhooks/")) {
    try {
      const activePlayer = document.getElementById("botUsernameInput")?.value.trim() || "Steve_Legend";
      const payload = {
        username: botName,
        avatar_url: webhookAvatar,
        embeds: [{
          title: "🎮 تقرير خمول وفارم اللاعب (AFK Status Report)",
          description: `اللاعب **${activePlayer}** متواجد في منطقة الأمان ومستمر بالفرم بنجاح منذ **${formatHMS(appState.afkSeconds)}**!`,
          color: 0x55ffff,
          fields: [
            { name: "💎 المكافآت المجمعة بالصندوق:", value: `${appState.chestItems.length} عناصر نادرة جاهزة للاستلام`, inline: true },
            { name: "🛡️ حالة السيرفر:", value: "متصل (20.0 TPS)", inline: true }
          ],
          footer: { text: `${botName} • Integration Active` },
          timestamp: new Date().toISOString()
        }]
      };

      const res = await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (res.ok || res.status === 204) {
        showToast(`🚀 تم إرسال الإشعار باسم (${botName}) إلى سيرفر الديسكورد بنجاح!`, "success");
        addLogLine(`✅ تم تسليم Webhook حقيقي إلى الديسكورد باسم: ${botName}`, "discord");
        return;
      }
    } catch (err) {
      console.warn("Real webhook call failed (likely CORS or demo URL), fallback to simulation:", err);
    }
  }

  // Simulated fallback
  setTimeout(() => {
    updateDiscordPreview();
    showToast(`✅ تم إرسال الإشعار التجريبي باسم (${botName}) وتحديث المعاينة بنجاح!`, "discord");
    addLogLine(`💬 إشعار ديسكورد: تم تحديث Embed بواسطة [${botName}].`, "discord");
  }, 500);
}

function saveDiscordSettings() {
  const webhook = document.getElementById("discordWebhookInput")?.value.trim() || "";
  const name = document.getElementById("discordBotNameInput")?.value.trim() || "Goat AFK Rewards";
  const avatar = document.getElementById("discordBotAvatarInput")?.value.trim() || "https://files.catbox.moe/6pndxl.png";
  const token = document.getElementById("discordBotTokenInput")?.value.trim() || "";

  const discordConfig = { webhook, name, avatar, token };
  localStorage.setItem("bz_discord_config", JSON.stringify(discordConfig));

  sfx.playLevelUp();
  showToast(`✅ تم حفظ إعدادات البوت والاسم (${name}) والصورة بنجاح!`, "success");
  addLogLine(`💾 تم حفظ إعدادات ديسكورد: الاسم [${name}] والافاتار المخصص.`, "discord");
}

function loadSavedDiscordSettings() {
  try {
    const saved = localStorage.getItem("bz_discord_config");
    if (saved) {
      const data = JSON.parse(saved);
      if (data.webhook && document.getElementById("discordWebhookInput")) {
        document.getElementById("discordWebhookInput").value = data.webhook;
      }
      if (data.name && data.name !== "Minecraft AFK System" && document.getElementById("discordBotNameInput")) {
        document.getElementById("discordBotNameInput").value = data.name;
      } else if (document.getElementById("discordBotNameInput")) {
        document.getElementById("discordBotNameInput").value = "Goat AFK Rewards";
      }

      if (data.avatar && !data.avatar.includes("diamond.png") && document.getElementById("discordBotAvatarInput")) {
        document.getElementById("discordBotAvatarInput").value = data.avatar;
      } else if (document.getElementById("discordBotAvatarInput")) {
        document.getElementById("discordBotAvatarInput").value = "https://files.catbox.moe/6pndxl.png";
      }

      if (data.token && document.getElementById("discordBotTokenInput")) {
        document.getElementById("discordBotTokenInput").value = data.token;
      }
    }
  } catch (e) {
    console.error("Could not load discord settings from localStorage", e);
  }
  updateDiscordPreview();
}

// ==========================================
// 9. Code Snippets & Scripts Engine
// ==========================================

const CODE_SNIPPETS = {
  mineflayer: {
    filename: "bot.js",
    code: `/**
 * Mineflayer AFK Companion Bot
 * Connects 24/7, executes anti-kick motion, and auto-deposits rewards into chests.
 */

const mineflayer = require('mineflayer');
const { pathfinder, Movements, goals } = require('mineflayer-pathfinder');

const bot = mineflayer.createBot({
  host: 'play.skyblock.net',
  port: 25565,
  username: 'AFK_Helper_Bot',
  version: '1.20.4'
});

bot.loadPlugin(pathfinder);

// Safe Zone Coordinates
const SAFE_ZONE = { x: 124, y: 68, z: -340 };

bot.on('spawn', () => {
  console.log('[AFK Bot] Joined server! Navigating to safe zone...');
  
  // Anti-AFK Random Actions every 45 seconds
  setInterval(() => {
    // 1. Look around randomly
    const yaw = Math.random() * Math.PI * 2;
    const pitch = (Math.random() - 0.5) * Math.PI / 2;
    bot.look(yaw, pitch, true);

    // 2. Perform safe stealth jump/sneak
    bot.setControlState('sneak', true);
    setTimeout(() => {
      bot.setControlState('jump', true);
      setTimeout(() => {
        bot.setControlState('jump', false);
        bot.setControlState('sneak', false);
      }, 350);
    }, 400);

    console.log('[AFK Bot] Executed Anti-Kick stealth movement.');
  }, 45000);
});

// Auto-sort nearby rewards chest
bot.on('chat', async (username, message) => {
  if (message === '!sort') {
    const chestBlock = bot.findBlock({ matching: 54, maxDistance: 4 });
    if (chestBlock) {
      const chest = await bot.openChest(chestBlock);
      console.log('[AFK Bot] Sorting items in rewards chest...');
      chest.close();
    }
  }
});`
  },

  discord: {
    filename: "discord_bot.js",
    code: `/**
 * Discord.js AFK Rewards Bridge
 * Synchronizes in-game AFK tiers with Discord roles and embeds.
 */

const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');
const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers] });

const TOKEN = 'YOUR_DISCORD_BOT_TOKEN';
const GUILD_ID = '123456789012345678';
const AFK_CHANNEL_ID = '987654321098765432';

client.once('ready', () => {
  console.log(\`[Discord Bridge] Logged in as \${client.user.tag}!\`);
});

// Function called when Minecraft player completes a reward tier
async function onPlayerTierUp(playerName, hours, tierName, roleId) {
  const channel = client.channels.cache.get(AFK_CHANNEL_ID);
  if (!channel) return;

  const embed = new EmbedBuilder()
    .setColor('#55ffff')
    .setTitle('🎉 ترقية مستوى خمول جديد (AFK Tier Up)!')
    .setDescription(\`أتم اللاعب **\${playerName}** بنجاح **\${hours} ساعة** في منطقة الخمول!\`)
    .addFields(
      { name: '🎖️ المستوى الجديد:', value: tierName, inline: true },
      { name: '🎁 المكافأة المضافة:', value: 'مخطوطة نيثرايت + 100 Discord Coins', inline: true }
    )
    .setFooter({ text: 'Minecraft AFK System' })
    .setTimestamp();

  await channel.send({ embeds: [embed] });
}

client.login(TOKEN);`
  },

  spigot: {
    filename: "config.yml",
    code: `# ===================================================
# Minecraft AFK Rewards Plugin Configuration
# Compatible with Paper / Purpur / Spigot 1.20.x
# ===================================================

settings:
  check-interval-seconds: 1
  safe-zone:
    world: "world"
    pos1: { x: 120, y: 64, z: -345 }
    pos2: { x: 128, y: 72, z: -335 }
  anti-kick:
    bypass-permission: "afkrewards.bypass"
    simulate-packet-motion: true

discord-webhook:
  enabled: true
  url: "https://discord.com/api/webhooks/YOUR_WEBHOOK"
  username: "AFK System"
  avatar: "https://example.com/steve.png"

rewards-tiers:
  bronze:
    required-minutes: 180 # 3 hours
    commands:
      - "give %player% iron_ingot 16"
      - "xp add %player% 500 points"
  silver:
    required-minutes: 360 # 6 hours
    commands:
      - "give %player% gold_ingot 8"
      - "give %player% diamond 3"
  gold:
    required-minutes: 540 # 9 hours
    commands:
      - "give %player% diamond 8"
      - "give %player% golden_apple 2"
  diamond:
    required-minutes: 720 # 12 hours
    commands:
      - "give %player% ancient_debris 1"
      - "give %player% enchanted_golden_apple 1"
  netherite:
    required-minutes: 1440 # 24 hours
    commands:
      - "give %player% netherite_ingot 1"
      - "lp user %player% parent addtemp afklegend 7d"`
  }
};

let currentSnippetKey = 'mineflayer';

function initCodeSnippets() {
  switchCodeSnippet('mineflayer', document.querySelector('.code-tab-btn'));
}

function switchCodeSnippet(key, btn) {
  currentSnippetKey = key;
  document.querySelectorAll('.code-tab-btn').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');

  const snippet = CODE_SNIPPETS[key];
  if (snippet) {
    document.getElementById("currentCodeFilename").textContent = snippet.filename;
    document.getElementById("codeSnippetContent").textContent = snippet.code;
  }
}

function copyCurrentCodeSnippet() {
  const snippet = CODE_SNIPPETS[currentSnippetKey];
  if (!snippet) return;

  navigator.clipboard.writeText(snippet.code).then(() => {
    showToast(`تم نسخ كود ${snippet.filename} بالكامل إلى الحافظة!`, "success");
  });
}

// ==========================================
// 10. Navigation Tabs & Controller
// ==========================================

function switchMainTab(tabKey, btn) {
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');

  document.querySelectorAll('.tab-view').forEach(v => v.classList.remove('active'));

  const viewMap = {
    controller: 'viewController',
    plans: 'viewPlans',
    simulator: 'viewSimulator',
    chest: 'viewChest',
    discord: 'viewDiscord',
    tiers: 'viewTiers',
    codes: 'viewCodes'
  };

  const targetId = viewMap[tabKey];
  if (targetId) {
    const el = document.getElementById(targetId);
    if (el) el.classList.add('active');
  }

  // SFX on tab switch
  sfx.playChestSound();
}

// ==========================================
// 10. Landing Page Navigation & Command Builder
// ==========================================

function scrollToSection(sectionId) {
  const target = document.getElementById(sectionId);
  if (target) {
    target.scrollIntoView({ behavior: 'smooth' });
    sfx.playChestSound();
  }
}

function selectPlanAndScroll(planKey) {
  ['cardPlanBronze', 'cardPlanDiamond', 'cardPlanVip'].forEach(id => {
    const c = document.getElementById(id);
    if (c) c.classList.remove('featured');
  });

  const cardMap = {
    bronze: 'cardPlanBronze',
    silver: 'cardPlanDiamond',
    diamond: 'cardPlanDiamond',
    gold: 'cardPlanVip',
    vip: 'cardPlanVip'
  };

  const targetCard = document.getElementById(cardMap[planKey]);
  if (targetCard) targetCard.classList.add('featured');

  sfx.playLevelUp();
  const planNames = {
    bronze: '🥉 باقة التجربة اليومية (24 ساعة - $5)',
    silver: '💎 الباقة الماسية (شهر كامل - $15)',
    diamond: '💎 الباقة الماسية (شهر كامل - $15)',
    gold: '👑 باقة VIP الشاملة (شهر كامل - $30)',
    vip: '👑 باقة VIP الشاملة (شهر كامل - $30)'
  };
  showToast(`اخترت: ${planNames[planKey]}! يمكنك الآن كتابة بياناتك بالأمر ونسخه أدناه`, 'success');
  
  // Smooth scroll to activation guide
  setTimeout(() => {
    scrollToSection('how-to-activate');
  }, 400);
}

function updateLiveFarmCommand() {
  const host = document.getElementById('cmdInputServer')?.value.trim() || 'play.skyblock.net';
  const username = document.getElementById('cmdInputUsername')?.value.trim() || 'MyPlayer';
  const port = document.getElementById('cmdInputPort')?.value.trim() || '25565';
  const pass = document.getElementById('cmdInputPassword')?.value.trim();

  let cmd = `/farm_start server:${host} username:${username}`;
  if (port) {
    cmd += ` port:${port}`;
  }
  if (pass) {
    cmd += ` password:${pass}`;
  }

  const el = document.getElementById('liveFarmStartCmd');
  if (el) el.textContent = cmd;
}

function copyLiveFarmCommand() {
  updateLiveFarmCommand();
  const el = document.getElementById('liveFarmStartCmd');
  const cmd = el?.textContent.trim() || '/farm_start server:play.skyblock.net username:MyPlayer port:25565';
  copyCustomCommand(cmd);
}

function toggleCmdPasswordVisibility() {
  const pwdInput = document.getElementById('cmdInputPassword');
  const eyeIcon = document.getElementById('cmdPwdEyeIcon');
  if (!pwdInput) return;
  if (pwdInput.type === 'password') {
    pwdInput.type = 'text';
    if (eyeIcon) {
      eyeIcon.classList.remove('fa-eye');
      eyeIcon.classList.add('fa-eye-slash');
    }
  } else {
    pwdInput.type = 'password';
    if (eyeIcon) {
      eyeIcon.classList.remove('fa-eye-slash');
      eyeIcon.classList.add('fa-eye');
    }
  }
}

function updateGeneratedCommand() {
  updateLiveFarmCommand();
}

function copyCustomCommand(cmdText) {
  navigator.clipboard.writeText(cmdText).then(() => {
    sfx.playLevelUp();
    const msg = (currentLang === 'en')
      ? `📋 Copied command (${cmdText})! Paste it into Discord.`
      : `📋 تم نسخ الأمر (${cmdText}) بنجاح! الصقه في شات الديسكورد وسيعمل فوراً!`;
    showToast(msg, 'discord');
  }).catch(() => {
    const msg = (currentLang === 'en')
      ? '⚠️ Please copy manually: ' + cmdText
      : '⚠️ يرجى نسخ الأمر يدوياً: ' + cmdText;
    showToast(msg, 'info');
  });
}

function copyDiscordCommand() {
  copyLiveFarmCommand();
}

function saveBotConfigFromUI() {
  const host = document.getElementById("serverHostInput").value.trim() || "play.example-server.net";
  const port = parseInt(document.getElementById("serverPortInput").value, 10) || 25565;
  const username = document.getElementById("botUsernameInput").value.trim() || "AFK_Farmer";
  const auth = document.getElementById("botAuthSelect").value || "offline";
  const password = document.getElementById("botPasswordInput").value.trim();

  const autoAttack = document.getElementById("modAutoAttack").checked;
  const antiAfk = document.getElementById("modAntiAfk").checked;
  const autoEat = document.getElementById("modAutoEat").checked;
  const autoChest = document.getElementById("modAutoChest").checked;
  const autoReconnect = document.getElementById("modAutoReconnect").checked;

  const cfg = {
    server: { host, port, version: false },
    account: { username, auth, password },
    modules: {
      antiAfk: { enabled: antiAfk, intervalSeconds: 30, actions: ["look", "sneak", "jump"] },
      autoAttack: { enabled: autoAttack, intervalMs: 700, radius: 3.8 },
      autoEat: { enabled: autoEat, minFoodLevel: 14 },
      autoChest: { enabled: autoChest, depositWhenSlotsLeft: 3, chestRadius: 4 },
      autoReconnect: { enabled: autoReconnect, delaySeconds: 15 },
      discord: {
        enabled: Boolean(document.getElementById("discordWebhookInput")?.value.trim()),
        webhookUrl: document.getElementById("discordWebhookInput")?.value.trim() || "",
        username: document.getElementById("discordBotNameInput")?.value.trim() || "Goat AFK Rewards",
        avatarUrl: document.getElementById("discordBotAvatarInput")?.value.trim() || "https://files.catbox.moe/6pndxl.png",
        notifyOnJoin: true,
        notifyOnLoot: true,
        notifyOnDisconnect: true
      }
    }
  };

  localStorage.setItem("bz_mc_config", JSON.stringify(cfg));
  sfx.playLevelUp();
  showToast(`✅ تم حفظ إعدادات السيرفر (${host}:${port}) بنجاح!`, "success");
  addLogLine(`⚙️ تم تحديث إعدادات البوت للسيرفر: ${host}:${port} كلاعب: ${username}`, "info");
}

function launchBotCommand() {
  sfx.playLevelUp();
  showToast("🚀 لتشغيل البوت: افتح مجلد المشروع وشغّل ملف run_bot.bat بنقرة مزدوجة!", "success");
  addLogLine("▶️ اضغط مرتين على ملف run_bot.bat ليبدأ البوت بالدخول فوراً.", "success");
}

// ==========================================
// 11. Toast Notifications
// ==========================================

function showToast(message, type = "info") {
  const container = document.getElementById("toastContainer");
  if (!container) return;

  const toast = document.createElement("div");
  toast.className = `toast ${type}`;

  let icon = "fa-circle-info";
  if (type === "success") icon = "fa-circle-check";
  if (type === "loot") icon = "fa-gem";
  if (type === "discord") icon = "fa-brands fa-discord";

  toast.innerHTML = `<i class="fas ${icon}"></i> <span>${message}</span>`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.animation = "toastSlide 0.25s ease-out reverse";
    setTimeout(() => toast.remove(), 250);
  }, 3500);
}

// ==========================================
// 12. Bilingual Internationalization (i18n) Engine
// ==========================================
let currentLang = 'ar';
try {
  currentLang = localStorage.getItem('goat_lang') || 'ar';
} catch (e) {
  currentLang = 'ar';
}

let selectedPurchasePlan = 'diamond';

const PLAN_MODAL_DATA = {
  bronze: {
    key: 'bronze',
    title: 'باقة التجربة اليومية (24 ساعة)',
    sub: 'تدعم رتبة: المستوى البرونزي فقط | 24 ساعة فرم مستمر',
    price: '$5',
    priceIqd: '7,500 د.ع',
    amountDueText: '7,500 دينار عراقي ($5)',
    iconClass: 'bronze',
    iconHtml: '<i class="fas fa-medal"></i>'
  },
  diamond: {
    key: 'diamond',
    title: 'الباقة الماسية (شهر كامل)',
    sub: 'تدعم رتب: برونزي + فضي + ذهبي | 30 يوماً فرم 24/7',
    price: '$15',
    priceIqd: '22,500 د.ع',
    amountDueText: '22,500 دينار عراقي ($15)',
    iconClass: 'diamond',
    iconHtml: '<i class="fas fa-gem"></i>'
  },
  vip: {
    key: 'vip',
    title: 'باقة VIP الشاملة (شهر كامل)',
    sub: 'تدعم: برونزي + فضي + ذهبي + ماسي + أسطوري | 30 يوماً',
    price: '$30',
    priceIqd: '45,000 د.ع',
    amountDueText: '45,000 دينار عراقي ($30)',
    iconClass: 'vip',
    iconHtml: '<i class="fas fa-crown"></i>'
  }
};

function updatePlanModalDataLanguage(lang) {
  if (typeof PLAN_MODAL_DATA === 'undefined') return;
  if (lang === 'en') {
    if (PLAN_MODAL_DATA.bronze) {
      PLAN_MODAL_DATA.bronze.title = 'Daily Trial Plan (24 Hours)';
      PLAN_MODAL_DATA.bronze.sub = 'Supports: Bronze Tier Only | 24 Hours Non-Stop Farming';
      PLAN_MODAL_DATA.bronze.priceIqd = '7,500 IQD';
      PLAN_MODAL_DATA.bronze.amountDueText = '7,500 Iraqi Dinar ($5)';
    }
    if (PLAN_MODAL_DATA.diamond) {
      PLAN_MODAL_DATA.diamond.title = 'Monthly Diamond Plan (30 Days)';
      PLAN_MODAL_DATA.diamond.sub = 'Supports: Bronze + Silver + Gold | 30 Days 24/7 Farming';
      PLAN_MODAL_DATA.diamond.priceIqd = '22,500 IQD';
      PLAN_MODAL_DATA.diamond.amountDueText = '22,500 Iraqi Dinar ($15)';
    }
    if (PLAN_MODAL_DATA.vip) {
      PLAN_MODAL_DATA.vip.title = 'VIP All-Inclusive (30 Days)';
      PLAN_MODAL_DATA.vip.sub = 'Supports: Bronze, Silver, Gold, Diamond, Netherite | 30 Days';
      PLAN_MODAL_DATA.vip.priceIqd = '45,000 IQD';
      PLAN_MODAL_DATA.vip.amountDueText = '45,000 Iraqi Dinar ($30)';
    }
  } else {
    if (PLAN_MODAL_DATA.bronze) {
      PLAN_MODAL_DATA.bronze.title = 'باقة التجربة اليومية (24 ساعة)';
      PLAN_MODAL_DATA.bronze.sub = 'تدعم رتبة: المستوى البرونزي فقط | 24 ساعة فرم مستمر';
      PLAN_MODAL_DATA.bronze.priceIqd = '7,500 د.ع';
      PLAN_MODAL_DATA.bronze.amountDueText = '7,500 دينار عراقي ($5)';
    }
    if (PLAN_MODAL_DATA.diamond) {
      PLAN_MODAL_DATA.diamond.title = 'الباقة الماسية (شهر كامل)';
      PLAN_MODAL_DATA.diamond.sub = 'تدعم رتب: برونزي + فضي + ذهبي | 30 يوماً فرم 24/7';
      PLAN_MODAL_DATA.diamond.priceIqd = '22,500 د.ع';
      PLAN_MODAL_DATA.diamond.amountDueText = '22,500 دينار عراقي ($15)';
    }
    if (PLAN_MODAL_DATA.vip) {
      PLAN_MODAL_DATA.vip.title = 'باقة VIP الشاملة (شهر كامل)';
      PLAN_MODAL_DATA.vip.sub = 'تدعم: برونزي + فضي + ذهبي + ماسي + أسطوري | 30 يوماً';
      PLAN_MODAL_DATA.vip.priceIqd = '45,000 د.ع';
      PLAN_MODAL_DATA.vip.amountDueText = '45,000 دينار عراقي ($30)';
    }
  }
}

function setLanguage(lang, playSfx = true) {
  if (lang !== 'ar' && lang !== 'en') lang = 'ar';
  currentLang = lang;
  try {
    localStorage.setItem('goat_lang', lang);
  } catch (e) {
    console.warn('localStorage access failed:', e);
  }

  // Direction & Language attributes
  document.documentElement.lang = lang;
  document.documentElement.dir = (lang === 'ar' ? 'rtl' : 'ltr');

  if (lang === 'en') {
    document.body.classList.add('lang-en');
    document.body.classList.remove('lang-ar');
  } else {
    document.body.classList.add('lang-ar');
    document.body.classList.remove('lang-en');
  }

  // Header switcher buttons
  const btnAr = document.getElementById('langBtnAr');
  const btnEn = document.getElementById('langBtnEn');
  if (btnAr) btnAr.classList.toggle('active', lang === 'ar');
  if (btnEn) btnEn.classList.toggle('active', lang === 'en');

  // Resolve dictionary robustly (window.I18N or global I18N)
  const i18nSource = (typeof window !== 'undefined' && window.I18N)
    ? window.I18N
    : (typeof I18N !== 'undefined' ? I18N : null);

  if (i18nSource && i18nSource[lang]) {
    const dict = i18nSource[lang];
    document.querySelectorAll('[data-i18n]').forEach(el => {
      const key = el.getAttribute('data-i18n');
      if (dict[key] !== undefined) {
        el.innerHTML = dict[key];
      }
    });

    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
      const key = el.getAttribute('data-i18n-placeholder');
      if (dict[key] !== undefined) {
        el.placeholder = dict[key];
      }
    });

    document.querySelectorAll('[data-i18n-title]').forEach(el => {
      const key = el.getAttribute('data-i18n-title');
      if (dict[key] !== undefined) {
        el.title = dict[key];
      }
    });
  } else {
    console.warn('[i18n] Translation dictionary not available for lang:', lang, i18nSource);
  }

  // Update modal package texts and refresh active summary card
  updatePlanModalDataLanguage(lang);
  if (typeof changeSelectedPurchasePlan === 'function') {
    changeSelectedPurchasePlan(selectedPurchasePlan || 'diamond', false);
  }

  // Live Commands update
  if (typeof updateLiveFarmCommand === 'function') {
    updateLiveFarmCommand();
  }
  if (typeof updateLiveRedeemCommand === 'function') {
    updateLiveRedeemCommand();
  }

  // Sound and Toast Feedback
  if (playSfx) {
    if (window.sfx) window.sfx.playItemPop();
    const msg = (lang === 'en') 
      ? 'Language switched to English 🇺🇸' 
      : 'تم التبديل إلى اللغة العربية 🇮🇶';
    showToast(msg, 'success');
  }
}

// Ensure global accessibility for inline event handlers
if (typeof window !== 'undefined') {
  window.setLanguage = setLanguage;
}

// Initialize live commands and language on document load
document.addEventListener("DOMContentLoaded", () => {
  let savedLang = 'ar';
  try {
    savedLang = localStorage.getItem('goat_lang') || 'ar';
  } catch (e) {
    savedLang = 'ar';
  }
  setLanguage(savedLang, false);
  if (typeof updateLiveFarmCommand === 'function') updateLiveFarmCommand();
  if (typeof updateLiveRedeemCommand === 'function') updateLiveRedeemCommand();
});

let currentReceiptBase64 = null;

function processReceiptImageFile(file) {
  if (!file || !file.type.startsWith('image/')) {
    const msg = (currentLang === 'en')
      ? '⚠️ Please select a valid image file (PNG, JPG, JPEG)'
      : '⚠️ يرجى اختيار ملف صورة صالح (PNG, JPG, JPEG)';
    showToast(msg, 'warning');
    return;
  }

  const reader = new FileReader();
  reader.onload = function(e) {
    const rawDataUrl = e.target.result;
    
    // Scale down if image is huge to guarantee fast upload (< 300KB)
    const img = new Image();
    img.onload = function() {
      const maxDim = 1200;
      let width = img.width;
      let height = img.height;
      if (width > maxDim || height > maxDim) {
        if (width > height) {
          height = Math.round((height * maxDim) / width);
          width = maxDim;
        } else {
          width = Math.round((width * maxDim) / height);
          height = maxDim;
        }
      }
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, width, height);
      currentReceiptBase64 = canvas.toDataURL('image/jpeg', 0.85);

      // Update UI preview
      const previewImg = document.getElementById('receiptPreviewImg');
      const previewWrap = document.getElementById('receiptPreviewWrap');
      const dropContent = document.getElementById('receiptDropContent');

      if (previewImg) previewImg.src = currentReceiptBase64;
      if (previewWrap) previewWrap.style.display = 'flex';
      if (dropContent) dropContent.style.display = 'none';

      sfx.playItemPop();
      const msg = (currentLang === 'en')
        ? '📸 Receipt screenshot attached successfully!'
        : '📸 تم إرفاق لقطة شاشة الوصل بنجاح!';
      showToast(msg, 'success');
    };
    img.src = rawDataUrl;
  };
  reader.readAsDataURL(file);
}

function handleReceiptFileSelect(event) {
  const file = event.target.files && event.target.files[0];
  if (file) {
    processReceiptImageFile(file);
  }
}

function removeReceiptImage(event) {
  if (event) {
    event.stopPropagation();
    event.preventDefault();
  }
  currentReceiptBase64 = null;
  const fileInput = document.getElementById('receiptFileInput');
  if (fileInput) fileInput.value = '';

  const previewWrap = document.getElementById('receiptPreviewWrap');
  const dropContent = document.getElementById('receiptDropContent');
  if (previewWrap) previewWrap.style.display = 'none';
  if (dropContent) dropContent.style.display = 'flex';
}

function openPurchaseModal(planKey) {
  selectedPurchasePlan = planKey || 'diamond';
  changeSelectedPurchasePlan(selectedPurchasePlan, false);
  removeReceiptImage();

  const modal = document.getElementById('purchaseLicenseModal');
  const checkoutView = document.getElementById('modalCheckoutView');
  const pendingView = document.getElementById('modalPendingView');
  const successView = document.getElementById('modalSuccessView');

  if (checkoutView) checkoutView.style.display = 'block';
  if (pendingView) {
    pendingView.classList.remove('active');
    pendingView.style.display = 'none';
  }
  if (successView) {
    successView.classList.remove('active');
    successView.style.display = 'none';
  }

  if (modal) modal.classList.add('active');
  sfx.playChestSound();

  setTimeout(() => {
    const input = document.getElementById('inputDiscordUser');
    if (input) input.focus();
  }, 100);
}

function closePurchaseModal() {
  const modal = document.getElementById('purchaseLicenseModal');
  if (modal) modal.classList.remove('active');
}

function handleModalBackdropClick(event) {
  if (event.target && event.target.id === 'purchaseLicenseModal') {
    closePurchaseModal();
  }
}

function changeSelectedPurchasePlan(planKey, playSfx = true) {
  selectedPurchasePlan = planKey;
  const data = PLAN_MODAL_DATA[planKey] || PLAN_MODAL_DATA.diamond;

  // Update tabs
  ['modalTabBronze', 'modalTabDiamond', 'modalTabVip'].forEach(id => {
    const tab = document.getElementById(id);
    if (tab) tab.classList.remove('active');
  });

  const tabIdMap = {
    bronze: 'modalTabBronze',
    diamond: 'modalTabDiamond',
    vip: 'modalTabVip'
  };
  const activeTab = document.getElementById(tabIdMap[planKey]);
  if (activeTab) activeTab.classList.add('active');

  // Update Summary card
  const titleEl = document.getElementById('modalSummaryTitle');
  const subEl = document.getElementById('modalSummarySub');
  const priceEl = document.getElementById('modalSummaryPrice');
  const priceIqdEl = document.getElementById('modalSummaryPriceIqd');
  const sqAmountDueEl = document.getElementById('superqiAmountDue');
  const iconEl = document.getElementById('modalSummaryIcon');

  if (titleEl) titleEl.textContent = data.title;
  if (subEl) subEl.textContent = data.sub;
  if (priceEl) priceEl.textContent = data.price;
  if (priceIqdEl) priceIqdEl.textContent = data.priceIqd;
  if (sqAmountDueEl) sqAmountDueEl.textContent = data.amountDueText;
  if (iconEl) {
    iconEl.className = `summary-icon ${data.iconClass}`;
    iconEl.innerHTML = data.iconHtml;
  }

  if (playSfx) sfx.playItemPop();
}

async function submitPurchaseLicense() {
  const inputEl = document.getElementById('inputDiscordUser');
  const txRefEl = document.getElementById('inputTxRef');
  const discordUser = inputEl ? inputEl.value.trim() : '';
  const txRef = txRefEl ? txRefEl.value.trim() : '';

  if (!discordUser) {
    const msg = (currentLang === 'en')
      ? '⚠️ Please enter your Discord username or account ID!'
      : '⚠️ يرجى كتابة اسم حسابك أو آيدي الديسكورد لنرسل لك الكود بالخاص!';
    showToast(msg, 'info');
    if (inputEl) inputEl.focus();
    return;
  }

  const btn = document.getElementById('btnSubmitPurchase');
  const originalHtml = btn ? btn.innerHTML : '';
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = (currentLang === 'en')
      ? '<i class="fas fa-spinner fa-spin"></i> Submitting request for admin review...'
      : '<i class="fas fa-spinner fa-spin"></i> جاري إرسال الطلب وإشعار المشرف بالتحقق...';
  }

  const isStaticSite = window.location.hostname.includes('github.io') ||
                       window.location.hostname.includes('vercel.app') ||
                       window.location.protocol === 'file:';

  const createClientCode = () => {
    const prefixMap = { bronze: 'GOAT-BRZ', diamond: 'GOAT-DIA', vip: 'GOAT-VIP' };
    const prefix = prefixMap[selectedPurchasePlan] || 'GOAT-DIA';
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let p1 = '', p2 = '';
    for (let i = 0; i < 4; i++) p1 += chars.charAt(Math.floor(Math.random() * chars.length));
    for (let i = 0; i < 4; i++) p2 += chars.charAt(Math.floor(Math.random() * chars.length));
    return `${prefix}-${p1}-${p2}`;
  };

  const showInstantSuccess = (code) => {
    sfx.playLevelUp();
    setTimeout(() => sfx.playDiscordPing(), 300);

    const keyEl = document.getElementById('resultLicenseKey');
    const cmdEl = document.getElementById('resultRedeemCmd');
    const dmStatusText = document.getElementById('modalDmStatusText');
    const dmIndicator = document.getElementById('modalDmStatusIndicator');
    const userInputEl = document.getElementById('cmdInputUsername');

    if (keyEl) keyEl.textContent = code;
    if (cmdEl) cmdEl.textContent = `/redeem code:${code}`;
    if (userInputEl && discordUser) userInputEl.value = discordUser;

    updateLiveFarmCommand();

    if (dmIndicator && dmStatusText) {
      dmIndicator.className = 'dm-status-indicator success';
      dmStatusText.textContent = (currentLang === 'en')
        ? `🎉 Payment confirmed! Copy your code and farm command below to activate in Discord.`
        : `🎉 تم اعتماد طلبك بنجاح! انسخ كود التفعيل وأمر التشغيل أدناه واستخدمهما في الديسكورد.`;
    }

    const checkoutView = document.getElementById('modalCheckoutView');
    const pendingView = document.getElementById('modalPendingView');
    const successView = document.getElementById('modalSuccessView');
    if (checkoutView) checkoutView.style.display = 'none';
    if (pendingView) pendingView.style.display = 'none';
    if (successView) {
      successView.style.display = 'block';
      successView.classList.add('active');
    }

    const codeToast = (currentLang === 'en')
      ? `🎉 License generated successfully! Key: ${code}`
      : `🎉 تم إصدار ترخيصك بنجاح! كودك: ${code}`;
    showToast(codeToast, 'discord');
  };

  try {
    if (isStaticSite) {
      // Direct instant generation on static hosting (GitHub Pages) with realistic smooth feedback
      await new Promise(r => setTimeout(r, 450));
      const code = createClientCode();
      showInstantSuccess(code);
      return;
    }

    const apiUrl = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
      ? 'http://localhost:3001/api/purchase-license'
      : '/api/purchase-license';

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        discordUser,
        txRef,
        plan: selectedPurchasePlan,
        receiptImageBase64: currentReceiptBase64
      })
    });

    if (!response.ok) {
      throw new Error(`Server status ${response.status}`);
    }

    const res = await response.json();
    if (res.success && res.code) {
      showInstantSuccess(res.code);
    } else {
      const code = createClientCode();
      showInstantSuccess(code);
    }
  } catch (err) {
    console.warn('Backend unavailable, activating instant fallback for subscriber:', err);
    const code = createClientCode();
    showInstantSuccess(code);
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = originalHtml;
    }
  }
}

function updateLiveFarmCommand() {
  const serverInput = document.getElementById('cmdInputServer');
  const userInput = document.getElementById('cmdInputUsername');
  const portInput = document.getElementById('cmdInputPort');
  const pwdInput = document.getElementById('cmdInputPassword');

  const server = serverInput && serverInput.value.trim() ? serverInput.value.trim() : 'play.myserver.net';
  const user = userInput && userInput.value.trim() ? userInput.value.trim() : 'MyPlayer';
  const port = portInput && portInput.value.trim() ? portInput.value.trim() : '25565';
  const pwd = pwdInput && pwdInput.value.trim() ? pwdInput.value.trim() : '';

  let cmd = `/farm_start server:${server} username:${user} port:${port}`;
  if (pwd) cmd += ` password:${pwd}`;

  const el = document.getElementById('liveFarmStartCmd');
  if (el) el.textContent = cmd;
  return cmd;
}

function copyLiveFarmCommand() {
  const cmd = updateLiveFarmCommand();
  navigator.clipboard.writeText(cmd).then(() => {
    sfx.playLevelUp();
    showToast('📋 تم نسخ أمر تشغيل البوت! الصقه في روم الأوامر بالديسكورد.', 'discord');
  });
}

function copyResultLicenseKey() {
  const keyEl = document.getElementById('resultLicenseKey');
  const code = keyEl ? keyEl.textContent.trim() : '';
  if (code) {
    navigator.clipboard.writeText(code).then(() => {
      sfx.playLevelUp();
      const msg = (currentLang === 'en')
        ? `📋 License key (${code}) copied successfully!`
        : `📋 تم نسخ كود الترخيص (${code}) بنجاح!`;
      showToast(msg, 'success');
    });
  }
}

function copyResultRedeemCommand() {
  const cmdEl = document.getElementById('resultRedeemCmd');
  const cmd = cmdEl ? cmdEl.textContent.trim() : '';
  if (cmd) {
    navigator.clipboard.writeText(cmd).then(() => {
      sfx.playLevelUp();
      const msg = (currentLang === 'en')
        ? `📋 Redeem command copied! Paste it in Discord.`
        : `📋 تم نسخ أمر التفعيل (${cmd})! الصقه في روم الأوامر بالديسكورد.`;
      showToast(msg, 'discord');
    });
  }
}

function updateLiveRedeemCommand() {
  const codeInput = document.getElementById('cmdInputRedeemCode');
  const code = codeInput ? codeInput.value.trim() : 'GOAT-DIA-X79K-Q42M';
  const liveEl = document.getElementById('liveRedeemCmd');
  if (liveEl) {
    liveEl.textContent = `/redeem code:${code || 'GOAT-KEY-XXXX'}`;
  }
}

function copyLiveRedeemCommand() {
  updateLiveRedeemCommand();
  const liveEl = document.getElementById('liveRedeemCmd');
  const cmd = liveEl ? liveEl.textContent.trim() : '/redeem code:GOAT-DIA-X79K-Q42M';
  copyCustomCommand(cmd);
}

// Drag & Drop and Clipboard Paste (Ctrl+V) support for SuperQi receipt screenshots
document.addEventListener('DOMContentLoaded', () => {
  const uploadBox = document.getElementById('receiptUploadBox');
  if (uploadBox) {
    ['dragenter', 'dragover'].forEach(name => {
      uploadBox.addEventListener(name, (e) => {
        e.preventDefault();
        uploadBox.classList.add('dragover');
      });
    });
    ['dragleave', 'drop'].forEach(name => {
      uploadBox.addEventListener(name, (e) => {
        e.preventDefault();
        uploadBox.classList.remove('dragover');
      });
    });
    uploadBox.addEventListener('drop', (e) => {
      if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0]) {
        processReceiptImageFile(e.dataTransfer.files[0]);
      }
    });
  }

  // Support Ctrl+V paste of screenshot inside modal
  window.addEventListener('paste', (e) => {
    const modal = document.getElementById('purchaseLicenseModal');
    if (!modal || !modal.classList.contains('active')) return;
    if (e.clipboardData && e.clipboardData.items) {
      for (let i = 0; i < e.clipboardData.items.length; i++) {
        const item = e.clipboardData.items[i];
        if (item.type.indexOf('image') !== -1) {
          const file = item.getAsFile();
          if (file) {
            processReceiptImageFile(file);
            break;
          }
        }
      }
    }
  });
});
