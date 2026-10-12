import type {
  InventoryCategory,
  InventoryItem,
  InventoryItemId,
  SiteId,
  StockUnit,
} from '../types';

interface CatalogEntry {
  name: string;
  category: InventoryCategory;
  unit: StockUnit;
  unitWeightKg: number;
}

/** Product master data, shared by every site that stocks the SKU. */
const catalog = {
  'FB-NDL-CHK': { name: 'Instant noodles, chicken curry (40 packs)', category: 'food_beverage', unit: 'carton', unitWeightKg: 3.4 },
  'FB-NDL-SOTO': { name: 'Instant noodles, soto (40 packs)', category: 'food_beverage', unit: 'carton', unitWeightKg: 3.4 },
  'FB-MW-1500': { name: 'Mineral water 1.5 L (12 bottles)', category: 'food_beverage', unit: 'carton', unitWeightKg: 18.6 },
  'FB-MW-600': { name: 'Mineral water 600 ml (24 bottles)', category: 'food_beverage', unit: 'carton', unitWeightKg: 15.2 },
  'FB-TEA-350': { name: 'Jasmine tea, bottled 350 ml (24)', category: 'food_beverage', unit: 'carton', unitWeightKg: 9.1 },
  'FB-CKO-2L': { name: 'Cooking oil 2 L pouch (6)', category: 'food_beverage', unit: 'carton', unitWeightKg: 11.2 },
  'FB-RICE-25': { name: 'Premium rice 25 kg', category: 'food_beverage', unit: 'bag', unitWeightKg: 25 },
  'FB-SUG-1': { name: 'Granulated sugar 1 kg (20)', category: 'food_beverage', unit: 'carton', unitWeightKg: 20.3 },
  'FB-COF-3IN1': { name: 'Instant coffee 3-in-1 (10 × 12 sachets)', category: 'food_beverage', unit: 'carton', unitWeightKg: 4.8 },
  'HH-DET-800': { name: 'Laundry detergent powder 800 g (12)', category: 'household', unit: 'carton', unitWeightKg: 10 },
  'HH-DSH-780': { name: 'Dishwashing liquid 780 ml pouch (12)', category: 'household', unit: 'carton', unitWeightKg: 9.8 },
  'HH-TIS-250': { name: 'Facial tissue 250 sheets (48)', category: 'household', unit: 'carton', unitWeightKg: 7.6 },
  'PC-SHP-170': { name: 'Shampoo 170 ml (24)', category: 'personal_care', unit: 'carton', unitWeightKg: 4.6 },
  'PC-SOAP-85': { name: 'Bar soap 85 g (144)', category: 'personal_care', unit: 'carton', unitWeightKg: 12.9 },
  'PC-TPS-190': { name: 'Toothpaste 190 g (72)', category: 'personal_care', unit: 'carton', unitWeightKg: 14.4 },
  'EL-LED-12W': { name: 'LED bulb 12 W (50)', category: 'electronics', unit: 'carton', unitWeightKg: 4.2 },
  'EL-FAN-16': { name: 'Standing fan 16"', category: 'electronics', unit: 'piece', unitWeightKg: 6.8 },
  'EL-RC-18': { name: 'Rice cooker 1.8 L', category: 'electronics', unit: 'piece', unitWeightKg: 3.5 },
  'EL-CBL-NYM': { name: 'Power cable NYM 2 × 1.5 mm², 50 m', category: 'electronics', unit: 'roll', unitWeightKg: 6 },
  'AP-OIL-10W': { name: 'Engine oil 10W-40, 1 L (12)', category: 'auto_parts', unit: 'carton', unitWeightKg: 11.5 },
  'AP-TYR-MC17': { name: 'Motorcycle tyre 80/90-17', category: 'auto_parts', unit: 'piece', unitWeightKg: 3.1 },
  'AP-BAT-NS40': { name: 'Car battery NS40', category: 'auto_parts', unit: 'piece', unitWeightKg: 11 },
  'AP-BRK-PAD': { name: 'Brake pad set, compact car', category: 'auto_parts', unit: 'set', unitWeightKg: 1.4 },
  'BM-CEM-40': { name: 'Portland cement 40 kg', category: 'building_materials', unit: 'bag', unitWeightKg: 40 },
  'BM-PNT-5': { name: 'Wall paint, white 5 kg', category: 'building_materials', unit: 'pail', unitWeightKg: 5.3 },
  'BM-RBR-10': { name: 'Rebar 10 mm × 12 m (bundle of 10)', category: 'building_materials', unit: 'bundle', unitWeightKg: 74 },
} satisfies Record<string, CatalogEntry>;

type Sku = keyof typeof catalog;

function stock(
  id: InventoryItemId,
  siteId: SiteId,
  sku: Sku,
  bin: string,
  quantity: number,
  reorderPoint: number,
): InventoryItem {
  const [zone, aisle, level] = bin.split('-');
  return {
    id,
    sku,
    ...catalog[sku],
    siteId,
    bin: { zone, aisle: Number(aisle), level: Number(level) },
    quantity,
    reorderPoint,
  };
}

