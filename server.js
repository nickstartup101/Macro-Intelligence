import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const FF_THISWEEK = 'https://nfs.faireconomy.media/ff_calendar_thisweek.json';
const FF_NEXTWEEK = 'https://nfs.faireconomy.media/ff_calendar_nextweek.json';

// ✅ Your Verified Telegram Bot Credentials
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '8827536113:AAGmERJjiA-3Qom2dEhUWG0F9Qo9KGmFJA0';
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID || '5836921658';

// Helper: Escape HTML special characters for Telegram API Safety
function escapeHtml(text) {
  if (!text) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// 📲 Core Telegram Sender with Full Error Diagnostics
async function sendTelegramAlert(htmlMessage) {
  try {
    const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: TELEGRAM_CHAT_ID,
        text: htmlMessage,
        parse_mode: 'HTML',
        disable_web_page_preview: true
      })
    });
    
    const json = await res.json();
    if (!json.ok) {
      console.error('[Telegram API Rejected]:', json.description);
      return { success: false, error: json.description };
    }
    console.log('[Telegram Alert]: Successfully sent message to ID:', TELEGRAM_CHAT_ID);
    return { success: true };
  } catch (err) {
    console.error('[Telegram Network Error]:', err.message);
    return { success: false, error: err.message };
  }
}

function formatFlashReleaseAlert(event) {
  const isBeat = event.marketImpact.isHawkish;
  const safeTitle = escapeHtml(event.title);
  const safeActual = escapeHtml(event.actual);
  const safeForecast = escapeHtml(event.forecast);
  const safePrev = escapeHtml(event.previous);

  return `🚨 <b>[FLASH NEWS] ປະກາດຕົວເລກເສດຖະກິດຫຼ້າສຸດ!</b>
━━━━━━━━━━━━━━━━━━━━
📊 <b>ຂ່າວ:</b> ${safeTitle}
⏰ <b>ເວລາ:</b> ${escapeHtml(event.dateGMT7)} • ${escapeHtml(event.timeGMT7)}
🟥 <b>ລະດັບ:</b> HIGH IMPACT

🔢 <b>ຕົວເລກປະກາດຕົວຈິງ:</b>
• <b>ປະກາດຈິງ (Actual):</b>  <code>${safeActual}</code> ${isBeat ? '🔥 [BEAT]' : '❄️ [MISS]'}
• <b>ຄາດການ (Forecast):</b> ${safeForecast}
• <b>ຄັ້ງກ່ອນ (Previous):</b> ${safePrev}
━━━━━━━━━━━━━━━━━━━━
🎯 <b>ສະຫຼຸບຜົນກະທົບຕໍ່ຕະຫຼາດ:</b>
💵 <b>USD:</b> ${escapeHtml(event.marketImpact.usdImpact)}
🟡 <b>GOLD:</b> ${escapeHtml(event.marketImpact.goldImpact)}
📊 <b>ໄລຍະແລ່ນທີ່ຄາດການ:</b> ${escapeHtml(event.pipRange.pips)}

💡 <b>ບົດວິເຄາະສະບັບເຂົ້າໃຈງ່າຍ:</b>
${isBeat 
  ? 'ຕະຫຼາດແຮງງານ/ເສດຖະກິດແຂງແກ່ນເກີນຄາດ ເຮັດໃຫ້ Fed ຍັງບໍ່ຮີບຮ້ອນຫຼຸດດອກເບ້ຍ (Hawkish Hold) ເຊິ່ງຈະໜູນ USD ແຂງຄ່າ ແລະ ກົດດັນທອງຄຳໄລຍະສັ້ນ.' 
  : 'ຕົວເລກຊະລໍຕົວລົງ ເຮັດໃຫ້ຕະຫຼາດຄາດຫວັງວ່າ Fed ຈະຕ້ອງພິຈາລະນາຫຼຸດດອກເບ້ຍໄວຂຶ້ນ ເປັນປັດໄຈບວກໜູນລາຄາທອງຄຳທັນທີ.'}

🎯 <b>ແຜນເທຣດ (TRADE PLAYBOOK // XAU/USD):</b>
${isBeat 
  ? '• <b>Action:</b> ລະວັງການເທຂາຍຈົບຮອບ Wave A ແລ້ວມີແຮງຊື້ Rebound ຂຶ້ນເປັນ Wave B.\n• <b>Entry:</b> ລໍຖ້າລາຄາ Pullback ຂຶ້ນມາ Retest <b>EMA 50 (TF M5/M15)</b> ຖ້າບໍ່ຜ່ານໃຫ້ Sell ຕາມ.\n• <b>Risk:</b> ຕັ້ງ Stop Loss ເໜືອ High ຂອງແທ່ງຂ່າວ!'
  : '• <b>Action:</b> Follow Buy ຕາມ Momentum ຂ່າວ (ລຸ້ນ New ATH).\n• <b>Entry:</b> ລໍຖ້າແທ່ງທຽນ M5/M15 ຍໍ້ລົງມາແຕະ <b>EMA 20 ຫຼື EMA 50</b> ແລ້ວຢືນຢູ່ ຈຶ່ງເຂົ້າ Buy ຕາມ.\n• <b>Risk:</b> ຕັ້ງ Stop Loss ໃຕ້ເສັ້ນ EMA 50 ປະມານ 30-40 pips.'}
━━━━━━━━━━━━━━━━━━━━
🌐 <i>ລະບົບ MACRO TERMINAL AUTO-BOT</i>`;
}

