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
    if (!dateInput) return { dateStr: '--', timeStr: '--' };
    const dateObj = new Date(dateInput);
    if (isNaN(dateObj.getTime())) return { dateStr: dateInput, timeStr: '' };

    const optDate = { timeZone: 'Asia/Bangkok', weekday: 'short', day: 'numeric', month: 'short' };
    const optTime = { timeZone: 'Asia/Bangkok', hour: '2-digit', minute: '2-digit', hour12: false };

    const dateStr = new Intl.DateTimeFormat('lo-LA', optDate).format(dateObj);
    const timeStr = new Intl.DateTimeFormat('lo-LA', optTime).format(dateObj) + ' (GMT+7)';
    return { dateStr, timeStr };
  } catch (e) {
    return { dateStr: dateInput, timeStr: '' };
  }
}

// Build Dynamic Transmission Data for any High-Impact Event
function buildEventTransmissionModel(evt) {
  const t = evt.title.toLowerCase();
  let eventType = 'INFLATION';
  let node1Name = 'INFLATION DATA';
  let node1Icon = 'price_change';
  let node2Name = 'FED RATE BIAS';
  let node3Name = 'REAL YIELDS';
  let node4Name = '10Y YIELD';
  let node5Name = 'GOLD (XAU)';

  let scenarioAbove = { title: `ABOVE EXPECTATION (> ${evt.forecast})`, state: 'Hawkish Pressures', hawkish: true, usd: '↑', gold: '↓' };
  let scenarioInline = { title: `IN LINE (${evt.forecast})`, state: 'Neutral / Holds', hawkish: false, usd: '—', gold: '—' };
  let scenarioBelow = { title: `BELOW EXPECTATION (< ${evt.forecast})`, state: 'Dovish Relief', hawkish: false, usd: '↓', gold: '↑' };

  if (t.includes('employment') || t.includes('payrolls') || t.includes('adp') || t.includes('labor')) {
    eventType = 'LABOR';
    node1Name = 'LABOR MKT';
    node1Icon = 'engineering';
    node2Name = 'FED BIAS';
    node3Name = 'USD/YIELD';
    node4Name = '10Y YIELD';
    node5Name = 'GOLD';
    scenarioAbove = { title: `ABOVE EXPECTATION (> ${evt.forecast})`, state: 'Strong Labor State', hawkish: true, usd: '↑', gold: '↓' };
    scenarioInline = { title: `IN LINE (${evt.forecast})`, state: 'Neutral State', hawkish: false, usd: '—', gold: '—' };
    scenarioBelow = { title: `BELOW EXPECTATION (< ${evt.forecast})`, state: 'Weak Labor State', hawkish: false, usd: '↓', gold: '↑' };
  } else if (t.includes('gdp') || t.includes('sales') || t.includes('pmi')) {
    eventType = 'GROWTH';
    node1Name = 'GDP GROWTH';
    node1Icon = 'trending_up';
    node2Name = 'RECESSION RISK';
    node3Name = 'BOND YIELDS';
    node4Name = 'USD INDEX';
    node5Name = 'GOLD & EQUITIES';
    scenarioAbove = { title: `ABOVE EXPECTATION (> ${evt.forecast})`, state: 'Expanding Economy', hawkish: true, usd: '↑', gold: '↓' };
    scenarioInline = { title: `IN LINE (${evt.forecast})`, state: 'Soft Landing', hawkish: false, usd: '—', gold: '—' };
    scenarioBelow = { title: `BELOW EXPECTATION (< ${evt.forecast})`, state: 'Contraction Risk', hawkish: false, usd: '↓', gold: '↑' };
  }

  return {
    eventType,
    nodes: [
      { name: node1Name, icon: node1Icon },
      { name: node2Name, icon: 'account_balance' },
      { name: node3Name, icon: 'payments' },
      { name: node4Name, icon: 'show_chart' },
      { name: node5Name, icon: 'diamond' }
    ],
    scenarios: {
      above: scenarioAbove,
      inline: scenarioInline,
      below: scenarioBelow
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

    const highImpactUSD = allEvents.filter(e => e.country === 'USD' && e.impact === 'High');

    const highImpactList = highImpactUSD.map(e => {
      const { dateStr, timeStr } = formatLaoGMT7(e.date);
      const item = {
        title: e.title,
        impact: e.impact,
        dateGMT7: dateStr,
        timeGMT7: timeStr,
        actual: e.actual || null,
        actualNum: parseNum(e.actual),
        forecast: e.forecast || '--',
        previous: e.previous || '--',
        isReleased: Boolean(e.actual && e.actual.trim() !== '')
      };
      return {
        ...item,
        transmissionModel: buildEventTransmissionModel(item)
      };
    });

    // Select primary active event (Upcoming Core PCE / GDP / or latest NFP)
    const activeEvent = highImpactList.find(e => !e.isReleased) || highImpactList[0] || {
      title: "Core PCE Price Index m/m",
      forecast: "0.2%",
      previous: "0.1%",
      dateGMT7: "ວັນພຸດ",
      timeGMT7: "19:30 (GMT+7)",
      transmissionModel: buildEventTransmissionModel({ title: "Core PCE Price Index m/m", forecast: "0.2%" })
    };

    // Macro Digest
    const plainDigest = {
      bigPictureSummary: `ເສດຖະກິດສະຫະລັດໃນຕອນນີ້ "ຍັງບໍ່ໄດ້ຖົດຖອຍ" ເພາະຄົນຍັງມີວຽກເຮັດງານທຳຫຼາຍ ແລະ ບໍລິສັດຍັງຈ້າງຄົນເພີ່ມ. ແຕ່ພາກໂຮງງານເລີ່ມຊະລໍຕົວລົງຍ້ອນຕົ້ນທຶນພາສີນຳເຂົ້າ. ພາບລວມຄື: ເສດຖະກິດຍັງແລ່ນໄດ້ດີ ແຕ່ກຳລັງຖືກທົດສອບດ້ວຍເງິນເຟີ້ ແລະ ດອກເບ້ຍສູງ.`,
      plainQA: [
        {
          q: "1. ເສດຖະກິດກຳລັງຈະໄປທິດທາງໃດ?",
          badge: "ທົນທານ / ຊົງຕົວດີ (RESILIENT)",
          color: "text-primary border-primary/40 bg-primary/10",
          ans: `ເສດຖະກິດຢູ່ໃນພາວະ "Soft Landing". ຄົນສ່ວນໃຫຍ່ຍັງມີລາຍໄດ້ ແລະ ຍັງຈັບຈ່າຍໃຊ້ສອຍໄດ້ຢູ່ ເຮັດໃຫ້ເສດຖະກິດຍັງບໍ່ຖົດຖອຍ.`
        },
        {
          q: "2. Fed ຈະເຮັດແນວໃດຕໍ່ກັບດອກເບ້ຍ?",
          badge: "ຄົງດອກເບ້ຍສູງຕໍ່ໄປ (HOLD RATE)",
          color: "text-tertiary border-tertiary/40 bg-tertiary/10",
          ans: `Fed ຈະ "ຍັງບໍ່ຮີບຮ້ອນຫຼຸດດອກເບ້ຍ" ເພາະເມື່ອແຮງງານຍັງແຂງແຮງ ເງິນເຟີ້ກໍຈະຍັງລົງຍາກ Fed ຈຶ່ງຕ້ອງຮັກສາດອກເບ້ຍສູງ (5.25% - 5.50%) ໄວ້ດົນກວ່າເກົ່າ.`
        },
        {
          q: "3. ຜົນກະທົບຕໍ່ ໂດລາ, ທອງຄຳ ແລະ ນ້ຳມັນ?",
          badge: "MARKET IMPACT",
          color: "text-primary border-primary/40 bg-primary/10",
          ans: `• USD: ແຂງຄ່າຂຶ້ນ ເພາະດອກເບ້ຍຍັງສູງ.\n• ທອງຄຳ (Gold): ຖືກກົດດັນໄລຍະສັ້ນ ແຕ່ມີແຮງຊື້ Rebound (ລຸ້ນ ATH ໃໝ່).\n• ນ້ຳມັນ: ລາຄາຍັງຊົງຕົວລະດັບຕ່ຳ.`
        }
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
        activeEvent,
        allHighImpactEvents: highImpactList,
        plainDigest
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 LIVE DYNAMIC TRANSMISSION SERVER: http://localhost:${PORT}`);
});
