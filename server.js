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

// Calculate Volatility & Pip Range for each event type
function getExpectedPipRange(title) {
  const t = title.toLowerCase();
  if (t.includes('non-farm') || t.includes('payrolls')) return { pips: '150 - 300 pips', usdRange: '$15 - $30', level: 'EXTREME' };
  if (t.includes('cpi') || t.includes('pce')) return { pips: '120 - 250 pips', usdRange: '$12 - $25', level: 'VERY HIGH' };
  if (t.includes('fomc') || t.includes('fed funds')) return { pips: '200 - 400 pips', usdRange: '$20 - $40', level: 'MAXIMUM' };
  if (t.includes('gdp') || t.includes('retail sales')) return { pips: '80 - 160 pips', usdRange: '$8 - $16', level: 'HIGH' };
  return { pips: '40 - 90 pips', usdRange: '$4 - $9', level: 'MODERATE' };
}

// Calculate Real-time Impact Tag on USD and Gold
function calculateEventImpact(e) {
  const isReleased = Boolean(e.actual && e.actual.trim() !== '');
  const actual = e.actualNum;
  const forecast = e.forecastNum;
  const t = e.title.toLowerCase();

  // If not released yet, predict from typical Hawkish beat
  let isHawkish = true;
  if (isReleased && actual !== null && forecast !== null) {
    if (t.includes('unemployment') || t.includes('claims')) {
      isHawkish = actual < forecast; // Lower unemployment = Hawkish
    } else {
      isHawkish = actual >= forecast; // Higher NFP/CPI/GDP = Hawkish
    }
  }

  return {
    isHawkish,
    usdImpact: isHawkish ? 'BULLISH ↑' : 'BEARISH ↓',
    usdColor: isHawkish ? 'text-primary bg-primary/10 border-primary/30' : 'text-error bg-error/10 border-error/30',
    goldImpact: isHawkish ? 'BEARISH ↓' : 'BULLISH ↑',
    goldColor: isHawkish ? 'text-error bg-error/10 border-error/30' : 'text-primary bg-primary/10 border-primary/30'
  };
}

