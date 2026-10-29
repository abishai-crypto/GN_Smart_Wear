const { dbAll, dbRun } = require('../server/db');

// Accurate, high-quality, verified fashion imagery for every single product
const productImages = {
  1: 'https://images.unsplash.com/photo-1542272604-780c96856592?w=600&auto=format&fit=crop&q=80', // Men's Slim Fit Jeans
  2: 'https://images.unsplash.com/photo-1541099649105-f69ad21f3246?w=600&auto=format&fit=crop&q=80', // Majeje Jeans Bootcut ya Kike
  3: 'https://images.unsplash.com/photo-1602810318383-e386cc2a3ccf?w=600&auto=format&fit=crop&q=80', // Shati mikono mirefu kiume
  4: 'https://images.unsplash.com/photo-1595777457583-95e059d581b8?w=600&auto=format&fit=crop&q=80', // Gauni la Harusi na Sherehe
  5: 'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=600&auto=format&fit=crop&q=80', // Tracksuit Full Set
  6: 'https://images.unsplash.com/photo-1521572267360-ee0c2909d518?w=600&auto=format&fit=crop&q=80', // T-Shirt Kali Heavyweight
  7: 'https://images.unsplash.com/photo-1624378439575-d8705ad7ae80?w=600&auto=format&fit=crop&q=80', // Suruali ya Kitambaa ya Ofisini
  8: 'https://images.unsplash.com/photo-1519238263530-99bdd11df2ea?w=600&auto=format&fit=crop&q=80', // Mashati watoto standard

  9: 'https://images.unsplash.com/photo-1479064555552-3ef4979f8908?w=600&auto=format&fit=crop&q=80', // Suluali kali za ruksi (kitambaa)
  10: 'https://images.unsplash.com/photo-1604176354204-9268737828e4?w=600&auto=format&fit=crop&q=80', // Suluali kali za ruksi PRO
  11: 'https://images.unsplash.com/photo-1617137984095-74e4e5e3613f?w=600&auto=format&fit=crop&q=80', // Kadeti standard
  12: 'https://images.unsplash.com/photo-1583743814966-8936f5b7be1a?w=600&auto=format&fit=crop&q=80', // Matshet ya kawaida
  13: 'https://images.unsplash.com/photo-1508098682722-e99c43a406b2?w=600&auto=format&fit=crop&q=80', // Jezi standard
  14: 'https://images.unsplash.com/photo-1503342217505-b0a15ec3261c?w=600&auto=format&fit=crop&q=80', // Tshet high standard
  15: 'https://images.unsplash.com/photo-1509551388413-e18d0ac5d495?w=600&auto=format&fit=crop&q=80', // Majjeje brand
  16: 'https://images.unsplash.com/photo-1517445312882-bc9910d016b7?w=600&auto=format&fit=crop&q=80', // Majeje medium brand
  17: 'https://images.unsplash.com/photo-1552902865-b72c031ac5ea?w=600&auto=format&fit=crop&q=80', // Track mistari crayz
  18: 'https://images.unsplash.com/photo-1556905055-8f358a7a47b2?w=600&auto=format&fit=crop&q=80', // Trak jeje la mistari
  19: 'https://images.unsplash.com/photo-1596755094514-f87e34085b2c?w=600&auto=format&fit=crop&q=80', // Mashati mikono mifupi standard
  20: 'https://images.unsplash.com/photo-1507679799987-c73779587ccf?w=600&auto=format&fit=crop&q=80', // Mashat beach casual
  21: 'https://images.unsplash.com/photo-1586363104862-3a5e2ab60d99?w=600&auto=format&fit=crop&q=80', // Shat la kuvutika mikono mifupi
  22: 'https://images.unsplash.com/photo-1618354691373-d851c5c3a990?w=600&auto=format&fit=crop&q=80', // Mabei minamba
  23: 'https://images.unsplash.com/photo-1576566588028-4147f3842f27?w=600&auto=format&fit=crop&q=80', // Mabeli lastik ya machata
  24: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=600&auto=format&fit=crop&q=80', // Mashat mikono milefu wadada
  25: 'https://images.unsplash.com/photo-1551803091-e20673f15770?w=600&auto=format&fit=crop&q=80', // Shat la mikono mirefu la wadada la kawaida
  26: 'https://images.unsplash.com/photo-1529374255404-311a2a4f1fd9?w=600&auto=format&fit=crop&q=80', // Mabeli ya kiume
  27: 'https://images.unsplash.com/photo-1618354691792-d1d42acfd860?w=600&auto=format&fit=crop&q=80', // Matshet mikono mirefu brand
  28: 'https://images.unsplash.com/photo-1578587018452-892bacefd3f2?w=600&auto=format&fit=crop&q=80', // Tshet mikono mirefu round colar
  29: 'https://images.unsplash.com/photo-1503342394128-c104d54dba01?w=600&auto=format&fit=crop&q=80', // Caush beli singlend nzito
  30: 'https://images.unsplash.com/photo-1620012253295-c15c429fbb41?w=600&auto=format&fit=crop&q=80', // Shat la mistali mikono mirefu
  31: 'https://images.unsplash.com/photo-1572804013309-59a88b7e92f1?w=600&auto=format&fit=crop&q=80', // Magauni gubeli
  32: 'https://images.unsplash.com/photo-1567401893414-76b7b1e5a7a5?w=600&auto=format&fit=crop&q=80', // Magauni abaya design normal
  33: 'https://images.unsplash.com/photo-1508214751196-bcfd4ca60f91?w=600&auto=format&fit=crop&q=80', // Jeans za watoto za kawaida
  34: 'https://images.unsplash.com/photo-1519457431-44ccd64a579b?w=600&auto=format&fit=crop&q=80', // Track suluali za watoto
  35: 'https://images.unsplash.com/photo-1503919545889-aef636e10ad4?w=600&auto=format&fit=crop&q=80', // Kadeti za watoto
  36: 'https://images.unsplash.com/photo-1471286174890-9c112ffca56a?w=600&auto=format&fit=crop&q=80', // Jeans nzito za watoto
  37: 'https://images.unsplash.com/photo-1519238263530-99bdd11df2ea?w=600&auto=format&fit=crop&q=80', // Tshet wa watoto (za good fashion)
  38: 'https://images.unsplash.com/photo-1485546246426-74dc88dec4d9?w=600&auto=format&fit=crop&q=80', // T-shet watoto (normal fashion)
  39: 'https://images.unsplash.com/photo-1509967419530-da38b4704bc6?w=600&auto=format&fit=crop&q=80', // Mashati ta vifungo watoto (beach)
  40: 'https://images.unsplash.com/photo-1622290291468-a28f7a7dc6a8?w=600&auto=format&fit=crop&q=80', // Mashat watoto mikono mirefu
  41: 'https://images.unsplash.com/photo-1591195853828-11db59a44f6b?w=600&auto=format&fit=crop&q=80', // Pensi jeans watoto
  42: 'https://images.unsplash.com/photo-1621452773781-0f992fd1f5c1?w=600&auto=format&fit=crop&q=80', // Gauni normal za watoto
  43: 'https://images.unsplash.com/photo-1518831959646-742c3a14ebf7?w=600&auto=format&fit=crop&q=80', // Magauni watoto standard
  44: 'https://images.unsplash.com/photo-1533512930330-4ac257c86793?w=600&auto=format&fit=crop&q=80', // Magauni makari ya watoto
  45: 'https://images.unsplash.com/photo-1502716119720-b23a93e5fe1b?w=600&auto=format&fit=crop&q=80', // Top za wadada mikono milefu
  46: 'https://images.unsplash.com/photo-1485968579580-b6d095142e6e?w=600&auto=format&fit=crop&q=80', // Top za wadada mikono fupi normal
  47: 'https://images.unsplash.com/photo-1591195853828-11db59a44f6b?w=600&auto=format&fit=crop&q=80', // Pensi jeans za kiume (normal quality)
  48: 'https://images.unsplash.com/photo-1565084888279-aca607ecce0c?w=600&auto=format&fit=crop&q=80', // Pensi jeansi high quality
  49: 'https://images.unsplash.com/photo-1582552938357-32b906df40cb?w=600&auto=format&fit=crop&q=80', // Pensi jeans jeje
  50: 'https://images.unsplash.com/photo-1554412933-514a83d2f3c8?w=600&auto=format&fit=crop&q=80', // Kaptula za wadada
  51: 'https://images.unsplash.com/photo-1496747611176-843222e1e57c?w=600&auto=format&fit=crop&q=80', // MAGAUNI WADADA NORMAL
  52: 'https://images.unsplash.com/photo-1539008835657-9e8e9680c956?w=600&auto=format&fit=crop&q=80', // Magauni wadada ya kawaida
  53: 'https://images.unsplash.com/photo-1515372039744-b8f02a3ae446?w=600&auto=format&fit=crop&q=80', // Magauni specil ya kuvutika na mpila
  54: 'https://images.unsplash.com/photo-1509631179647-0177331693ae?w=600&auto=format&fit=crop&q=80', // Majeje mepesi wadada
  55: 'https://images.unsplash.com/photo-1506619216599-9d16d0903dfd?w=600&auto=format&fit=crop&q=80', // Track nyepesi kelvin
  56: 'https://images.unsplash.com/photo-1541099649105-f69ad21f3246?w=600&auto=format&fit=crop&q=80', // SKIN JEANS
  57: 'https://images.unsplash.com/photo-1588117305388-c2631a279f82?w=600&auto=format&fit=crop&q=80', // BOXER MEN NORMAL
  58: 'https://images.unsplash.com/photo-1566174053879-31528523f8ae?w=600&auto=format&fit=crop&q=80', // SPECIAL DRESS
  59: 'https://images.unsplash.com/photo-1434389677669-e08b4cac3105?w=600&auto=format&fit=crop&q=80', // TOP ZARA SHORT AND LONG
  60: 'https://images.unsplash.com/photo-1624222247344-550fb60583dc?w=600&auto=format&fit=crop&q=80', // MIKANDA OFFCIAL MEN
  61: 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=600&auto=format&fit=crop&q=80', // MIKANDA OFFCIAL MEN
  62: 'https://images.unsplash.com/photo-1605100804763-247f67b3557e?w=600&auto=format&fit=crop&q=80', // MIKANDA UTUMBO MEN
  63: 'https://images.unsplash.com/photo-1594938298603-c8148c4dae35?w=600&auto=format&fit=crop&q=80', // MIKANDA WATOTO
  64: 'https://images.unsplash.com/photo-1598532163257-ae3c6b2524b6?w=600&auto=format&fit=crop&q=80', // MIKANDA WADADA
  65: 'https://images.unsplash.com/photo-1584370848010-d7fe6bc767ec?w=600&auto=format&fit=crop&q=80', // CARGO JEANS WOMEN
  66: 'https://images.unsplash.com/photo-1607522370275-f14206abe5d3?w=600&auto=format&fit=crop&q=80', // BOXER CHILD NORMAL
  67: 'https://images.unsplash.com/photo-1588117305388-c2631a279f82?w=600&auto=format&fit=crop&q=80', // BOXER MEN QUALITY
  68: 'https://images.unsplash.com/photo-1552902865-b72c031ac5ea?w=600&auto=format&fit=crop&q=80', // TRACK LAIN ZA KIUME
  69: 'https://images.unsplash.com/photo-1576678927484-cc907957088c?w=600&auto=format&fit=crop&q=80', // VISOKSI VYA MIKONONI
  70: 'https://images.unsplash.com/photo-1519238263530-99bdd11df2ea?w=600&auto=format&fit=crop&q=80'  // TSHERT ORG WATOTO
};

async function updateImages() {
  console.log('Inaanza kusasisha picha za bidhaa zote bila kugusa data nyingine...');
  let updatedCount = 0;

  for (const [id, url] of Object.entries(productImages)) {
    const res = await dbRun('UPDATE products SET image_url = ? WHERE id = ?', [url, id]);
    if (res.changes > 0) {
      updatedCount++;
    }
  }

  console.log(`Imekamilika! Jumla ya bidhaa zilizosasishwa picha ni: ${updatedCount}`);
}

updateImages().then(() => process.exit(0)).catch(err => {
  console.error('Hitilafu ya kusasisha picha:', err);
  process.exit(1);
});
