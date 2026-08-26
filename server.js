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

// Telegram Configuration
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '8827536113:AAGmERJjiA-3Qom2dEhUWG0F9Qo9KGmFJA0';
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID || '5836921658';

// =========================================================================
// 📲 TELEGRAM BROADCAST SERVICE
// =========================================================================

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
    if (!json.ok) console.error('[Telegram Error]:', json.description);
    return json.ok;
  } catch (err) {
    console.error('[Telegram Fetch Error]:', err.message);
    return false;
  }
}

function formatFlashReleaseAlert(event) {
  const isBeat = event.marketImpact.isHawkish;
  return `🚨 <b>[FLASH NEWS] ປະກາດຕົວເລກເສດຖະກິດຫຼ້າສຸດ!</b>
━━━━━━━━━━━━━━━━━━━━
📊 <b>ຂ່າວ:</b> ${event.title}
⏰ <b>ເວລາ:</b> ${event.dateGMT7} • ${event.timeGMT7}
🟥 <b>ລະດັບ:</b> HIGH IMPACT (ກ່ອງແດງ)

🔢 <b>ຕົວເລກປະກາດຕົວຈິງ:</b>
• <b>ປະກາດຈິງ (Actual):</b>  <code>${event.actual}</code> ${isBeat ? '🔥 [MAJOR BEAT]' : '❄️ [MISS]'}
• <b>ຄາດການ (Forecast):</b> ${event.forecast}
• <b>ຄັ້ງກ່ອນ (Previous):</b> ${event.previous}
━━━━━━━━━━━━━━━━━━━━
🎯 <b>ສະຫຼຸບຜົນກະທົບຕໍ່ຕະຫຼາດ:</b>
💵 <b>USD:</b> ${event.marketImpact.usdImpact}
🟡 <b>GOLD:</b> ${event.marketImpact.goldImpact}
📊 <b>ໄລຍະແລ່ນທີ່ຄາດການ:</b> ${event.pipRange.pips} (${event.pipRange.usdRange})

💡 <b>ບົດວິເຄາະສະບັບເຂົ້າໃຈງ່າຍ:</b>
${isBeat 
  ? 'ຕະຫຼາດແຮງງານ/ເສດຖະກິດແຂງແກ່ນເກີນຄາດ ເຮັດໃຫ້ Fed ຍັງບໍ່ຮີບຮ້ອນຫຼຸດດອກເບ້ຍ (Hawkish Hold) ເຊິ່ງຈະໜູນ USD ແຂງຄ່າ ແລະ ກົດດັນທອງຄຳໄລຍະສັ້ນ.' 
  : 'ຕົວເລກຊະລໍຕົວລົງ ເຮັດໃຫ້ຕະຫຼາດຄາດຫວັງວ່າ Fed ຈະຕ້ອງພິຈາລະນາຫຼຸດດອກເບ້ຍໄວຂຶ້ນ ເປັນປັດໄຈບວກໜູນລາຄາທອງຄຳທັນທີ.'}

🎯 <b>ແຜນເທຣດ (TRADE PLAYBOOK // XAU/USD):</b>
${isBeat 
  ? '• <b>Action:</b> ລະວັງການເທຂາຍຈົບຮອບ Wave A ແລ້ວມີແຮງຊື້ Rebound ຂຶ້ນເປັນ Wave B.\n• <b>Entry:</b> ລໍຖ້າລາຄາ Pullback ຂຶ້ນມາ Retest <b>EMA 50 (TF M5/M15)</b> ຖ້າບໍ່ຜ່ານໃຫ້ Sell ຕາມ, ຫຼື ລໍຖ້າດັກ Buy ຢູ່ແນວຮັບລຸ່ມສຸດ.\n• <b>Risk:</b> ຕັ້ງ Stop Loss ເໜືອ High ຂອງແທ່ງຂ່າວ!'
  : '• <b>Action:</b> Follow Buy ຕາມ Momentum ຂ່າວ (ລຸ້ນ New ATH).\n• <b>Entry:</b> ລໍຖ້າແທ່ງທຽນ M5/M15 ຍໍ້ລົງມາແຕະ <b>EMA 20 ຫຼື EMA 50</b> ແລ້ວຢືນຢູ່ ຈຶ່ງເຂົ້າ Buy ຕາມ.\n• <b>Risk:</b> ຕັ້ງ Stop Loss ໃຕ້ເສັ້ນ EMA 50 ປະມານ 30-40 pips.'}
━━━━━━━━━━━━━━━━━━━━
🌐 <i>ລະບົບ MACRO TERMINAL AUTO-BROADCAST</i>`;
}

