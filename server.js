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

// =========================================================================
// 1. FOREX FACTORY AUTO-INGESTION SERVICE
// =========================================================================

const FF_CALENDAR_URL = 'https://nfs.faireconomy.media/ff_calendar_thisweek.json';

// Utility to parse strings like "228K", "4.2%", "49.0" to numbers
function parseNumber(val) {
  if (!val) return null;
  const clean = val.replace(/[%KM,]/g, '').trim();
  const num = parseFloat(clean);
  return isNaN(num) ? null : num;
}

// Global state holding current latest economic release
let latestMacroState = {
  lastUpdated: new Date().toISOString(),
  rawEvents: [],
  data: {
    ism: 49.0, ismPrev: 50.3,
    adp: 155, adpFc: 120,
    nfp: 228, nfpFc: 140, nfpPrev: 165,
    unemp: 4.2, unempFc: 4.1,
    cpiYoY: 3.1,
    oilPrice: 82.50,
    oilTrend: 'BEARISH'
  }
};

async function fetchForexFactoryData() {
  try {
    console.log(`[ForexFactory] Fetching live calendar...`);
    const res = await fetch(FF_CALENDAR_URL, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
    });
    
    if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
    const events = await res.json();
    
    // Filter for USD High-Impact Events
    const usdEvents = events.filter(e => e.country === 'USD');
    latestMacroState.rawEvents = usdEvents;

    // Search and Map specific indicators
    usdEvents.forEach(e => {
      const title = e.title.toLowerCase();

      // NFP
      if (title.includes('non-farm employment change')) {
        if (e.actual) latestMacroState.data.nfp = parseNumber(e.actual);
        if (e.forecast) latestMacroState.data.nfpFc = parseNumber(e.forecast);
        if (e.previous) latestMacroState.data.nfpPrev = parseNumber(e.previous);
      }
      // Unemployment Rate
      if (title.includes('unemployment rate')) {
        if (e.actual) latestMacroState.data.unemp = parseNumber(e.actual);
        if (e.forecast) latestMacroState.data.unempFc = parseNumber(e.forecast);
      }
      // ISM Manufacturing PMI
      if (title.includes('ism manufacturing pmi')) {
        if (e.actual) latestMacroState.data.ism = parseNumber(e.actual);
        if (e.previous) latestMacroState.data.ismPrev = parseNumber(e.previous);
      }
      // ADP Employment
      if (title.includes('adp non-farm')) {
        if (e.actual) latestMacroState.data.adp = parseNumber(e.actual);
        if (e.forecast) latestMacroState.data.adpFc = parseNumber(e.forecast);
      }
      // CPI YoY
      if (title.includes('cpi y/y')) {
        if (e.actual) latestMacroState.data.cpiYoY = parseNumber(e.actual);
      }
    });

    latestMacroState.lastUpdated = new Date().toISOString();
    console.log(`[ForexFactory] Synced successfully! NFP: ${latestMacroState.data.nfp}K | ISM: ${latestMacroState.data.ism}% | Unemp: ${latestMacroState.data.unemp}%`);
  } catch (err) {
    console.error(`[ForexFactory Error]:`, err.message);
  }
}

// Auto-poll Forex Factory every 2 minutes
setInterval(fetchForexFactoryData, 2 * 60 * 1000);
// Initial fetch on server start
fetchForexFactoryData();

// =========================================================================
// 2. MACRO EXPLANATION ENGINE (ພາສາລາວອັດຕະໂນມັດ)
// =========================================================================

