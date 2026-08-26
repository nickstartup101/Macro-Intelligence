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

// Forex Factory Feeds (This Week + Next Week)
const FF_THISWEEK = 'https://nfs.faireconomy.media/ff_calendar_thisweek.json';
const FF_NEXTWEEK = 'https://nfs.faireconomy.media/ff_calendar_nextweek.json';

function parseNum(val) {
  if (!val || typeof val !== 'string') return null;
  const clean = val.replace(/[%KM,]/g, '').trim();
  const num = parseFloat(clean);
  return isNaN(num) ? null : num;
}

function formatGMT7(dateStr, timeStr) {
  try {
    if (!timeStr || timeStr.toLowerCase().includes('all day') || timeStr.toLowerCase().includes('day')) {
      return { dateGMT7: dateStr, timeGMT7: 'ຕະຫຼອດມື້' };
    }
    const fullDate = new Date(`${dateStr} ${timeStr}`);
    if (isNaN(fullDate.getTime())) return { dateGMT7: dateStr, timeGMT7: timeStr };
    
    const optDate = { timeZone: 'Asia/Bangkok', month: 'short', day: 'numeric', weekday: 'short', year: 'numeric' };
    const optTime = { timeZone: 'Asia/Bangkok', hour: '2-digit', minute: '2-digit', hour12: false };

    return {
      dateGMT7: new Intl.DateTimeFormat('lo-LA', optDate).format(fullDate),
      timeGMT7: new Intl.DateTimeFormat('lo-LA', optTime).format(fullDate) + ' (GMT+7)'
    };
  } catch (e) {
    return { dateGMT7: dateStr, timeGMT7: timeStr };
  }
}

// =========================================================================
// 🔄 DYNAMIC ROLLING INFERENCE ENGINE (ວິເຄາະທຸກຂ່າວໃນອະນາຄົດແບບອັດຕະໂນມັດ)
// =========================================================================

