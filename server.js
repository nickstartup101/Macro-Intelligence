import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import NodeCache from 'node-cache';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const cache = new NodeCache({ stdTTL: 3600 });
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// =========================================================================
// 🧠 MACROECONOMIC PLAIN-LANGUAGE EXPLANATION ENGINE (ພາສາລາວເຂົ້າໃຈງ່າຍ)
// =========================================================================

class MacroExplanationEngine {
  static analyze({ ism, ismPrev, adp, adpFc, nfp, nfpFc, nfpPrev, unemp, unempFc, cpiYoY, oilPrice, oilTrend }) {
    
    // --- 1. ວິເຄາະພາກການຜະລິດ (ISM Manufacturing) ---
    let ismStatus = ism >= 50 ? 'EXPANDING' : 'CONTRACTION';
    let ismExplanation = '';
    if (ism < 50) {
      ismExplanation = `ຕົວເລກ ISM ຢູ່ທີ່ ${ism}% (ຕ່ຳກວ່າເກນ 50%) ບົ່ງບອກວ່າ "ໂຮງງານ ແລະ ພາກການຜະລິດກຳລັງຊະລໍຕົວລົງ". ສາເຫດຫຼັກອາດມາຈາກຕົ້ນທຶນການນຳເຂົ້າທີ່ສູງຂຶ້ນ ຫຼື ຜົນກະທົບຈາກກຳແພງພາສີ ເຮັດໃຫ້ທຸລະກິດຊະລໍການສັ່ງຊື້ສິນຄ້າໃໝ່.`;
    } else {
      ismExplanation = `ຕົວເລກ ISM ຢູ່ທີ່ ${ism}% (ສູງກວ່າ 50%) ບົ່ງບອກວ່າ "ພາກການຜະລິດກຳລັງເຕີບໂຕ ແລະ ຂະຫຍາຍຕົວ", ໂຮງງານມີຄຳສັ່ງຊື້ເພີ່ມຂຶ້ນ.`;
    }

    // --- 2. ວິເຄາະຕະຫຼາດແຮງງານ (NFP, ADP & Unemployment) ---
    const nfpDiff = nfp - nfpFc;
    let laborStrength = '';
    let laborExplanation = '';
    
    if (nfpDiff >= 30) {
      laborStrength = 'VERY_STRONG';
      laborExplanation = `ການຈ້າງງານນອກພາກກະສິກຳ (NFP) ເພີ່ມຂຶ້ນເຖິງ ${nfp.toLocaleString()} ຕຳແໜ່ງ (ຫຼາຍກວ່າທີ່ຄາດໄວ້ ${nfpFc.toLocaleString()} ຢ່າງຫຼວງຫຼາຍ). ສິ່ງນີ້ສະແດງວ່າ "ເສດຖະກິດຍັງແຂງແຮງ, ທຸລະກິດຍັງຕ້ອງການຄົນງານຫຼາຍ". ເຖິງແມ່ນວ່າອັດຕາຫວ່າງງານຈະຢູ່ທີ່ ${unemp}%, ແຕ່ການຈ້າງງານລວມຍັງບໍ່ໄດ້ຢູ່ໃນພາວະຖົດຖອຍ.`;
    } else if (nfpDiff <= -30) {
      laborStrength = 'WEAK';
      laborExplanation = `ການຈ້າງງານ (NFP) ອອກມາພຽງ ${nfp.toLocaleString()} ຕຳແໜ່ງ (ຕ່ຳກວ່າຄາດການ). ສິ່ງນີ້ສົ່ງສັນຍານເຕືອນວ່າ "ຕະຫຼາດແຮງງານເລີ່ມອ່ອນແອລົງ ແລະ ບໍລິສັດຕ່າງໆເລີ່ມຫຼຸດການຮັບຄົນ".`;
    } else {
      laborStrength = 'BALANCED';
      laborExplanation = `ການຈ້າງງານ (NFP) ອອກມາໃກ້ຄຽງກັບທີ່ຄາດການ (${nfp.toLocaleString()} ຕຳແໜ່ງ) ສະແດງເຖິງຕະຫຼາດແຮງງານທີ່ "ຊົງຕົວ ແລະ ຢູ່ໃນລະດັບປົກກະຕິ".`;
    }

    // --- 3. ວິເຄາະພະລັງງານ ແລະ ຕົ້ນທຶນ (Oil) ---
    let energyExplanation = '';
    if (oilTrend === 'BEARISH' || oilPrice < 85) {
      energyExplanation = `ລາຄານ້ຳມັນດິບ (${oilPrice}$) ຍັງຢູ່ໃນທ່າອ່ຽງຫຼຸດລົງ ຊ່ວຍຫຼຸດຜ່ອນຕົ້ນທຶນການຂົນສົ່ງ ແລະ ການຜະລິດ ເຮັດໃຫ້ເງິນເຟີ້ດ້ານພະລັງງານບໍ່ກົດດັນຜູ້ບໍລິໂພກຫຼາຍເກີນໄປ.`;
    } else {
      energyExplanation = `ລາຄານ້ຳມັນດິບ (${oilPrice}$) ປັບຕົວສູງຂຶ້ນ ອາດຈະກາຍເປັນຕົ້ນທຶນແຝງທີ່ຍູ້ໃຫ້ເງິນເຟີ້ກັບມາສູງຂຶ້ນອີກ.`;
    }

    // --- 4. ວິເຄາະທ່າທີຂອງ Fed (Central Bank Policy Impact) ---
    let fedStance = '';
    let fedExplanation = '';
    if (laborStrength === 'VERY_STRONG' && cpiYoY >= 3.0) {
      fedStance = 'MODERATELY_HAWKISH (ເຂັ້ມງວດຕໍ່ໄປ)';
      fedExplanation = `ເມື່ອ "ແຮງງານຍັງແຂງແຮງ" ແຕ່ "ເງິນເຟີ້ຍັງຄົງທີ່ (${cpiYoY}%)", ທະນາຄານກາງສະຫະລັດ (Fed) ຈະ "ບໍ່ຮີບຮ້ອນຫຼຸດດອກເບ້ຍ" ແລະ ອາດຈະຮັກສາດອກເບ້ຍສູງໄວ້ດົນກວ່າເກົ່າ ເພື່ອຄຸມເງິນເຟີ້ໃຫ້ຢູ່ໝັດ.`;
    } else if (laborStrength === 'WEAK' || ism < 48) {
      fedStance = 'DOVISH (ກຽມຜ່ອນຄາຍດອກເບ້ຍ)';
      fedExplanation = `ເນື່ອງຈາກຕະຫຼາດເລີ່ມສົ່ງສັນຍານຊະລໍຕົວ, Fed ອາດຈະຕ້ອງ "ພິຈາລະນາຫຼຸດດອກເບ້ຍໄວຂຶ້ນ" ເພື່ອຊ່ວຍພະຍຸງເສດຖະກິດບໍ່ໃຫ້ເຂົ້າສູ່ພາວະຖົດຖອຍ.`;
    } else {
      fedStance = 'NEUTRAL / DATA-DEPENDENT (ລໍຖ້າເບິ່ງຂໍ້ມູນ)';
      fedExplanation = `Fed ຈະຍັງຮັກສານະໂຍບາຍແບບເປັນກາງ ແລະ ລໍຖ້າເບິ່ງຕົວເລກ CPI ຖັດໄປເປັນຫຼັກ.`;
    }

    // --- 5. ວິເຄາະຜົນກະທົບຕໍ່ສິນຊັບ (USD, Gold, 10Y Yield) ---
    let assetImpact = {
      usd: nfpDiff >= 0 ? 'BULLISH (ແຂງຄ່າຂຶ້ນ)' : 'BEARISH (ອ່ອນຄ່າລົງ)',
      gold: nfpDiff >= 0 ? 'SHORT-TERM PRESSURE (ກົດດັນໄລຍະສັ້ນ / ລໍຖ້າ Rebound)' : 'BULLISH (ມີແຮງຊື້ຂຶ້ນ)',
      yield10y: nfpDiff >= 0 ? 'RISING (ຜົນຕອບແທນພັນທະບັດປັບຂຶ້ນ)' : 'FALLING (ຜົນຕອບແທນຫຼຸດລົງ)',
      goldExplanation: nfpDiff >= 0
        ? `ໃນໄລຍະສັ້ນ ລາຄາທອງຄຳອາດຖືກກົດດັນຈາກຄ່າເງິນ USD ແລະ ດອກເບ້ຍທີ່ຍັງສູງ. ແຕ່ທາງດ້ານເຕັກນິກ ຫຼັງຈາກການເທຂາຍຈົບຮອບ (Wave A) ລາຄາມີໂອກາດດີດຕົວກັບຄືນ (Rebound ເຂົ້າສູ່ Wave B) ຍ້ອນນັກລົງທຶນຍັງຊື້ທອງປ້ອງກັນຄວາມສ່ຽງເງິນເຟີ້ ແລະ ຄວາມບໍ່ແນ່ນອນດ້ານພາສີ.`
        : `ລາຄາທອງຄຳໄດ້ຮັບປັດໄຈບວກທັນທີ ຍ້ອນຕະຫຼາດຄາດຫວັງວ່າ Fed ຈະຫຼຸດດອກເບ້ຍ.`
    };

    // --- 6. ສະຫຼຸບຈຸດທີ່ຕ້ອງຈັບຕາຕໍ່ໄປ (Next Catalyst) ---
    let nextFocus = `ຕົວເລກຕໍ່ໄປທີ່ຕ້ອງຈັບຕາເບິ່ງທີ່ສຸດແມ່ນ "ດັດຊະນີເງິນເຟີ້ CPI (m/m ແລະ y/y)" ເພາະຖ້າເງິນເຟີ້ອອກມາສູງ Fed ຈະຮັກສາດອກເບ້ຍສູງຕໍ່ໄປ ແຕ່ຖ້າເງິນເຟີ້ຫຼຸດລົງ ຕະຫຼາດຈະເລີ່ມຕອບຮັບການຫຼຸດດອກເບ້ຍທັນທີ.`;

    return {
      executiveSummary: `ຕະຫຼາດແຮງງານຍັງສະແດງຄວາມແຂງແກ່ນຢ່າງເຫັນໄດ້ຊັດເຈນ (${nfp >= nfpFc ? 'ສູງກວ່າຄາດ' : 'ຊະລໍຕົວ'}), ຂະນະທີ່ພາກການຜະລິດເລີ່ມໄດ້ຮັບຜົນກະທົບຈາກຕົ້ນທຶນ ແລະ ພາສີ. Fed ຍັງມີທ່າທີ ${fedStance}.`,
      details: {
        ism: { value: `${ism}%`, status: ismStatus, explanation: ismExplanation },
        labor: { nfp: `${nfp}K`, adp: `${adp}K`, unemp: `${unemp}%`, status: laborStrength, explanation: laborExplanation },
        energy: { price: `$${oilPrice}`, explanation: energyExplanation },
        fed: { stance: fedStance, explanation: fedExplanation },
        assets: assetImpact,
        nextFocus: nextFocus
      }
    };
  }
}

// API Route: Auto Analyze
app.post('/api/analyze-macro', (req, res) => {
  try {
    const inputData = req.body;
    const analysis = MacroExplanationEngine.analyze(inputData);
    res.json({ success: true, data: analysis });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Default Live API
app.get('/api/live-macro-analysis', (req, res) => {
  // Default release data
  const defaultData = {
    ism: 49.0, ismPrev: 50.3,
    adp: 155, adpFc: 120,
    nfp: 228, nfpFc: 140, nfpPrev: 165,
    unemp: 4.2, unempFc: 4.1,
    cpiYoY: 3.1,
    oilPrice: 82.50,
    oilTrend: 'BEARISH'
  };
  const analysis = MacroExplanationEngine.analyze(defaultData);
  res.json({ success: true, raw: defaultData, data: analysis });
});

app.listen(PORT, () => {
  console.log(`🚀 Macro Intelligence Server running on http://localhost:${PORT}`);
});