function generatePlainLaoAnalysis(d) {
  const ismContraction = d.ism < 50;
  const ismExp = ismContraction
    ? `ຕົວເລກ ISM ຢູ່ທີ່ ${d.ism}% (ຕ່ຳກວ່າເກນ 50%) ບົ່ງບອກວ່າ "ພາກການຜະລິດ ແລະ ໂຮງງານກຳລັງຊະລໍຕົວລົງ", ອາດມີສາເຫດມາຈາກຕົ້ນທຶນການນຳເຂົ້າ ແລະ ກຳແພງພາສີ 🇺🇸.`
    : `ຕົວເລກ ISM ຢູ່ທີ່ ${d.ism}% (ສູງກວ່າ 50%) ສະແດງເຖິງພາກການຜະລິດທີ່ກຳລັງເຕີບໂຕ ແລະ ຂະຫຍາຍຕົວ.`;

  const nfpDiff = d.nfp - d.nfpFc;
  let laborStrength = nfpDiff >= 20 ? 'VERY_STRONG' : nfpDiff <= -20 ? 'WEAK' : 'BALANCED';
  let laborExp = nfpDiff >= 20
    ? `ການຈ້າງງານນອກພາກກະສິກຳ (NFP) ເພີ່ມຂຶ້ນເຖິງ ${d.nfp.toLocaleString()} ຕຳແໜ່ງ (ຫຼາຍກວ່າຄາດການ ${d.nfpFc.toLocaleString()}). ສະແດງວ່າເສດຖະກິດຍັງແຂງແກ່ນ, ບໍລິສັດຕ່າງໆຍັງຈ້າງຄົນເພີ່ມ ເຖິງວ່າອັດຕາຫວ່າງງານຈະຢູ່ທີ່ ${d.unemp}%.`
    : `ການຈ້າງງານ (NFP) ອອກມາພຽງ ${d.nfp.toLocaleString()} ຕຳແໜ່ງ (ຕ່ຳກວ່າຄາດການ), ສົ່ງສັນຍານວ່າຕະຫຼາດແຮງງານເລີ່ມຊະລໍຕົວ.`;

  const fedStance = laborStrength === 'VERY_STRONG'
    ? 'MODERATELY_HAWKISH (ເຂັ້ມງວດ / ບໍ່ຮີບຫຼຸດດອກເບ້ຍ)'
    : 'DOVISH (ກຽມຜ່ອນຄາຍດອກເບ້ຍ)';

  const fedExp = laborStrength === 'VERY_STRONG'
    ? `ເມື່ອຕະຫຼາດແຮງງານຍັງແຂງແຮງ Fed ຈະ "ບໍ່ຮີບຮ້ອນຫຼຸດດອກເບ້ຍ" ແລະ ອາດຄົງດອກເບ້ຍສູງໄວ້ດົນກວ່າເກົ່າ ເພື່ອຄຸມເງິນເຟີ້ໃຫ້ຢູ່ໝັດ.`
    : `ຕະຫຼາດເລີ່ມຊະລໍຕົວ Fed ອາດຕ້ອງ "ພິຈາລະນາຫຼຸດດອກເບ້ຍໄວຂຶ້ນ" ເພື່ອປ້ອງກັນເສດຖະກິດຖົດຖອຍ.`;

  const goldExp = nfpDiff >= 0
    ? `ລາຄາທອງຄຳອາດຖືກກົດດັນໃນໄລຍະສັ້ນຈາກ USD ທີ່ແຂງຄ່າ. ແຕ່ທາງເຕັກນິກ ຫຼັງຈາກການເທຂາຍ (Wave A) ລາຄາມີໂອກາດ Rebound ຂຶ້ນຕໍ່ (Wave B / Strong B ລຸ້ນເຮັດ ATH ໃໝ່) ຍ້ອນແຮງຊື້ປ້ອງກັນຄວາມສ່ຽງເງິນເຟີ້ ແລະ ພາສີ.`
    : `ທອງຄຳໄດ້ຮັບແຮງຊຸກຍູ້ທັນທີ ຍ້ອນຕະຫຼາດຄາດຫວັງການຫຼຸດດອກເບ້ຍ.`;

  return {
    lastUpdated: latestMacroState.lastUpdated,
    summary: `ຕະຫຼາດແຮງງານສະແດງຄວາມແຂງແກ່ນ (NFP ${d.nfp}K), ພາກການຜະລິດ ISM ຢູ່ທີ່ ${d.ism}%, Fed ມີທ່າທີ ${fedStance}.`,
    details: {
      ism: { val: `${d.ism}%`, exp: ismExp, isContraction },
      labor: { nfp: `${d.nfp}K`, adp: `${d.adp}K`, unemp: `${d.unemp}%`, exp: laborExp, strength: laborStrength },
      fed: { stance: fedStance, exp: fedExp },
      assets: {
        usd: nfpDiff >= 0 ? 'BULLISH (ແຂງຄ່າຂຶ້ນ)' : 'BEARISH (ອ່ອນຄ່າ)',
        gold: nfpDiff >= 0 ? 'SHORT-TERM PRESSURE / REBOUND WATCH' : 'BULLISH',
        goldExp: goldExp
      },
      nextFocus: `ຕົວເລກຕໍ່ໄປທີ່ຕ້ອງຈັບຕາແມ່ນ "ດັດຊະນີເງິນເຟີ້ CPI (m/m, y/y)" ເຊິ່ງຈະເປັນຕົວຊີ້ຂາດດອກເບ້ຍ Fed ງວດຕໍ່ໄປ!`
    }
  };
}

// =========================================================================
// 3. API ROUTES FOR FRONTEND
// =========================================================================

// Get Auto-Analyzed Data from Forex Factory
app.get('/api/forexfactory-live', (req, res) => {
  const analysis = generatePlainLaoAnalysis(latestMacroState.data);
  res.json({
    success: true,
    source: 'FOREX_FACTORY_OFFICIAL_FEED',
    raw: latestMacroState.data,
    analysis: analysis
  });
});

// Manual trigger to force immediate refresh from Forex Factory
app.post('/api/forexfactory-sync-now', async (req, res) => {
  await fetchForexFactoryData();
  const analysis = generatePlainLaoAnalysis(latestMacroState.data);
  res.json({ success: true, message: 'Synced!', data: analysis });
});

app.listen(PORT, () => {
  console.log(`=======================================================`);
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`🌐 Forex Factory Live Ingestion: ACTIVE (Polling every 2m)`);
  console.log(`=======================================================`);
});