// id, site, sku, bin (zone-aisle-level), quantity, reorder point
export const inventory: InventoryItem[] = [
  // Warehouse A – Cakung
  stock('INV-0001', 'SITE-JKT', 'FB-NDL-CHK', 'A1-01-1', 1840, 600),
  stock('INV-0002', 'SITE-JKT', 'FB-NDL-SOTO', 'A1-01-2', 1215, 600),
  stock('INV-0003', 'SITE-JKT', 'FB-MW-1500', 'A1-03-1', 2650, 800),
  stock('INV-0004', 'SITE-JKT', 'FB-TEA-350', 'A1-04-2', 760, 400),
  stock('INV-0005', 'SITE-JKT', 'FB-CKO-2L', 'A2-02-1', 540, 300),
  stock('INV-0006', 'SITE-JKT', 'FB-RICE-25', 'A2-05-1', 420, 150),
  stock('INV-0007', 'SITE-JKT', 'HH-DET-800', 'A2-07-2', 610, 250),
  stock('INV-0008', 'SITE-JKT', 'HH-DSH-780', 'A2-07-3', 185, 200),
  stock('INV-0009', 'SITE-JKT', 'PC-SHP-170', 'B1-02-2', 330, 120),
  stock('INV-0010', 'SITE-JKT', 'PC-SOAP-85', 'B1-02-3', 275, 100),
  stock('INV-0011', 'SITE-JKT', 'EL-LED-12W', 'B1-06-2', 140, 60),
  stock('INV-0012', 'SITE-JKT', 'EL-FAN-16', 'B2-01-1', 96, 40),
  stock('INV-0013', 'SITE-JKT', 'AP-OIL-10W', 'B2-04-1', 310, 120),
  stock('INV-0014', 'SITE-JKT', 'AP-TYR-MC17', 'B2-05-2', 520, 200),
  stock('INV-0015', 'SITE-JKT', 'BM-CEM-40', 'B2-09-1', 880, 400),

  // Warehouse B – Cikarang
  stock('INV-0016', 'SITE-CKR', 'FB-NDL-CHK', 'A1-01-1', 2400, 800),
  stock('INV-0017', 'SITE-CKR', 'FB-MW-600', 'A1-02-1', 1980, 700),
  stock('INV-0018', 'SITE-CKR', 'FB-CKO-2L', 'A1-05-1', 870, 300),
  stock('INV-0019', 'SITE-CKR', 'FB-SUG-1', 'A1-06-1', 640, 250),
  stock('INV-0020', 'SITE-CKR', 'HH-DET-800', 'A2-01-2', 920, 300),
  stock('INV-0021', 'SITE-CKR', 'HH-TIS-250', 'A2-03-3', 410, 150),
  stock('INV-0022', 'SITE-CKR', 'PC-TPS-190', 'A2-04-2', 205, 100),
  stock('INV-0023', 'SITE-CKR', 'EL-RC-18', 'B1-01-2', 48, 60),
  stock('INV-0024', 'SITE-CKR', 'EL-CBL-NYM', 'B1-03-1', 175, 80),
  stock('INV-0025', 'SITE-CKR', 'AP-BAT-NS40', 'B2-02-1', 132, 50),
  stock('INV-0026', 'SITE-CKR', 'AP-BRK-PAD', 'B2-02-3', 380, 150),
  stock('INV-0027', 'SITE-CKR', 'AP-OIL-10W', 'B2-04-1', 455, 150),
  stock('INV-0028', 'SITE-CKR', 'BM-PNT-5', 'B2-07-1', 260, 100),

  // Warehouse C – Rungkut
  stock('INV-0029', 'SITE-SBY', 'FB-NDL-CHK', 'A1-01-1', 1320, 600),
  stock('INV-0030', 'SITE-SBY', 'FB-NDL-SOTO', 'A1-01-2', 980, 500),
  stock('INV-0031', 'SITE-SBY', 'FB-MW-1500', 'A1-02-1', 1740, 800),
  stock('INV-0032', 'SITE-SBY', 'FB-RICE-25', 'A1-05-1', 610, 200),
  stock('INV-0033', 'SITE-SBY', 'FB-COF-3IN1', 'A2-01-2', 455, 150),
  stock('INV-0034', 'SITE-SBY', 'HH-DSH-780', 'A2-02-2', 520, 200),
  stock('INV-0035', 'SITE-SBY', 'HH-TIS-250', 'A2-03-3', 290, 150),
  stock('INV-0036', 'SITE-SBY', 'PC-SOAP-85', 'A2-06-2', 160, 100),
  stock('INV-0037', 'SITE-SBY', 'EL-LED-12W', 'B1-02-2', 85, 60),
  stock('INV-0038', 'SITE-SBY', 'AP-TYR-MC17', 'B1-04-1', 410, 200),
  stock('INV-0039', 'SITE-SBY', 'BM-CEM-40', 'B2-01-1', 1450, 500),
  stock('INV-0040', 'SITE-SBY', 'BM-RBR-10', 'B2-08-1', 64, 30),
];