function parseNum(val) {
  if (!val || typeof val !== 'string') return null;
  const clean = val.replace(/[%KM,]/g, '').trim();
  const num = parseFloat(clean);
  return isNaN(num) ? null : num;
}

function formatForexFactoryDate(isoString) {
  try {
    if (!isoString) return { dateStr: '--', timeStr: '--', timestamp: 0 };
    const dateObj = new Date(isoString);
    if (isNaN(dateObj.getTime())) return { dateStr: '--', timeStr: '--', timestamp: 0 };

    const optDate = { timeZone: 'Asia/Bangkok', weekday: 'short', day: 'numeric', month: 'short' };
    const optTime = { timeZone: 'Asia/Bangkok', hour: '2-digit', minute: '2-digit', hour12: false };

    return {
      dateStr: new Intl.DateTimeFormat('lo-LA', optDate).format(dateObj),
      timeStr: new Intl.DateTimeFormat('en-GB', optTime).format(dateObj) + ' (GMT+7)',
      timestamp: dateObj.getTime(),
      isoString: dateObj.toISOString()
    };
  } catch (e) {
    return { dateStr: '--', timeStr: '--', timestamp: 0 };
  }
}

function getExpectedPipRange(title) {
  const t = (title || '').toLowerCase();
  if (t.includes('non-farm') || t.includes('payrolls')) return { pips: '150 - 300 pips', usdRange: '$15 - $30' };
  if (t.includes('cpi') || t.includes('pce')) return { pips: '120 - 250 pips', usdRange: '$12 - $25' };
  if (t.includes('fomc') || t.includes('fed funds')) return { pips: '200 - 400 pips', usdRange: '$20 - $40' };
  return { pips: '50 - 100 pips', usdRange: '$5 - $10' };
}

function calculateEventImpact(e) {
  const actual = e.actualNum;
  const forecast = e.forecastNum;
  const t = (e.title || '').toLowerCase();

  let isHawkish = true;
  if (actual !== null && forecast !== null) {
    if (t.includes('unemployment') || t.includes('claims')) isHawkish = actual < forecast;
    else isHawkish = actual >= forecast;
  }

  return {
    isHawkish,
    usdImpact: isHawkish ? 'BULLISH ↑' : 'BEARISH ↓',
    usdColor: isHawkish ? 'text-primary bg-primary/10 border-primary/30' : 'text-error bg-error/10 border-error/30',
    goldImpact: isHawkish ? 'BEARISH ↓' : 'BULLISH ↑',
    goldColor: isHawkish ? 'text-error bg-error/10 border-error/30' : 'text-primary bg-primary/10 border-primary/30'
  };
}

