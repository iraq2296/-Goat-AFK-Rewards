/**
 * Advanced Minecraft Auto-Farming & AFK Client Bot
 * Works on ANY server (Cracked or Premium) without server plugins.
 */

const fs = require('fs');
const path = require('path');
const mineflayer = require('mineflayer');

// Load config
const configPath = path.join(__dirname, 'config.json');
let config = {};
try {
  config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
} catch (e) {
  console.error('[Error] Could not read config.json. Using defaults.');
}

const serverHost = config.server?.host || 'localhost';
const serverPort = config.server?.port || 25565;
const username = config.account?.username || 'AFK_Farmer';
const authType = config.account?.auth || 'offline';
const password = config.account?.password || '';

console.log('====================================================');
console.log('  🚀 Minecraft Auto-Farming & AFK Bot');
console.log(`  🌐 Target: ${serverHost}:${serverPort}`);
console.log(`  👤 Username: ${username} (${authType})`);
console.log('====================================================');

if (serverHost === 'play.example-server.net' || serverHost === 'play.example.com') {
  console.log('\n⚠️  [تنبيه مهم]');
  console.log('  الآيبي المكتوب حالياً هو سيرفر تجريبي وهمي: ' + serverHost);
  console.log('  لكي يدخل البوت السيرفر ويكون أونلاين:');
  console.log('  ضع آيبي سيرفرك الحقيقي في ملف config.json أو من لوحة الموقع واضغط حفظ!');
  console.log('====================================================\n');
}

let bot = null;
let isReconnecting = false;
let attackTimer = null;
let antiAfkTimer = null;
let isEating = false;

function sendDiscordLog(title, description, color = 0x55ffff) {
  if (!config.modules?.discord?.enabled || !config.modules?.discord?.webhookUrl) return;
  const webhookUrl = config.modules.discord.webhookUrl;
  if (!webhookUrl.startsWith('https://discord.com/api/webhooks/')) return;

  const botName = config.modules?.discord?.username || 'Goat AFK Rewards';
  const avatarUrl = config.modules?.discord?.avatarUrl || 'https://files.catbox.moe/6pndxl.png';

  const payload = {
    username: botName,
    avatar_url: avatarUrl,
    embeds: [{
      title,
      description,
      color,
      footer: { text: `Server: ${serverHost}` },
      timestamp: new Date().toISOString()
    }]
  };

  fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  }).catch(() => {});
}

function startBot() {
  isReconnecting = false;

  bot = mineflayer.createBot({
    host: serverHost,
    port: serverPort,
    username: username,
    auth: authType,
    version: config.server?.version || false
  });

  bot.on('login', () => {
    console.log(`[Success] Connected to ${serverHost}! Logging in...`);
    sendDiscordLog('🟢 متصل بالسيرفر', `البوت **${username}** دخل السيرفر بنجاح وهو الآن جاهز للفرم.`, 0x00ff00);
  });

  bot.on('spawn', () => {
    console.log('[Spawn] Player spawned in world.');

    // Auto-Register / Auto-Login for cracked servers
    if (password) {
      setTimeout(() => {
        bot.chat(`/register ${password} ${password}`);
        setTimeout(() => {
          bot.chat(`/login ${password}`);
        }, 1200);
      }, 2000);
    }

    // Start modules
    initAntiAfk();
    initAutoAttack();
    initAutoEat();
  });

  // Handle Chat messages
  bot.on('chat', (sender, message) => {
    // If server asks to login or register
    const lower = message.toLowerCase();
    if (lower.includes('/register') && password) {
      bot.chat(`/register ${password} ${password}`);
    } else if (lower.includes('/login') && password) {
      bot.chat(`/login ${password}`);
    }
  });

  // Health and Food monitoring
  bot.on('health', () => {
    if (bot.food <= (config.modules?.autoEat?.minFoodLevel || 14)) {
      triggerEat();
    }
  });

  // Reconnect logic
  bot.on('kicked', (reason) => {
    console.log(`[Kicked] Disconnected from server: ${JSON.stringify(reason)}`);
    sendDiscordLog('⚠️ تم طرد البوت', `تم فصل البوت من السيرفر. السبب: ${JSON.stringify(reason)}`, 0xffaa00);
    scheduleReconnect();
  });

  bot.on('end', () => {
    console.log('[Disconnected] Connection ended.');
    scheduleReconnect();
  });

  bot.on('error', (err) => {
    console.error('[Error]', err.message || err);
    scheduleReconnect();
  });
}

function scheduleReconnect() {
  if (isReconnecting) return;
  if (!config.modules?.autoReconnect?.enabled) return;

  isReconnecting = true;
  clearInterval(attackTimer);
  clearInterval(antiAfkTimer);

  const delay = (config.modules?.autoReconnect?.delaySeconds || 15) * 1000;
  console.log(`[Reconnect] Will retry connecting in ${delay / 1000} seconds...`);

  setTimeout(() => {
    console.log('[Reconnect] Reconnecting now...');
    startBot();
  }, delay);
}