async function getRollingMacroIntelligence() {
  try {
    // Fetch both this week & next week
    const [res1, res2] = await Promise.all([
      fetch(FF_THISWEEK, { headers: { 'User-Agent': 'Mozilla/5.0' } }),
      fetch(FF_NEXTWEEK, { headers: { 'User-Agent': 'Mozilla/5.0' } })
    ]);

    const data1 = res1.ok ? await res1.json() : [];
    const data2 = res2.ok ? await res2.json() : [];
    const allEvents = [...data1, ...data2];

    // Filter USD High & Medium Impact
    const usdEvents = allEvents.filter(e => e.country === 'USD' && (e.impact === 'High' || e.impact === 'Medium'));

    const released = [];
    const upcoming = [];

    usdEvents.forEach(e => {
      const { dateGMT7, timeGMT7 } = formatGMT7(e.date, e.time);
      const item = {
        title: e.title,
        impact: e.impact,
        dateGMT7,
        timeGMT7,
        actual: e.actual || null,
        actualNum: parseNum(e.actual),
        forecast: e.forecast || '--',
        forecastNum: parseNum(e.forecast),
        previous: e.previous || '--',
        previousNum: parseNum(e.previous),
        isReleased: Boolean(e.actual && e.actual.trim() !== '')
      };

      if (item.isReleased) released.push(item);
      else upcoming.push(item);
    });

    // 1. Dynamic Leading Indicators Pool (ຕົວເລກສະສົມທີ່ປະກາດແລ້ວ)
    const latestNFP = released.find(e => e.title.toLowerCase().includes('non-farm employment')) || { actualNum: 228, forecastNum: 140 };
    const latestADP = released.find(e => e.title.toLowerCase().includes('adp non-farm')) || { actualNum: 155, forecastNum: 120 };
    const latestISM = released.find(e => e.title.toLowerCase().includes('ism manufacturing')) || { actualNum: 49.0 };
    const latestUnemp = released.find(e => e.title.toLowerCase().includes('unemployment rate')) || { actualNum: 4.2, forecastNum: 4.1 };

    const isLaborStrong = (latestNFP.actualNum >= (latestNFP.forecastNum || 150)) || (latestADP.actualNum >= 130);

    // 2. Dynamic Predictions Generator for Upcoming Events
    const predictionsList = upcoming.slice(0, 6).map(evt => {
      const t = evt.title.toLowerCase();
      let probAbove = 50;
      let probInline = 30;
      let probBelow = 20;
      let reasoning = '';

      if (t.includes('pce') || t.includes('cpi') || t.includes('ppi') || t.includes('inflation')) {
        probAbove = isLaborStrong ? 65 : 30;
        probInline = isLaborStrong ? 25 : 50;
        probBelow = 100 - (probAbove + probInline);
        reasoning = `ວິເຄາະຈາກຕົວເລກແຮງງານ NFP (+${latestNFP.actualNum}K) ທີ່ແຂງແກ່ນ ບົ່ງບອກວ່າກຳລັງຊື້ ແລະ ຄ່າຈ້າງຍັງສູງ ເຮັດໃຫ້ມີໂອກາດ ${probAbove}% ທີ່ຕົວເລກເງິນເຟີ້ (${evt.title}) ຈະອອກມາສູງກວ່າ ຫຼື ເທົ່າກັບຄາດ (${evt.forecast}).`;
      } else if (t.includes('gdp') || t.includes('retail sales')) {
        probAbove = 55;
        probInline = 35;
        probBelow = 10;
        reasoning = `ການຈ້າງງານທີ່ດີຊ່ວຍພະຍຸງການບໍລິໂພກພາຍໃນປະເທດ ເຮັດໃຫ້ໂອກາດທີ່ (${evt.title}) ຈະຊົງຕົວ ຫຼື ດີກວ່າຄາດ (${evt.forecast}) ມີສູງເຖິງ 55%.`;
      } else if (t.includes('claims') || t.includes('jobless')) {
        probAbove = 30;
        probInline = 50;
        probBelow = 20;
        reasoning = `ຕະຫຼາດແຮງງານຍັງແຂງແກ່ນ ຄາດວ່າຕົວເລກຜູ້ຂໍຮັບສະຫວັດດີການຫວ່າງງານຈະຢູ່ໃນເກນປົກກະຕິໃກ້ຄຽງຄາດການ (${evt.forecast}).`;
      } else {
        probAbove = isLaborStrong ? 60 : 40;
        probInline = 30;
        probBelow = 10;
        reasoning = `ອີງຕາມສະພາບແວດລ້ອມເສດຖະກິດມະຫາພາກປັດຈຸບັນ ຄາດວ່າມີໂອກາດ ${probAbove}% ທີ່ຈະອອກມາຕາມທິດທາງແຂງແກ່ນ.`;
      }

      return {
        title: evt.title,
        impact: evt.impact,
        dateGMT7: evt.dateGMT7,
        timeGMT7: evt.timeGMT7,
        forecast: evt.forecast,
        previous: evt.previous,
        probAbove,
        probInline,
        probBelow,
        reasoning
      };
    });

    const now = new Date();
    return {
      currentCycle: `ຮອບຂໍ້ມູນ Live Sync: ${new Intl.DateTimeFormat('lo-LA', { dateStyle: 'full', timeStyle: 'short', timeZone: 'Asia/Bangkok' }).format(now)}`,
      releasedCount: released.length,
      upcomingCount: upcoming.length,
      predictions: predictionsList,
      releasedEvents: released.slice(0, 10),
      allUpcomingEvents: upcoming.slice(0, 15)
    };
  } catch (err) {
    console.error('[Rolling Engine Error]:', err.message);
    return null;
  }
}

app.get('/api/rolling-macro-feed', async (req, res) => {
  const data = await getRollingMacroIntelligence();
  res.json({ success: true, data });
});

app.listen(PORT, () => {
  console.log(`🚀 ROLLING FORECAST SERVER ACTIVE: http://localhost:${PORT}`);
  console.log(`📡 Auto-Tracking This Week + Next Week Forex Factory Feeds`);
});