function buildEventTransmissionModel(evt) {
  const t = (evt.title || '').toLowerCase();
  let eventType = 'INFLATION';
  let node1Name = 'INFLATION DATA';
  let node1Icon = 'price_change';

  if (t.includes('employment') || t.includes('payrolls') || t.includes('adp') || t.includes('labor')) {
    eventType = 'LABOR';
    node1Name = 'LABOR MKT';
    node1Icon = 'engineering';
  } else if (t.includes('gdp') || t.includes('sales') || t.includes('pmi')) {
    eventType = 'GROWTH';
    node1Name = 'GDP GROWTH';
    node1Icon = 'trending_up';
  }

  const fc = escapeHtml(evt.forecast || '0.2%');
  return {
    eventType,
    nodes: [
      { name: node1Name, icon: node1Icon },
      { name: 'FED BIAS', icon: 'account_balance' },
      { name: 'USD/YIELD', icon: 'payments' },
      { name: '10Y YIELD', icon: 'show_chart' },
      { name: 'GOLD', icon: 'diamond' }
    ],
    scenarios: {
      above: { title: `ABOVE EXPECTATION (> ${fc})`, state: 'Hawkish Bias', usd: '↑', gold: '↓' },
      inline: { title: `IN LINE (${fc})`, state: 'Neutral / Holds', usd: '—', gold: '—' },
      below: { title: `BELOW EXPECTATION (< ${fc})`, state: 'Dovish Shift', usd: '↓', gold: '↑' }
    }
  };
}

// Global set to prevent duplicate telegram spam
let sentEventIds = new Set();

async function checkAndBroadcastNewReleases(processedEvents) {
  try {
    const highImpactReleased = processedEvents.filter(e => e.impact === 'High' && e.isReleased);

    for (const e of highImpactReleased) {
      const eventKey = `${e.title}_${e.dateGMT7}_${e.actual}`;

      if (!sentEventIds.has(eventKey)) {
        const msg = formatFlashReleaseAlert(e);
        console.log(`[Auto-Broadcast Triggered]: ${e.title}`);
        await sendTelegramAlert(msg);
        sentEventIds.add(eventKey);
      }
    }
  } catch (err) {
    console.error('[Auto-Broadcast Error]:', err.message);
  }
}