// ----------------------------------------------------
// Module 1: Anti-AFK Movement
// ----------------------------------------------------
function initAntiAfk() {
  if (!config.modules?.antiAfk?.enabled) return;
  clearInterval(antiAfkTimer);

  const interval = (config.modules?.antiAfk?.intervalSeconds || 30) * 1000;
  antiAfkTimer = setInterval(() => {
    if (isEating || !bot || !bot.entity) return;

    // 1. Random subtle look rotation
    const yaw = bot.entity.yaw + (Math.random() - 0.5) * 0.8;
    const pitch = Math.max(-1.2, Math.min(1.2, bot.entity.pitch + (Math.random() - 0.5) * 0.4));
    bot.look(yaw, pitch, true);

    // 2. Safe Sneak & Jump
    bot.setControlState('sneak', true);
    setTimeout(() => {
      bot.setControlState('jump', true);
      setTimeout(() => {
        bot.setControlState('jump', false);
        bot.setControlState('sneak', false);
      }, 300);
    }, 350);

  }, interval);
}

// ----------------------------------------------------
// Module 2: Auto-Attack (Mob Grinder Farm)
// ----------------------------------------------------
function initAutoAttack() {
  if (!config.modules?.autoAttack?.enabled) return;
  clearInterval(attackTimer);

  const radius = config.modules.autoAttack.radius || 3.8;
  const intervalMs = config.modules.autoAttack.intervalMs || 700;

  attackTimer = setInterval(() => {
    if (isEating || !bot || !bot.entity) return;

    // Equip best weapon in inventory if not already holding sword
    equipBestWeapon();

    // Find nearest hostile mob or entity in front of the bot
    const entity = bot.nearestEntity((e) => {
      if (e.type !== 'mob' && e.type !== 'player') return false;
      if (e.id === bot.entity.id) return false;
      const dist = bot.entity.position.distanceTo(e.position);
      return dist <= radius;
    });

    if (entity) {
      // Look at mob and strike
      bot.lookAt(entity.position.offset(0, entity.height * 0.6, 0), true).then(() => {
        bot.attack(entity);
      }).catch(() => {
        bot.attack(entity);
      });
    } else {
      // If no mob target, swing arm to trigger auto-clicker mechanics if at grinder
      bot.swingArm('right');
    }

    // Check inventory space for chest deposit
    checkChestDeposit();

  }, intervalMs);
}

function equipBestWeapon() {
  if (!bot || !bot.inventory) return;
  const heldItem = bot.heldItem;
  if (heldItem && heldItem.name.includes('sword')) return;

  const sword = bot.inventory.items().find(i => i.name.includes('sword'));
  if (sword) {
    bot.equip(sword, 'hand').catch(() => {});
  }
}

// ----------------------------------------------------
// Module 3: Auto-Eat
// ----------------------------------------------------
function initAutoEat() {
  // Monitored on health event
}

function triggerEat() {
  if (isEating || !bot || !bot.inventory) return;

  const foods = ['cooked_beef', 'cooked_porkchop', 'golden_carrot', 'bread', 'cooked_mutton', 'cooked_chicken', 'apple', 'baked_potato'];
  const foodItem = bot.inventory.items().find(item => foods.includes(item.name));

  if (!foodItem) {
    console.log('[Warning] Hunger is low, but no food found in inventory!');
    return;
  }

  isEating = true;
  console.log(`[AutoEat] Eating ${foodItem.name}...`);

  bot.equip(foodItem, 'hand').then(() => {
    bot.consume().then(() => {
      console.log('[AutoEat] Finished eating!');
      isEating = false;
      equipBestWeapon();
    }).catch(() => {
      isEating = false;
    });
  }).catch(() => {
    isEating = false;
  });
}

// ----------------------------------------------------
// Module 4: Auto-Chest Deposit
// ----------------------------------------------------
let lastChestCheck = 0;
function checkChestDeposit() {
  if (!config.modules?.autoChest?.enabled) return;
  const now = Date.now();
  if (now - lastChestCheck < 20000) return; // check every 20 seconds
  lastChestCheck = now;

  const emptySlots = bot.inventory.emptySlotCount();
  const threshold = config.modules.autoChest.depositWhenSlotsLeft || 3;

  if (emptySlots <= threshold) {
    console.log(`[Chest] Inventory almost full (${emptySlots} slots left). Looking for chest...`);
    const chestBlock = bot.findBlock({
      matching: [54, 146], // chest & trapped chest
      maxDistance: config.modules.autoChest.chestRadius || 4
    });

    if (chestBlock) {
      bot.openChest(chestBlock).then(async (chest) => {
        console.log('[Chest] Chest opened. Depositing farm items...');
        const itemsToDeposit = bot.inventory.items().filter(item => {
          // Keep sword, food, and armor
          if (item.name.includes('sword')) return false;
          if (['cooked_beef', 'cooked_porkchop', 'golden_carrot', 'bread'].includes(item.name)) return false;
          return true;
        });

        for (const item of itemsToDeposit) {
          try {
            await chest.deposit(item.type, null, item.count);
          } catch (e) {}
        }

        chest.close();
        console.log('[Chest] Deposit complete! Back to farming.');
        sendDiscordLog('📦 تفريغ الصندوق', `تم نقل الموارد النادرة من حقيبة البوت إلى الصندوق بنجاح.`, 0x00ff00);
      }).catch((e) => {
        console.log('[Chest] Could not open chest:', e.message);
      });
    }
  }
}

// Start
startBot();
