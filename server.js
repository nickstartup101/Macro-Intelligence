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

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '8827536113:AAGmERJjiA-3Qom2dEhUWG0F9Qo9KGmFJA0';
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID || '5836921658';

function parseNum(val) {
  if (!val || typeof val !== 'string') return null;
  const clean = val.replace(/[%KM,]/g, '').trim();
  const num = parseFloat(clean);
  return isNaN(num) ? null : num;
}

// 🕒 Accurate Time Converter: Forex Factory ISO string -> GMT+7 (Asia/Bangkok/Vientiane)
function formatForexFactoryDate(isoString) {
  try {
    if (!isoString) return { dateStr: '--', timeStr: '--', timestamp: 0 };
    const dateObj = new Date(isoString);
    if (isNaN(dateObj.getTime())) return { dateStr: '--', timeStr: '--', timestamp: 0 };

    const optDate = { timeZone: 'Asia/Bangkok', weekday: 'short', day: 'numeric', month: 'short' };
    const optTime = { timeZone: 'Asia/Bangkok', hour: '2-digit', minute: '2-digit', hour12: false };

    const dateStr = new Intl.DateTimeFormat('lo-LA', optDate).format(dateObj);
    const timeStr = new Intl.DateTimeFormat('en-GB', optTime).format(dateObj) + ' (GMT+7)';

    return {
      dateStr,
      timeStr,
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
  if (t.includes('gdp') || t.includes('retail sales')) return { pips: '80 - 160 pips', usdRange: '$8 - $16' };
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

  const fc = evt.forecast || '0.2%';
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

// Telegram Broadcaster
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
    return json.ok;
  } catch (err) {
    return false;
  }
}

// Real-time API Router
app.get('/api/macro-full-feed', async (req, res) => {
  try {
    const [res1, res2] = await Promise.all([
      fetch(FF_THISWEEK, { headers: { 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(5000) }),
      fetch(FF_NEXTWEEK, { headers: { 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(5000) })
    ]);

    const data1 = res1.ok ? await res1.json() : [];
    const data2 = res2.ok ? await res2.json() : [];
    const allEvents = [...data1, ...data2];

    // Filter ONLY USD + High & Medium Impact
    const filteredUSD = allEvents.filter(e => e.country === 'USD' && (e.impact === 'High' || e.impact === 'Medium'));

    const processedEvents = filteredUSD.map(e => {
      const { dateStr, timeStr, timestamp, isoString } = formatForexFactoryDate(e.date);
      const actualNum = parseNum(e.actual);
      const forecastNum = parseNum(e.forecast);
      const previousNum = parseNum(e.previous);
      const isReleased = Boolean(e.actual && String(e.actual).trim() !== '');

      return {
        title: e.title,
        impact: e.impact, // 'High' or 'Medium'
        dateGMT7: dateStr,
        timeGMT7: timeStr,
        timestamp,
        isoString,
        actual: isReleased ? e.actual : null, // If not released, strictly null
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

    // Sort chronologically by real event release time
    processedEvents.sort((a, b) => a.timestamp - b.timestamp);

    const highImpactList = processedEvents.filter(e => e.impact === 'High');
    const displayHighImpactList = highImpactList.length > 0 ? highImpactList : processedEvents.slice(0, 6);

    const nowTime = Date.now();
    const upcomingEvents = processedEvents.filter(e => e.timestamp > nowTime || !e.isReleased);
    const activeEvent = upcomingEvents.find(e => e.impact === 'High') || upcomingEvents[0] || displayHighImpactList[0];

    // Currency Strength Heatmap
    const currencyHeatmap = [
      { pair: 'USD (US Dollar)', score: '+8.2', status: 'STRONG BULLISH', color: 'text-primary bg-primary/10 border-primary/30', desc: 'ແຂງຄ່າຈາກດອກເບ້ຍສູງ & ຕະຫຼາດແຮງງານແຂງແກ່ນ' },
      { pair: 'XAU (Gold)', score: '+5.5', status: 'HEDGE DEMAND', color: 'text-yellow-400 bg-yellow-400/10 border-yellow-400/30', desc: 'ມີແຮງຊື້ປ້ອງກັນຄວາມສ່ຽງເງິນເຟີ້ & ພາສີ' },
      { pair: 'EUR (Euro)', score: '-3.8', status: 'WEAK', color: 'text-error bg-error/10 border-error/30', desc: 'ຖືກກົດດັນຈາກການຫຼຸດດອກເບ້ຍ ECB' },
      { pair: 'GBP (Pound)', score: '+1.2', status: 'NEUTRAL', color: 'text-white bg-surface-container border-outline-variant', desc: 'ຊົງຕົວຕາມເງິນເຟີ້ອັງກິດ' },
      { pair: 'JPY (Yen)', score: '-6.5', status: 'VERY WEAK', color: 'text-error bg-error/10 border-error/30', desc: 'ດອກເບ້ຍຕ່າງກັນຫຼາຍທຽບກັບ USD' }
    ];

    // Trade Playbook
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

    // Plain Macro Digest
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

// Test Telegram Broadcast
app.post('/api/test-telegram', async (req, res) => {
  try {
    const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
    const resTg = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: TELEGRAM_CHAT_ID,
        text: `🚨 <b>[TEST ALERT] ລະບົບ MACRO TERMINAL ເຊື່ອມຕໍ່ສຳເລັດ!</b>\n━━━━━━━━━━━━━━━━━━━━\n📊 <b>ຂ່າວ:</b> Forex Factory Live Ingestion\n⏰ <b>ເວລາ:</b> GMT+7 (ໂມງລາວ)\n🎯 <b>ສະຖານະ:</b> ລະບົບພ້ອມຍິງຂ່າວດ່ວນ ແລະ ແຜນເທຣດ 24/7!`,
        parse_mode: 'HTML'
      })
    });
    const jsonTg = await resTg.json();
    res.json({ success: jsonTg.ok, message: jsonTg.ok ? 'ສົ່ງຂໍ້ຄວາມເຂົ້າ Telegram ສຳເລັດແລ້ວ!' : jsonTg.description });
  } catch (err) {
    res.json({ success: false, message: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 MACRO TERMINAL RUNNING ON http://localhost:${PORT}`);
});