function parseNum(val) {
  if (!val || typeof val !== 'string') return null;
  const clean = val.replace(/[%KM,]/g, '').trim();
  const num = parseFloat(clean);
  return isNaN(num) ? null : num;
}

function formatLaoGMT7(dateInput) {
  try {
    if (!dateInput) return { dateStr: '--', timeStr: '--', isoString: null };
    const dateObj = new Date(dateInput);
    if (isNaN(dateObj.getTime())) return { dateStr: dateInput, timeStr: '', isoString: null };

    const optDate = { timeZone: 'Asia/Bangkok', weekday: 'short', day: 'numeric', month: 'short' };
    const optTime = { timeZone: 'Asia/Bangkok', hour: '2-digit', minute: '2-digit', hour12: false };

    const dateStr = new Intl.DateTimeFormat('lo-LA', optDate).format(dateObj);
    const timeStr = new Intl.DateTimeFormat('lo-LA', optTime).format(dateObj) + ' (GMT+7)';
    return { dateStr, timeStr, isoString: dateObj.toISOString() };
  } catch (e) {
    return { dateStr: dateInput, timeStr: '', isoString: null };
  }
}

function getExpectedPipRange(title) {
  const t = title.toLowerCase();
  if (t.includes('non-farm') || t.includes('payrolls')) return { pips: '150 - 300 pips', usdRange: '$15 - $30' };
  if (t.includes('cpi') || t.includes('pce')) return { pips: '120 - 250 pips', usdRange: '$12 - $25' };
  if (t.includes('fomc') || t.includes('fed funds')) return { pips: '200 - 400 pips', usdRange: '$20 - $40' };
  return { pips: '80 - 160 pips', usdRange: '$8 - $16' };
}

function calculateEventImpact(e) {
  const actual = e.actualNum;
  const forecast = e.forecastNum;
  const t = e.title.toLowerCase();

  let isHawkish = true;
  if (actual !== null && forecast !== null) {
    if (t.includes('unemployment') || t.includes('claims')) isHawkish = actual < forecast;
    else isHawkish = actual >= forecast;
  }

  return {
    isHawkish,
    usdImpact: isHawkish ? 'BULLISH ↑' : 'BEARISH ↓',
    goldImpact: isHawkish ? 'BEARISH ↓' : 'BULLISH ↑'
  };
}

// Track announced events to prevent duplicate broadcasts
let sentEventIds = new Set();