// Transmission node builder
function buildEventTransmissionModel(evt) {
  const t = evt.title.toLowerCase();
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
      above: { title: `ABOVE EXPECTATION (> ${evt.forecast})`, state: 'Hawkish Bias', usd: '↑', gold: '↓' },
      inline: { title: `IN LINE (${evt.forecast})`, state: 'Neutral / Holds', usd: '—', gold: '—' },
      below: { title: `BELOW EXPECTATION (< ${evt.forecast})`, state: 'Dovish Shift', usd: '↓', gold: '↑' }
    }
  };
}

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
      const previousNum = parseNum(e.previous);
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
        previousNum,
        isReleased,
        pipRange: getExpectedPipRange(e.title),
        marketImpact: calculateEventImpact({ title: e.title, actualNum, forecastNum, actual: e.actual })
      };

      if (isReleased) released.push(item);
      else upcoming.push(item);
    });

    const highImpactList = highAndMed.filter(e => e.impact === 'High').map(e => {
      const { dateStr, timeStr, isoString } = formatLaoGMT7(e.date);
      return {
        title: e.title,
        impact: e.impact,
        dateGMT7: dateStr,
        timeGMT7: timeStr,
        isoString,
        forecast: e.forecast || '--',
        previous: e.previous || '--',
        isReleased: Boolean(e.actual && e.actual.trim() !== ''),
        pipRange: getExpectedPipRange(e.title),
        transmissionModel: buildEventTransmissionModel({ title: e.title, forecast: e.forecast || '--' })
      };
    });

    // Find next upcoming high impact event for Countdown Timer
    const nextUpcomingEvent = upcoming.find(e => e.impact === 'High') || upcoming[0] || highImpactList[0];

    // Currency Strength Heatmap Data
    const currencyHeatmap = [
      { pair: 'USD (US Dollar)', score: '+8.2', status: 'STRONG BULLISH', color: 'text-primary bg-primary/10 border-primary/30', desc: 'ແຂງຄ່າຈາກດອກເບ້ຍສູງ & NFP แขງແກ່ນ' },
      { pair: 'XAU (Gold)', score: '+5.5', status: 'HEDGE DEMAND', color: 'text-yellow-400 bg-yellow-400/10 border-yellow-400/30', desc: 'ມີແຮງຊື້ປ້ອງກັນຄວາມສ່ຽງເງິນເຟີ້ & ພາສີ' },
      { pair: 'EUR (Euro)', score: '-3.8', status: 'WEAK', color: 'text-error bg-error/10 border-error/30', desc: 'ຖືກກົດດັນຈາກການຫຼຸດດອກເບ້ຍ ECB' },
      { pair: 'GBP (Pound)', score: '+1.2', status: 'NEUTRAL', color: 'text-white bg-surface-container border-outline-variant', desc: 'ຊົງຕົວຕາມເງິນເຟີ້ອັງກິດ' },
      { pair: 'JPY (Yen)', score: '-6.5', status: 'VERY WEAK', color: 'text-error bg-error/10 border-error/30', desc: 'ດອກເບ້ຍຕ່າງກັນຫຼາຍທຽບກັບ USD' }
    ];

    // Trade Playbook Matrix
    const tradePlaybook = {
      targetEvent: nextUpcomingEvent?.title || 'High Impact Event',
      scenarios: [
        {
          caseTitle: 'ກໍລະນີທີ 1: ຕົວເລກອອກມາສູງກວ່າຄາດ (BEAT - Hawkish)',
          tag: 'HAWKISH BEAT',
          tagColor: 'text-primary border-primary bg-primary/10',
          planGold: 'Sell Gold ຕາມ Momentum ໄລຍະສັ້ນ ຫຼື ລໍຖ້າດັກ Buy ຢູ່ແນວຮັບ Wave A bottom ເພື່ອລຸ້ນ Rebound.',
          planUSD: 'Buy USD ຕາມແຮງໜູນດອກເບ້ຍ Fed.',
          riskNote: 'ລະວັງ Spread ຖ່າງ ແລະ ຄວາມຜັນຜວນໃນ 5 ນາທີທຳອິດ.'
        },
        {
          caseTitle: 'ກໍລະນີທີ 2: ຕົວເລກອອກມາຕ່ຳກວ່າຄາດ (MISS - Dovish)',
          tag: 'DOVISH MISS',
          tagColor: 'text-error border-error bg-error/10',
          planGold: 'Buy Gold ທັນທີ! ເປົ້າໝາຍທົດສອບແນວຕ້ານ ATH (New High) ຍ້ອນຕະຫຼາດເລັ່ງຕອບຮັບການຫຼຸດດອກເບ້ຍ.',
          planUSD: 'Sell USD ຍ້ອນຜົນຕອບແທນພັນທະບັດຫຼຸດລົງ.',
          riskNote: 'ຕັ້ງ Stop Loss ໃຕ້ແນວຮັບຫຼ້າສຸດສະເໝີ.'
        },
        {
          caseTitle: 'ກໍລະນີທີ 3: ຕົວເລກອອກມາຕາມຄາດ (IN-LINE - Neutral)',
          tag: 'NEUTRAL IN-LINE',
          tagColor: 'text-tertiary border-tertiary bg-tertiary/10',
          planGold: 'ລະວັງ Fakeout (ລາຄາສະບັດໄປກິນ Stop Loss ທັງສອງຝັ່ງ), ແນະນຳລໍຖ້າໃຫ້ຕະຫຼາດເລືອກທາງຫຼັງ 15 ນາທີ.',
          planUSD: 'ຕະຫຼາດຈະ Sideway ໃນກອບ.',
          riskNote: 'ຫຼີກລ່ຽງການເປີດ Lot ໃຫຍ່ໃນຊ່ວງຂ່າວອອກຕາມຄາດ.'
        }
      ]
    };

    // Plain Digest & Predictions
    const plainDigest = {
      bigPictureSummary: `ເສດຖະກິດສະຫະລັດຍັງແຂງແກ່ນຈາກຕະຫຼາດແຮງງານ ເຮັດໃຫ້ກຳລັງຊື້ຍັງບໍ່ຕົກ ເຖິງແມ່ນວ່າພາກໂຮງງານ/ການຜະລິດ ISM ຈະຊະລໍຕົວລົງຈາກຕົ້ນທຶນພາສີນຳເຂົ້າ. ພາບລວມຄື: ເສດຖະກິດຍັງແລ່ນໄດ້ດີ ແຕ່ກຳລັງຖືກທົດສອບດ້ວຍເງິນເຟີ້ ແລະ ດອກເບ້ຍສູງ.`,
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

app.listen(PORT, () => {
  console.log(`🚀 MACRO TERMINAL RUNNING ON http://localhost:${PORT}`);
});