// Main API Route
app.get('/api/macro-full-feed', async (req, res) => {
  try {
    const [res1, res2] = await Promise.all([
      fetch(FF_THISWEEK, { headers: { 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(5000) }),
      fetch(FF_NEXTWEEK, { headers: { 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(5000) })
    ]);

    const data1 = res1.ok ? await res1.json() : [];
    const data2 = res2.ok ? await res2.json() : [];
    const allEvents = [...data1, ...data2];

    const filteredUSD = allEvents.filter(e => e.country === 'USD' && (e.impact === 'High' || e.impact === 'Medium'));

    const processedEvents = filteredUSD.map(e => {
      const { dateStr, timeStr, timestamp, isoString } = formatForexFactoryDate(e.date);
      const actualNum = parseNum(e.actual);
      const forecastNum = parseNum(e.forecast);
      const previousNum = parseNum(e.previous);
      const isReleased = Boolean(e.actual && String(e.actual).trim() !== '');

      return {
        title: e.title,
        impact: e.impact,
        dateGMT7: dateStr,
        timeGMT7: timeStr,
        timestamp,
        isoString,
        actual: isReleased ? e.actual : null,
        actualNum,
        forecast: e.forecast || '--',
        forecastNum,
        previous: e.previous || '--',
        previousNum,
        isReleased,
        pipRange: getExpectedPipRange(e.title),
        marketImpact: calculateEventImpact({ title: e.title, actualNum, forecastNum, actual: e.actual }),
        transmissionModel: buildEventTransmissionModel({ title: e.title, forecast: e.forecast || '--' })
      };
    });

    processedEvents.sort((a, b) => a.timestamp - b.timestamp);

    // Auto-check for new broadcasts on API fetch (Works seamlessly on Vercel Serverless!)
    checkAndBroadcastNewReleases(processedEvents);

    const highImpactList = processedEvents.filter(e => e.impact === 'High');
    const displayHighImpactList = highImpactList.length > 0 ? highImpactList : processedEvents.slice(0, 6);

    const nowTime = Date.now();
    const upcomingEvents = processedEvents.filter(e => e.timestamp > nowTime || !e.isReleased);
    const activeEvent = upcomingEvents.find(e => e.impact === 'High') || upcomingEvents[0] || displayHighImpactList[0];

    const currencyHeatmap = [
      { pair: 'USD (US Dollar)', score: '+8.2', status: 'STRONG BULLISH', color: 'text-primary bg-primary/10 border-primary/30', desc: 'ແຂງຄ່າຈາກດອກເບ້ຍສູງ & ຕະຫຼາດແຮງງານແຂງແກ່ນ' },
      { pair: 'XAU (Gold)', score: '+5.5', status: 'HEDGE DEMAND', color: 'text-yellow-400 bg-yellow-400/10 border-yellow-400/30', desc: 'ມີແຮງຊື້ປ້ອງກັນຄວາມສ່ຽງເງິນເຟີ້ & ພາສີ' },
      { pair: 'EUR (Euro)', score: '-3.8', status: 'WEAK', color: 'text-error bg-error/10 border-error/30', desc: 'ຖືກກົດດັນຈາກການຫຼຸດດອກເບ້ຍ ECB' },
      { pair: 'GBP (Pound)', score: '+1.2', status: 'NEUTRAL', color: 'text-white bg-surface-container border-outline-variant', desc: 'ຊົງຕົວຕາມເງິນເຟີ້ອັງກິດ' },
      { pair: 'JPY (Yen)', score: '-6.5', status: 'VERY WEAK', color: 'text-error bg-error/10 border-error/30', desc: 'ດອກເບ້ຍຕ່າງກັນຫຼາຍທຽບກັບ USD' }
    ];

    const tradePlaybook = {
      targetEvent: activeEvent?.title || 'High Impact Event',
      scenarios: [
        {
          caseTitle: 'ກໍລະນີທີ 1: ຕົວເລກສູງກວ່າຄາດ (BEAT - Hawkish)',
          tag: 'HAWKISH BEAT',
          tagColor: 'text-primary border-primary bg-primary/10',
          planGold: 'Sell Gold ຕາມ Momentum ໄລຍະສັ້ນ ຫຼື ລໍຖ້າ Retest EMA 50 (TF M5/M15) ແລ້ວ Sell ຕາມ.',
          planUSD: 'Buy USD ຕາມແຮງໜູນດອກເບ້ຍ Fed.',
          riskNote: 'ລະວັງ Spread ຖ່າງໃນ 5 ນາທີທຳອິດ.'
        },
        {
          caseTitle: 'ກໍລະນີທີ 2: ຕົວເລກຕ່ຳກວ່າຄາດ (MISS - Dovish)',
          tag: 'DOVISH MISS',
          tagColor: 'text-error border-error bg-error/10',
          planGold: 'Buy Gold ທັນທີ! ລໍຖ້າຍໍ້ແຕະ EMA 20/50 (TF M5) ແລ້ວ Buy ລຸ້ນ New ATH.',
          planUSD: 'Sell USD ຍ້ອນຜົນຕອບແທນພັນທະບັດຫຼຸດລົງ.',
          riskNote: 'ຕັ້ງ Stop Loss ໃຕ້ແນວຮັບສະເໝີ.'
        },
        {
          caseTitle: 'ກໍລະນີທີ 3: ຕົວເລກຕາມຄາດ (IN-LINE - Neutral)',
          tag: 'NEUTRAL IN-LINE',
          tagColor: 'text-tertiary border-tertiary bg-tertiary/10',
          planGold: 'ລະວັງ Fakeout ລາກກິນ Stop Loss ທັງສອງຝັ່ງ ໃຫ້ລໍຖ້າ 15 ນາທີ.',
          planUSD: 'ຕະຫຼາດ Sideway ໃນກອບ.',
          riskNote: 'ຫຼີກລ່ຽງການເປີດ Lot ໃຫຍ່.'
        }
      ]
    };

    const plainDigest = {
      bigPictureSummary: `ເສດຖະກິດສະຫະລັດໃນຕອນນີ້ "ຍັງບໍ່ໄດ້ຖົດຖອຍ" ເພາະຄົນຍັງມີວຽກເຮັດງານທຳຫຼາຍ ແລະ ບໍລິສັດຍັງຈ້າງຄົນເພີ່ມ. ແຕ່ພາກໂຮງງານເລີ່ມຊະລໍຕົວລົງຍ້ອນຕົ້ນທຶນພາສີນຳເຂົ້າ. ພາບລວມຄື: ເສດຖະກິດຍັງແລ່ນໄດ້ດີ ແຕ່ກຳລັງຖືກທົດສອບດ້ວຍເງິນເຟີ້ ແລະ ດອກເບ້ຍສູງ.`,
      plainQA: [
        { q: "1. ເສດຖະກິດກຳລັງຈະໄປທິດທາງໃດ?", badge: "ທົນທານ (RESILIENT)", color: "text-primary border-primary/40 bg-primary/10", ans: "ເສດຖະກິດຢູ່ໃນພາວະ Soft Landing. ຄົນສ່ວນໃຫຍ່ຍັງມີລາຍໄດ້ ແລະ ຍັງຈັບຈ່າຍໃຊ້ສອຍໄດ້ຢູ່." },
        { q: "2. Fed ຈະເຮັດແນວໃດຕໍ່ກັບດອກເບ້ຍ?", badge: "ຄົງດອກເບ້ຍສູງ (HOLD RATE)", color: "text-tertiary border-tertiary/40 bg-tertiary/10", ans: "Fed ຈະຍັງບໍ່ຮີບຮ້ອນຫຼຸດດອກເບ້ຍ ເພື່ອຄຸມເງິນເຟີ້ໃຫ້ຢູ່ໝັດ." },
        { q: "3. ຜົນກະທົບຕໍ່ ໂດລາ, ທອງຄຳ ແລະ ນ້ຳມັນ?", badge: "MARKET IMPACT", color: "text-primary border-primary/40 bg-primary/10", ans: "• USD: ແຂງຄ່າ\n• ທອງຄຳ: ຖືກກົດດັນໄລຍະສັ້ນ ແຕ່ລຸ້ນ Rebound (ATH)\n• ນ້ຳມັນ: ລາຄາຍັງຊົງຕົວລະດັບຕ່ຳ." }
      ],
      thermometer: {
        labor: { status: "ແຂງແກ່ນ (STRONG)", desc: "ການຈ້າງງານ NFP ເພີ່ມຂຶ້ນດີ", level: 80 },
        inflation: { status: "ຍັງໜຽວ (STICKY)", desc: "ເງິນເຟີ້ຍັງສູງກວ່າເປົ້າໝາຍ 2%", level: 75 },
        manufacturing: { status: "ຊະລໍຕົວ (COOLING)", desc: "ISM < 50% ຫົດຕົວຈາກພາສີ", level: 45 }
      }
    };

    const now = new Date();
    res.json({
      success: true,
      data: {
        currentCycleLao: `ຮອບຂໍ້ມູນ Live Sync: ${new Intl.DateTimeFormat('lo-LA', { dateStyle: 'full', timeStyle: 'short', timeZone: 'Asia/Bangkok' }).format(now)}`,
        activeEvent,
        highImpactList: displayHighImpactList,
        currencyHeatmap,
        tradePlaybook,
        plainDigest,
        allMediumAndHighCalendar: processedEvents
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 📲 Test Telegram Broadcast with Direct Error Reporting
app.post('/api/test-telegram', async (req, res) => {
  const sampleEvent = {
    title: 'Non-Farm Employment Change (NFP)',
    dateGMT7: 'ວັນສຸກ',
    timeGMT7: '19:30 (GMT+7)',
    actual: '228K',
    forecast: '140K',
    previous: '165K',
    pipRange: { pips: '150 - 300 pips', usdRange: '$15 - $30' },
    marketImpact: { isHawkish: true, usdImpact: 'BULLISH ↑', goldImpact: 'BEARISH ↓' }
  };

  const msg = formatFlashReleaseAlert(sampleEvent);
  const result = await sendTelegramAlert(msg);

  if (result.success) {
    res.json({ success: true, message: '✅ ສົ່ງຂໍ້ຄວາມເຂົ້າ Telegram ສຳເລັດແລ້ວ! ກະລຸນາກວດເບິ່ງໃນ Telegram ຂອງທ່ານ.' });
  } else {
    res.json({ 
      success: false, 
      message: `❌ ສົ່ງບໍ່ສຳເລັດ! ເຫດຜົນຈາກ Telegram: "${result.error}". \n👉 ວິທີແກ້: ກະລຸນາກົດເຂົ້າໄປທີ່ Bot ຂອງທ່ານໃນ Telegram ແລ້ວກົດປຸ່ມ START 1 ຄັ້ງ!` 
    });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 SERVER RUNNING ON http://localhost:${PORT}`);
  console.log(`🤖 Telegram Bot Token: ${TELEGRAM_BOT_TOKEN.slice(0, 10)}...`);
  console.log(`🆔 Telegram Chat ID: ${TELEGRAM_CHAT_ID}`);
});