async function checkAndBroadcastNewReleases() {
  try {
    const res = await fetch(FF_THISWEEK, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    if (!res.ok) return;
    const events = await res.json();

    const highImpactUSD = events.filter(e => e.country === 'USD' && e.impact === 'High');

    for (const e of highImpactUSD) {
      const isReleased = Boolean(e.actual && e.actual.trim() !== '');
      const eventKey = `${e.title}_${e.date}_${e.actual}`;

      if (isReleased && !sentEventIds.has(eventKey)) {
        const { dateStr, timeStr } = formatLaoGMT7(e.date);
        const actualNum = parseNum(e.actual);
        const forecastNum = parseNum(e.forecast);

        const processedEvent = {
          title: e.title,
          dateGMT7: dateStr,
          timeGMT7: timeStr,
          actual: e.actual,
          forecast: e.forecast || '--',
          previous: e.previous || '--',
          pipRange: getExpectedPipRange(e.title),
          marketImpact: calculateEventImpact({ title: e.title, actualNum, forecastNum })
        };

        const msg = formatFlashReleaseAlert(processedEvent);
        console.log(`[Telegram Auto-Broadcast]: Sending alert for ${e.title}...`);
        await sendTelegramAlert(msg);
        sentEventIds.add(eventKey);
      }
    }
  } catch (err) {
    console.error('[Broadcast Check Error]:', err.message);
  }
}

// Auto-check every 30 seconds
setInterval(checkAndBroadcastNewReleases, 30 * 1000);

// =========================================================================
// API ROUTES
// =========================================================================

app.get('/api/macro-full-feed', async (req, res) => {
  try {
    const [res1, res2] = await Promise.all([
      fetch(FF_THISWEEK, { headers: { 'User-Agent': 'Mozilla/5.0' } }),
      fetch(FF_NEXTWEEK, { headers: { 'User-Agent': 'Mozilla/5.0' } })
    ]);

    const data1 = res1.ok ? await res1.json() : [];
    const data2 = res2.ok ? await res2.json() : [];
    const allEvents = [...data1, ...data2];

    const highAndMed = allEvents.filter(e => e.country === 'USD' && (e.impact === 'High' || e.impact === 'Medium'));
    const released = [];
    const upcoming = [];

    highAndMed.forEach(e => {
      const { dateStr, timeStr, isoString } = formatLaoGMT7(e.date);
      const actualNum = parseNum(e.actual);
      const forecastNum = parseNum(e.forecast);
      const isReleased = Boolean(e.actual && e.actual.trim() !== '');

      const item = {
        title: e.title,
        impact: e.impact,
        dateGMT7: dateStr,
        timeGMT7: timeStr,
        isoString,
        actual: e.actual || null,
        actualNum,
        forecast: e.forecast || '--',
        forecastNum,
        previous: e.previous || '--',
        isReleased,
        pipRange: getExpectedPipRange(e.title),
        marketImpact: calculateEventImpact({ title: e.title, actualNum, forecastNum })
      };

      if (isReleased) released.push(item);
      else upcoming.push(item);
    });

    const nextUpcomingEvent = upcoming.find(e => e.impact === 'High') || upcoming[0];
    const highImpactList = highAndMed.filter(e => e.impact === 'High');

    const tradePlaybook = {
      targetEvent: nextUpcomingEvent?.title || 'High Impact Event',
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

    const currencyHeatmap = [
      { pair: 'USD (US Dollar)', score: '+8.2', status: 'STRONG BULLISH', color: 'text-primary bg-primary/10 border-primary/30', desc: 'ແຂງຄ່າຈາກດອກເບ້ຍສູງ & ແຮງງານແຂງແກ່ນ' },
      { pair: 'XAU (Gold)', score: '+5.5', status: 'HEDGE DEMAND', color: 'text-yellow-400 bg-yellow-400/10 border-yellow-400/30', desc: 'ມີແຮງຊື້ປ້ອງກັນຄວາມສ່ຽງເງິນເຟີ້ & ພາສີ' },
      { pair: 'EUR (Euro)', score: '-3.8', status: 'WEAK', color: 'text-error bg-error/10 border-error/30', desc: 'ຖືກກົດດັນຈາກການຫຼຸດດອກເບ້ຍ ECB' },
      { pair: 'GBP (Pound)', score: '+1.2', status: 'NEUTRAL', color: 'text-white bg-surface-container border-outline-variant', desc: 'ຊົງຕົວຕາມເງິນເຟີ້ອັງກິດ' },
      { pair: 'JPY (Yen)', score: '-6.5', status: 'VERY WEAK', color: 'text-error bg-error/10 border-error/30', desc: 'ດອກເບ້ຍຕ່າງກັນຫຼາຍທຽບກັບ USD' }
    ];

    const plainDigest = {
      bigPictureSummary: `ເສດຖະກິດສະຫະລັດຍັງແຂງແກ່ນຈາກຕະຫຼາດແຮງງານ ເຮັດໃຫ້ກຳລັງຊື້ຍັງບໍ່ຕົກ ເຖິງແມ່ນວ່າພາກໂຮງງານ ISM ຈະຊະລໍຕົວລົງຈາກຕົ້ນທຶນພາສີນຳເຂົ້າ. ພາບລວມຄື: ເສດຖະກິດຍັງແລ່ນໄດ້ດີ ແຕ່ກຳລັງຖືກທົດສອບດ້ວຍເງິນເຟີ້ ແລະ ດອກເບ້ຍສູງ.`,
      plainQA: [
        { q: "1. ເສດຖະກິດກຳລັງຈະໄປທິດທາງໃດ?", badge: "ທົນທານ (RESILIENT)", color: "text-primary border-primary/40 bg-primary/10", ans: "ເສດຖະກິດຢູ່ໃນພາວະ Soft Landing. ຄົນຍັງມີວຽກເຮັດງານທຳ ແລະ ຍັງຈັບຈ່າຍໃຊ້ສອຍໄດ້." },
        { q: "2. Fed ຈະເຮັດແນວໃດຕໍ່ກັບດອກເບ້ຍ?", badge: "ຄົງດອກເບ້ຍສູງ (HOLD RATE)", color: "text-tertiary border-tertiary/40 bg-tertiary/10", ans: "Fed ຈະຍັງບໍ່ຮີບຮ້ອນຫຼຸດດອກເບ້ຍ ເພື່ອຄຸມເງິນເຟີ້ໃຫ້ຢູ່ໝັດ." },
        { q: "3. ຜົນກະທົບຕໍ່ ໂດລາ, ທອງຄຳ ແລະ ນ້ຳມັນ?", badge: "MARKET IMPACT", color: "text-primary border-primary/40 bg-primary/10", ans: "• USD: ແຂງຄ່າ\n• ທອງຄຳ: ຖືກກົດດັນໄລຍະສັ້ນ ແຕ່ລຸ້ນ Rebound (ATH)\n• ນ້ຳມັນ: ລາຄາຍັງຊົງຕົວລະດັບຕ່ຳ." }
      ],
      thermometer: {
        labor: { status: "ແຂງແກ່ນ (STRONG)", desc: "ການຈ້າງງານຍັງເພີ່ມຂຶ້ນດີ", level: 80 },
        inflation: { status: "ຍັງໜຽວ (STICKY)", desc: "ເງິນເຟີ້ຍັງສູງກວ່າເປົ້າໝາຍ 2%", level: 75 },
        manufacturing: { status: "ຊະລໍຕົວ (COOLING)", desc: "ISM < 50% ຫົດຕົວ", level: 45 }
      }
    };

    const now = new Date();
    res.json({
      success: true,
      data: {
        currentCycleLao: `ຮອບຂໍ້ມູນ Live Sync: ${new Intl.DateTimeFormat('lo-LA', { dateStyle: 'full', timeStyle: 'short', timeZone: 'Asia/Bangkok' }).format(now)}`,
        nextUpcomingEvent,
        tradePlaybook,
        currencyHeatmap,
        highImpactList,
        plainDigest,
        allMediumAndHighCalendar: [...released, ...upcoming]
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Test Broadcast Endpoint
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
  const success = await sendTelegramAlert(msg);
  res.json({ success, message: success ? 'ສົ່ງຂໍ້ຄວາມເຂົ້າ Telegram ສຳເລັດແລ້ວ!' : 'ສົ່ງບໍ່ສຳເລັດ ກະລຸນາກວດສອບ Bot Token ແລະ Chat ID' });
});

app.listen(PORT, () => {
  console.log(`=======================================================`);
  console.log(`🚀 MACRO TERMINAL SERVER: http://localhost:${PORT}`);
  console.log(`🤖 Telegram Bot: ACTIVE (Chat ID: ${TELEGRAM_CHAT_ID})`);
  console.log(`=======================================================`);
});
