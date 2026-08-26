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

app.get('/api/macro-full-feed', async (req, res) => {
  try {
    const [res1, res2] = await Promise.all([
      fetch(FF_THISWEEK, { headers: { 'User-Agent': 'Mozilla/5.0' } }),
      fetch(FF_NEXTWEEK, { headers: { 'User-Agent': 'Mozilla/5.0' } })
    ]);

    const data1 = res1.ok ? await res1.json() : [];
    const data2 = res2.ok ? await res2.json() : [];
    const allEvents = [...data1, ...data2];

    const usdEvents = allEvents.filter(e => e.country === 'USD' && (e.impact === 'High' || e.impact === 'Medium'));

    const released = [];
    const upcoming = [];

    usdEvents.forEach(e => {
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

      if (item.isReleased) released.push(item);
      else upcoming.push(item);
    });

    // Extract dynamic baseline
    const nfp = released.find(e => e.title.toLowerCase().includes('non-farm employment')) || { actual: '228K', actualNum: 228 };
    const ism = released.find(e => e.title.toLowerCase().includes('ism manufacturing')) || { actual: '49.0%', actualNum: 49.0 };
    const unemp = released.find(e => e.title.toLowerCase().includes('unemployment rate')) || { actual: '4.2%', actualNum: 4.2 };

    const isLaborStrong = nfp.actualNum >= 170;

    // 1. Plain Digest Data
    const bigPictureSummary = isLaborStrong
      ? `ເສດຖະກິດສະຫະລັດໃນຕອນນີ້ "ຍັງບໍ່ໄດ້ຖົດຖອຍ" ເພາະຄົນຍັງມີວຽກເຮັດງານທຳຫຼາຍ ແລະ ບໍລິສັດຍັງຈ້າງຄົນເພີ່ມ (NFP ${nfp.actual}). ແຕ່ພາກໂຮງງານ/ການຜະລິດ (ISM ${ism.actual}) ເລີ່ມຊະລໍຕົວລົງຍ້ອນຕົ້ນທຶນພາສີນຳເຂົ້າ. ພາບລວມຄື: ເສດຖະກິດຍັງແລ່ນໄດ້ດີ ແຕ່ກຳລັງຖືກທົດສອບດ້ວຍເງິນເຟີ້ ແລະ ດອກເບ້ຍສູງ.`
      : `ເສດຖະກິດເລີ່ມສົ່ງສັນຍານ "ຊະລໍຕົວຊັດເຈນຂຶ້ນ" ທັງໃນພາກການຈ້າງງານ ແລະ ພາກການຜະລິດ, ເຮັດໃຫ້ຄວາມສ່ຽງເສດຖະກິດຖົດຖອຍເລີ່ມເພີ່ມຂຶ້ນ.`;

    const plainQA = [
      {
        q: "1. ເສດຖະກິດກຳລັງຈະໄປທິດທາງໃດ? (ດີຂຶ້ນ ຫຼື ແຍ່ລົງ?)",
        badge: isLaborStrong ? "ທົນທານ / ຊົງຕົວດີ (RESILIENT)" : "ຊະລໍຕົວ (COOLING)",
        color: isLaborStrong ? "text-primary border-primary/40 bg-primary/10" : "text-error border-error/40 bg-error/10",
        ans: `ເສດຖະກິດຢູ່ໃນພາວະ "ຂະຫຍາຍຕົວແບບປະຄອງຕົວ (Soft Landing)". ເຖິງວ່າໂຮງງານຈະຜະລິດເຄື່ອງໜ້ອຍລົງຍ້ອນຕົ້ນທຶນພາສີ, ແຕ່ປະຊາຊົນສ່ວນໃຫຍ່ຍັງມີລາຍໄດ້ ແລະ ຍັງຈັບຈ່າຍໃຊ້ສອຍໄດ້ຢູ່ ເຮັດໃຫ້ເສດຖະກິດຍັງບໍ່ພັງ.`
      },
      {
        q: "2. ທະນາຄານກາງ Fed ຈະເຮັດແນວໃດຕໍ່ກັບດອກເບ້ຍ?",
        badge: "ຄົງດອກເບ້ຍສູງຕໍ່ໄປ (HOLD RATE)",
        color: "text-tertiary border-tertiary/40 bg-tertiary/10",
        ans: `Fed ຈະ "ຍັງບໍ່ຮີບຮ້ອນຫຼຸດດອກເບ້ຍ" ເພາະເມື່ອຄົນຍັງມີວຽກເຮັດຫຼາຍ ເງິນເຟີ້ກໍຈະຍັງລົງຍາກ. Fed ຈຶ່ງຕ້ອງຮັກສາດອກເບ້ຍສູງ (5.25% - 5.50%) ໄວ້ດົນກວ່າເກົ່າ ເພື່ອບໍ່ໃຫ້ເຂົ້າຂອງແພງຂຶ້ນອີກ.`
      },
      {
        q: "3. ຜົນກະທົບຕໍ່ ເງິນໂດລາ, ທອງຄຳ ແລະ ນ້ຳມັນ?",
        badge: "MARKET IMPACT",
        color: "text-primary border-primary/40 bg-primary/10",
        ans: `• ເງິນໂດລາ (USD): ແຂງຄ່າຂຶ້ນ ເພາະດອກເບ້ຍຍັງສູງ.\n• ທອງຄຳ (Gold): ຖືກກົດດັນໄລຍະສັ້ນ ແຕ່ມີແຮງຊື້ Rebound ຂຶ້ນຕໍ່ (ລຸ້ນ New High / ATH) ເພື່ອປ້ອງກັນຄວາມສ່ຽງເງິນເຟີ້.\n• ນ້ຳມັນ (Oil): ລາຄາຍັງຕ່ຳ ຊ່ວຍບໍ່ໃຫ້ຄ່ານ້ຳມັນແພງເກີນໄປ.`
      }
    ];

    const thermometer = {
      labor: { status: "ແຂງແກ່ນ (STRONG)", desc: `ຈ້າງງານເພີ່ມ ${nfp.actual}, ຫວ່າງງານ ${unemp.actual}`, level: 80 },
      inflation: { status: "ຍັງໜຽວ/ລົງຍາກ (STICKY)", desc: "ເງິນເຟີ້ຍັງສູງກວ່າເປົ້າໝາຍ 2%", level: 75 },
      manufacturing: { status: "ຊະລໍຕົວ (COOLING)", desc: `ISM ຢູ່ທີ່ ${ism.actual} (< 50% ຫົດຕົວ)`, level: 45 }
    };

    // 2. Dynamic Upcoming Predictions List (Guaranteed 4+ Cards)
    const upcomingPredictions = (upcoming.length > 0 ? upcoming.slice(0, 6) : [
      { title: "Core PCE Price Index m/m", impact: "High", dateGMT7: "ວັນພຸດ 26 ສິງຫາ", timeGMT7: "19:30 (GMT+7)", forecast: "0.2%", previous: "0.1%" },
      { title: "Prelim GDP q/q", impact: "High", dateGMT7: "ວັນພຸດ 26 ສິງຫາ", timeGMT7: "19:30 (GMT+7)", forecast: "1.5%", previous: "1.5%" },
      { title: "Unemployment Claims", impact: "Medium", dateGMT7: "ວັນພະຫັດ 27 ສິງຫາ", timeGMT7: "19:30 (GMT+7)", forecast: "232K", previous: "231K" },
      { title: "Non-Farm Employment Change", impact: "High", dateGMT7: "ວັນສຸກ 05 ກັນຍາ", timeGMT7: "19:30 (GMT+7)", forecast: "165K", previous: "228K" }
    ]).map(evt => {
      const t = evt.title.toLowerCase();
      let probAbove = 50, probInline = 30, probBelow = 20, reasoning = '';

      if (t.includes('pce') || t.includes('cpi') || t.includes('ppi') || t.includes('inflation')) {
        probAbove = isLaborStrong ? 65 : 30;
        probInline = isLaborStrong ? 25 : 50;
        probBelow = 100 - (probAbove + probInline);
        reasoning = `ອີງຕາມຕົວເລກການຈ້າງງານ NFP ຫຼ້າສຸດ (+${nfp.actual}) ທີ່ແຂງແກ່ນ ບົ່ງບອກວ່າກຳລັງຊື້ ແລະ ຄ່າຈ້າງຍັງສູງ ເຮັດໃຫ້ມີໂອກາດ ${probAbove}% ທີ່ຕົວເລກເງິນເຟີ້ (${evt.title}) ຈະອອກມາສູງກວ່າ ຫຼື ເທົ່າກັບຄາດ (${evt.forecast}).`;
      } else if (t.includes('gdp') || t.includes('retail sales')) {
        probAbove = 55;
        probInline = 35;
        probBelow = 10;
        reasoning = `ການຈ້າງງານທີ່ດີຊ່ວຍພະຍຸງການບໍລິໂພກພາຍໃນປະເທດ ເຮັດໃຫ້ໂອກາດທີ່ (${evt.title}) ຈະຊົງຕົວ ຫຼື ດີກວ່າຄາດ (${evt.forecast}) ມີສູງເຖິງ 55%.`;
      } else {
        probAbove = 30;
        probInline = 50;
        probBelow = 20;
        reasoning = `ຕະຫຼາດແຮງງານຍັງແຂງແກ່ນ ຄາດວ່າຕົວເລກ (${evt.title}) ຈະຢູ່ໃນເກນປົກກະຕິໃກ້ຄຽງຄາດການ (${evt.forecast}).`;
      }

      return { ...evt, probAbove, probInline, probBelow, reasoning };
    });

    const now = new Date();
    res.json({
      success: true,
      data: {
        currentCycleLao: `ຮອບຂໍ້ມູນ Live Sync: ${new Intl.DateTimeFormat('lo-LA', { dateStyle: 'full', timeStyle: 'short', timeZone: 'Asia/Bangkok' }).format(now)}`,
        plainDigest: { bigPictureSummary, plainQA, thermometer },
        upcomingPredictions,
        releasedEvents: released.slice(0, 8)
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 MACRO TERMINAL SERVER: http://localhost:${PORT}`);
});
