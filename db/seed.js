/**
 * PLUS 233 AUTOMASTER — Seed script
 * ---------------------------------
 * Populates the database with realistic sample data (vehicles, categories,
 * products, compatibility, settings, admin user). All prices & stock live
 * in the database — nothing is hard-coded in the storefront.
 *
 * Run:  node db/seed.js            (skips if data already exists)
 *       FORCE=1 node db/seed.js    (wipes & re-seeds)
 */
'use strict';
const crypto = require('crypto');
const db = require('./database');

function hashPassword(pw) {
  const salt = crypto.randomBytes(8).toString('hex');
  const hash = crypto.createHash('sha256').update(salt + pw).digest('hex');
  return `${salt}:${hash}`;
}

/* ------------------------------------------------------------------ */
/*  CATEGORIES                                                         */
/* ------------------------------------------------------------------ */
const CATEGORIES = [
  ['Spark Plugs', 'spark-plugs', 'High-performance ignition spark plugs for petrol engines.', '/images/cat-spark-plugs.jpg', 1],
  ['Ignition Coils', 'ignition-coils', 'Genuine ignition coils for reliable engine starts.', '/images/cat-ignition-coils.jpg', 2],
  ['Fuel Pumps', 'fuel-pumps', 'Fuel pumps and delivery modules for consistent fuel pressure.', '/images/cat-fuel-pumps.jpg', 3],
  ['Oil Filters', 'oil-filters', 'Engine oil filters engineered for maximum filtration.', '/images/cat-oil-filters.jpg', 4],
  ['Air Filters', 'air-filters', 'Engine air filters for clean airflow and better performance.', '/images/cat-air-filters.jpg', 5],
  ['AC Filters', 'ac-filters', 'Cabin air filters for fresh, clean in-car air.', '/images/cat-ac-filters.jpg', 6],
  ['Fuel Filters', 'fuel-filters', 'Fuel filters that protect injectors and pumps.', '/images/cat-fuel-filters.jpg', 7],
  ['Brake Pads', 'brake-pads', 'OEM-grade brake pads for confident, safe stopping.', '/images/cat-brake-pads.jpg', 8],
  ['Brake Fluid', 'brake-fluid', 'DOT 3 and DOT 4 brake fluids for dependable braking.', '/images/cat-brake-fluid.jpg', 9],
  ['Stabilizer Links', 'stabilizer-links', 'Stabilizer and sway bar links for precise handling.', '/images/cat-stabilizer-links.jpg', 10],
  ['Ball Joints', 'ball-joints', 'Suspension ball joints built for Ghana roads.', '/images/cat-ball-joints.jpg', 11],
  ['Lubricants & Oils', 'lubricants-oils', 'Engine oils, gear oils and lubricants from world brands.', '/images/cat-lubricants.jpg', 12],
  ['Automotive Chemicals', 'automotive-chemicals', 'Cleaners, additives, coolants and workshop chemicals.', '/images/cat-chemicals.jpg', 13],
  ['Sealants & Epoxy', 'sealants-epoxy', 'Gasket makers, sealants and epoxies for every repair.', '/images/cat-sealants.jpg', 14]
];

/* ------------------------------------------------------------------ */
/*  VEHICLE CATALOGUE  (make, model, year range, engines)              */
/* ------------------------------------------------------------------ */
const VEHICLES = [
  ['Toyota','Corolla',2000,2019,['1.3L','1.5L','1.6L','1.8L']],
  ['Toyota','Camry',2001,2023,['2.4L','2.5L','3.5L']],
  ['Toyota','RAV4',2001,2024,['2.0L','2.4L','2.5L']],
  ['Toyota','Hilux',2005,2024,['2.7L','2.5L D-4D','3.0L D-4D','2.8L D-4D']],
  ['Toyota','Yaris',2006,2020,['1.3L','1.5L']],
  ['Toyota','Fortuner',2005,2023,['2.7L','4.0L','2.8L D-4D']],
  ['Toyota','Land Cruiser Prado',2003,2023,['2.7L','4.0L','3.0L D-4D']],
  ['Toyota','Corolla Cross',2020,2024,['1.8L']],
  ['Hyundai','Elantra',2001,2021,['1.6L','1.8L','2.0L']],
  ['Hyundai','Tucson',2005,2024,['2.0L','2.4L','1.6T-GDi']],
  ['Hyundai','Santa Fe',2001,2023,['2.2L CRDi','2.4L','3.3L']],
  ['Hyundai','Accent',2005,2018,['1.4L','1.6L']],
  ['Hyundai','i10',2010,2020,['1.1L','1.2L']],
  ['Hyundai','Sonata',2006,2019,['2.0L','2.4L']],
  ['Kia','Rio',2005,2023,['1.4L','1.6L']],
  ['Kia','Sportage',2005,2024,['2.0L','2.4L']],
  ['Kia','Sorento',2003,2023,['2.2L CRDi','2.4L','3.3L']],
  ['Kia','Picanto',2011,2020,['1.0L','1.2L']],
  ['Kia','Cerato',2004,2021,['1.6L','2.0L']],
  ['Honda','Civic',2001,2021,['1.8L','2.0L']],
  ['Honda','Accord',2003,2020,['2.4L','3.5L']],
  ['Honda','CR-V',2002,2023,['2.0L','2.4L']],
  ['Honda','Fit',2002,2020,['1.3L','1.5L']],
  ['Nissan','Sunny',2002,2015,['1.5L','1.6L']],
  ['Nissan','Teana',2004,2018,['2.0L','2.5L']],
  ['Nissan','X-Trail',2001,2022,['2.0L','2.5L']],
  ['Nissan','Navara',2005,2021,['2.5L','4.0L']],
  ['Nissan','Almera',2012,2022,['1.5L']],
  ['Mercedes-Benz','C-Class',2001,2021,['1.8T','2.0T','2.2 CDI']],
  ['Mercedes-Benz','E-Class',2003,2021,['2.0T','3.5L','2.1 CDI']],
  ['Mercedes-Benz','GLE',2015,2022,['3.0T','2.2 CDI']],
  ['Mercedes-Benz','GLA',2014,2020,['1.6T','2.0T']],
  ['BMW','3 Series',2000,2019,['2.0L','2.5L','3.0L','2.0d']],
  ['BMW','5 Series',2003,2021,['2.0T','2.5L','3.0d']],
  ['BMW','X5',2001,2021,['3.0L','4.4L','3.0d']],
  ['BMW','X3',2004,2022,['2.0L','2.0d']],
  ['Volkswagen','Golf',2000,2020,['1.6L','1.4T','2.0T','1.9 TDI','2.0 TDI']],
  ['Volkswagen','Passat',2001,2021,['1.8T','2.0T','1.9 TDI']],
  ['Volkswagen','Tiguan',2008,2022,['1.4T','2.0T','2.0 TDI']],
  ['Volkswagen','Jetta',2005,2019,['1.4T','2.0T']],
  ['Ford','Ranger',2006,2022,['2.2 TDCi','2.5L','3.2 TDCi']],
  ['Ford','Focus',2005,2018,['1.6L','2.0L','1.6 TDCi']],
  ['Ford','Escape',2008,2019,['2.5L','2.0T']],
  ['Ford','Fiesta',2009,2017,['1.4L','1.6L']],
  ['Suzuki','Swift',2005,2024,['1.2L','1.3L','1.4L']],
  ['Suzuki','Vitara',2005,2022,['1.6L','2.0L','1.4T']],
  ['Suzuki','Alto',2005,2014,['1.0L','1.1L']],
  ['Suzuki','Jimny',2010,2022,['1.3L','1.5L']],
  ['Mitsubishi','Lancer',2001,2017,['1.5L','1.6L','2.0L']],
  ['Mitsubishi','Pajero',2001,2021,['3.2 DiD','3.5L','3.8L']],
  ['Mitsubishi','Outlander',2005,2021,['2.0L','2.4L','2.2 DiD']],
  ['Mitsubishi','ASX',2010,2022,['1.6L','2.0L']],
  ['Chevrolet','Cruze',2010,2018,['1.6L','1.8L','1.4T']],
  ['Chevrolet','Equinox',2010,2019,['2.4L','2.0T']],
  ['Chevrolet','Malibu',2010,2018,['2.4L','2.0T']],
  ['Chevrolet','Aveo',2005,2014,['1.4L','1.6L']],
  ['Mazda','Mazda 3',2004,2019,['1.6L','2.0L']],
  ['Mazda','Mazda 6',2002,2021,['2.0L','2.5L']],
  ['Mazda','CX-5',2012,2022,['2.0L','2.2D','2.5L']],
  ['Mazda','Demio',2007,2014,['1.3L','1.5L']],
  ['Peugeot','307',2001,2009,['1.6L','2.0 HDi']],
  ['Peugeot','308',2008,2021,['1.6 VTi','1.6 HDi']],
  ['Peugeot','508',2011,2018,['1.6L','2.0 HDi']],
  ['Peugeot','3008',2009,2020,['1.6L','2.0 HDi']],
  ['Lexus','RX 350',2004,2022,['3.5L']],
  ['Lexus','ES 350',2007,2020,['3.5L']],
  ['Lexus','IS 250',2006,2015,['2.5L']]
];

/* ------------------------------------------------------------------ */
/*  PRODUCTS                                                           */
/*  compat strings: "Make:Model:2000-2019:1.6L|1.8L"  or  "Universal"  */
/* ------------------------------------------------------------------ */
const PRODUCTS = [
  // ---- SPARK PLUGS ----
  { pn:'NGK-BKR6E-11', name:'NGK BKR6E-11 Standard Spark Plug', brand:'NGK', cat:'spark-plugs', price:85, stock:240, featured:1, img:'/images/prod-ngk-spark.jpg',
    desc:'Genuine NGK copper-core spark plug, pre-gapped for Toyota, Honda and Hyundai engines. The trusted OEM choice for smooth idle and reliable ignition.',
    compat:['Toyota:Corolla:2000-2019:1.6L|1.8L','Toyota:Camry:2002-2011:2.4L','Toyota:RAV4:2006-2012:2.4L','Honda:Civic:2006-2011:1.8L','Hyundai:Elantra:2006-2010:1.6L','Kia:Sportage:2005-2010:2.0L','Nissan:Sunny:2002-2012:1.5L','Suzuki:Swift:2005-2014:1.3L','Mazda:Mazda 3:2004-2009:1.6L'] },
  { pn:'NGK-BKR6EIX-11', name:'NGK Iridium IX BKR6EIX-11 Spark Plug', brand:'NGK', cat:'spark-plugs', price:165, stock:120, featured:0, img:'',
    desc:'Iridium IX spark plug with 0.6mm fine-wire centre electrode for faster ignition, better fuel economy and up to 80,000 km service life.',
    compat:['Toyota:Corolla:2007-2013:1.6L|1.8L','Honda:Civic:2006-2011:1.8L','Honda:Fit:2007-2013:1.3L|1.5L','Hyundai:Elantra:2006-2010:1.6L','Nissan:Sunny:2002-2012:1.5L'] },
  { pn:'DENSO-K20PR-U11', name:'Denso K20PR-U11 Spark Plug', brand:'Denso', cat:'spark-plugs', price:95, stock:180, featured:0, img:'',
    desc:'Genuine Denso standard spark plug. OE-quality construction for Toyota, Honda and Kia petrol engines.',
    compat:['Toyota:Corolla:2000-2007:1.3L|1.5L|1.6L','Toyota:Yaris:2006-2011:1.3L','Kia:Rio:2005-2011:1.4L','Honda:Accord:2003-2007:2.4L','Mazda:Mazda 3:2004-2009:1.6L'] },
  { pn:'CHAMP-RC12YC', name:'Champion RC12YC Spark Plug', brand:'Champion', cat:'spark-plugs', price:70, stock:200, featured:0, img:'',
    desc:'Copper core spark plug with ribbed ceramic insulator. A dependable budget-friendly replacement for older engines.',
    compat:['Toyota:Corolla:2000-2007:1.3L|1.5L|1.6L','Nissan:Sunny:2002-2012:1.5L|1.6L','Suzuki:Alto:2005-2014:1.0L|1.1L','Chevrolet:Aveo:2005-2014:1.4L|1.6L','Hyundai:Accent:2005-2010:1.4L'] },
  { pn:'DENSO-IKH20TT', name:'Denso IKH20TT Iridium TT Spark Plug', brand:'Denso', cat:'spark-plugs', price:185, stock:75, featured:0, img:'',
    desc:'Twin-tip Iridium TT spark plug delivering ultra-durable long-life ignition for modern engines.',
    compat:['Toyota:Corolla:2013-2019:1.6L|1.8L','Toyota:Camry:2012-2017:2.5L','Honda:Civic:2012-2015:1.8L','Kia:Rio:2012-2017:1.4L|1.6L','Hyundai:Elantra:2011-2016:1.8L'] },
  { pn:'BOSCH-FR8DCX', name:'Bosch FR8DCX Super Spark Plug', brand:'Bosch', cat:'spark-plugs', price:90, stock:160, featured:0, img:'',
    desc:'Bosch Super spark plug with yttrium-enhanced ground electrode. OE-fitment for European and Asian vehicles.',
    compat:['Volkswagen:Golf:2000-2008:1.6L','Volkswagen:Jetta:2005-2010:1.6L','BMW:3 Series:2000-2005:2.0L|2.5L','Mercedes-Benz:C-Class:2001-2007:1.8T'] },

  // ---- IGNITION COILS ----
  { pn:'DENSO-90919-02240', name:'Denso 90919-02240 Ignition Coil', brand:'Denso', cat:'ignition-coils', price:420, stock:60, featured:1, img:'/images/prod-denso-coil.jpg',
    desc:'Genuine Denso pencil-type ignition coil, OE part for Toyota Corolla and Camry 1.8L / 2.4L engines. Direct fit — no modification required.',
    compat:['Toyota:Corolla:2001-2007:1.8L','Toyota:Camry:2002-2006:2.4L','Toyota:RAV4:2001-2005:2.0L'] },
  { pn:'BOSCH-0221504470', name:'Bosch 0221504470 Ignition Coil', brand:'Bosch', cat:'ignition-coils', price:450, stock:45, featured:0, img:'',
    desc:'Bosch ignition coil with integrated igniter, designed for Volkswagen 1.8T and 2.0T engines.',
    compat:['Volkswagen:Passat:2001-2010:1.8T|2.0T','Volkswagen:Golf:2005-2012:1.4T|2.0T','Volkswagen:Jetta:2005-2014:1.4T|2.0T'] },
  { pn:'DELPHI-GN10184', name:'Delphi GN10184 Ignition Coil', brand:'Delphi', cat:'ignition-coils', price:380, stock:55, featured:0, img:'',
    desc:'Delphi ignition coil manufactured to OE tolerances for General Motors and Chevrolet models.',
    compat:['Chevrolet:Cruze:2010-2016:1.6L|1.8L','Chevrolet:Malibu:2010-2016:2.4L','Chevrolet:Equinox:2010-2015:2.4L'] },
  { pn:'NGK-U5070', name:'NGK U5070 Ignition Coil', brand:'NGK', cat:'ignition-coils', price:460, stock:40, featured:0, img:'',
    desc:'NGK U5070 coil-on-plug unit for Hyundai and Kia petrol engines. Oil-filled, waterproof construction.',
    compat:['Hyundai:Elantra:2006-2010:1.6L|2.0L','Hyundai:Tucson:2005-2010:2.0L','Kia:Sportage:2005-2010:2.0L','Kia:Rio:2005-2011:1.4L|1.6L'] },
  { pn:'STD-ICP113', name:'Standard Motor ICP113 Ignition Coil', brand:'Standard Motor', cat:'ignition-coils', price:350, stock:70, featured:0, img:'',
    desc:'Standard Motor Products coil for Nissan engines. Delivers consistent high-voltage output.',
    compat:['Nissan:Sunny:2002-2012:1.5L|1.6L','Nissan:Almera:2012-2019:1.5L'] },

  // ---- FUEL PUMPS ----
  { pn:'BOSCH-0580314042', name:'Bosch 0580314042 Fuel Pump', brand:'Bosch', cat:'fuel-pumps', price:1250, stock:18, featured:1, img:'/images/prod-bosch-fuelpump.jpg',
    desc:'Genuine Bosch electric fuel pump, OE for Toyota Corolla and Camry. Maintains stable fuel pressure for reliable starting and smooth running.',
    compat:['Toyota:Corolla:2000-2007:1.6L|1.8L','Toyota:Camry:2002-2006:2.4L'] },
  { pn:'DENSO-951-0001', name:'Denso 951-0001 Fuel Pump', brand:'Denso', cat:'fuel-pumps', price:1380, stock:12, featured:0, img:'',
    desc:'Denso fuel pump module for Honda Accord and Civic. Premium Japanese quality with long service life.',
    compat:['Honda:Accord:2003-2007:2.4L','Honda:Civic:2006-2011:1.8L'] },
  { pn:'ACDELCO-EP381', name:'ACDelco EP381 Fuel Pump', brand:'ACDelco', cat:'fuel-pumps', price:990, stock:25, featured:0, img:'',
    desc:'ACDelco electric fuel pump for Chevrolet and GM vehicles. GM OE supplier quality.',
    compat:['Chevrolet:Cruze:2010-2016:1.8L','Chevrolet:Aveo:2005-2014:1.4L|1.6L','Chevrolet:Malibu:2010-2016:2.4L'] },
  { pn:'DELPHI-FE0364', name:'Delphi FE0364 Fuel Pump', brand:'Delphi', cat:'fuel-pumps', price:1150, stock:20, featured:0, img:'',
    desc:'Delphi fuel pump assembly for Nissan Sunny and Almera petrol models. Plug-and-play fitment.',
    compat:['Nissan:Sunny:2002-2012:1.5L|1.6L','Nissan:Almera:2012-2019:1.5L'] },

  // ---- OIL FILTERS ----
  { pn:'MANN-W712/90', name:'Mann-Filter W 712/90 Oil Filter', brand:'Mann-Filter', cat:'oil-filters', price:120, stock:150, featured:0, img:'',
    desc:'German-engineered oil filter with high filtration capacity for Volkswagen, Audi and Skoda petrol and diesel engines.',
    compat:['Volkswagen:Golf:2000-2012:1.6L|1.4T|1.9 TDI','Volkswagen:Passat:2001-2015:1.8T|2.0T','Volkswagen:Jetta:2005-2016:1.4T|2.0T','Volkswagen:Tiguan:2008-2018:1.4T|2.0T'] },
  { pn:'TOYOTA-90915-YZZD1', name:'Toyota Genuine 90915-YZZD1 Oil Filter', brand:'Toyota Genuine', cat:'oil-filters', price:95, stock:320, featured:1, img:'/images/prod-toyota-oilfilter.jpg',
    desc:'Toyota genuine spin-on oil filter with anti-drainback valve. The exact filter specified for Toyota models — always a perfect fit.',
    compat:['Toyota:Corolla:2000-2019:1.3L|1.5L|1.6L|1.8L','Toyota:Camry:2002-2017:2.4L|2.5L','Toyota:RAV4:2001-2018:2.0L|2.4L|2.5L','Toyota:Yaris:2006-2019:1.3L|1.5L','Toyota:Fortuner:2005-2015:2.7L|4.0L','Toyota:Land Cruiser Prado:2003-2015:2.7L|4.0L'] },
  { pn:'BOSCH-0451103316', name:'Bosch 0451103316 Oil Filter', brand:'Bosch', cat:'oil-filters', price:85, stock:210, featured:0, img:'',
    desc:'Bosch oil filter engineered for Honda petrol engines. High-efficiency media keeps oil clean between services.',
    compat:['Honda:Civic:2001-2015:1.8L','Honda:Accord:2003-2017:2.4L','Honda:CR-V:2002-2016:2.0L|2.4L','Honda:Fit:2002-2015:1.3L|1.5L'] },
  { pn:'FRAM-PH7317', name:'Fram PH7317 Oil Filter', brand:'Fram', cat:'oil-filters', price:78, stock:260, featured:0, img:'',
    desc:'Fram Extra Guard oil filter with silicone anti-drainback valve. Broad compatibility across Asian and American engines.',
    compat:['Nissan:Sunny:2002-2012:1.5L|1.6L','Nissan:X-Trail:2001-2015:2.0L|2.5L','Mitsubishi:Lancer:2001-2015:1.5L|1.6L|2.0L','Suzuki:Swift:2005-2017:1.2L|1.3L|1.4L','Hyundai:Elantra:2001-2015:1.6L|1.8L|2.0L'] },
  { pn:'MANN-W811/80', name:'Mann-Filter W 811/80 Oil Filter', brand:'Mann-Filter', cat:'oil-filters', price:110, stock:140, featured:0, img:'',
    desc:'Premium Mann oil filter for Mercedes-Benz and BMW engines. Excellent filtration and flow characteristics.',
    compat:['Mercedes-Benz:C-Class:2001-2014:1.8T|2.2 CDI','Mercedes-Benz:E-Class:2003-2016:2.0T|2.1 CDI','BMW:3 Series:2000-2012:2.0L|2.5L|2.0d','BMW:X5:2001-2013:3.0L|3.0d'] },

  // ---- AIR FILTERS ----
  { pn:'KN-33-2204', name:'K&N 33-2204 High-Flow Air Filter', brand:'K&N', cat:'air-filters', price:480, stock:35, featured:1, img:'/images/prod-kn-airfilter.jpg',
    desc:'K&N high-flow cotton air filter, washable and reusable. Increases airflow for better throttle response. Fits Toyota Corolla 2003–2008.',
    compat:['Toyota:Corolla:2003-2008:1.6L|1.8L'] },
  { pn:'MANN-C30155', name:'Mann-Filter C 30 155 Air Filter', brand:'Mann-Filter', cat:'air-filters', price:185, stock:90, featured:0, img:'',
    desc:'Mann air filter panel with high dust-holding capacity for Volkswagen Golf and Jetta.',
    compat:['Volkswagen:Golf:2003-2012:1.6L|1.4T','Volkswagen:Jetta:2005-2014:1.4T|2.0T'] },
  { pn:'BOSCH-S3525', name:'Bosch S3525 Air Filter', brand:'Bosch', cat:'air-filters', price:170, stock:85, featured:0, img:'',
    desc:'Bosch engine air filter for Honda Civic and Fit models. Protects the engine from dust and debris.',
    compat:['Honda:Civic:2006-2015:1.8L','Honda:Fit:2007-2015:1.3L|1.5L'] },
  { pn:'TOYOTA-17801-0T020', name:'Toyota Genuine 17801-0T020 Air Filter', brand:'Toyota Genuine', cat:'air-filters', price:160, stock:180, featured:0, img:'',
    desc:'Toyota genuine air filter element for Corolla and Camry models. Engineered for optimal airflow and filtration.',
    compat:['Toyota:Corolla:2008-2013:1.6L|1.8L','Toyota:Camry:2007-2011:2.4L'] },

  // ---- AC / CABIN FILTERS ----
  { pn:'MANN-CU2212', name:'Mann-Filter CU 22 12 Cabin Filter', brand:'Mann-Filter', cat:'ac-filters', price:160, stock:95, featured:1, img:'',
    desc:'Cabin air filter with activated carbon layer. Removes dust, pollen and odours from the air you breathe inside the car.',
    compat:['Volkswagen:Golf:2003-2012:1.6L|1.4T|2.0T','Volkswagen:Passat:2005-2015:1.8T|2.0T','Volkswagen:Tiguan:2008-2018:1.4T|2.0T'] },
  { pn:'TOYOTA-87139-0R010', name:'Toyota Genuine 87139-0R010 Cabin Filter', brand:'Toyota Genuine', cat:'ac-filters', price:145, stock:160, featured:0, img:'',
    desc:'Toyota genuine cabin air filter for Corolla and RAV4. Keeps AC performance and cabin air quality at factory levels.',
    compat:['Toyota:Corolla:2008-2019:1.6L|1.8L','Toyota:RAV4:2006-2018:2.0L|2.4L|2.5L','Toyota:Camry:2012-2017:2.5L'] },
  { pn:'BOSCH-1987432221', name:'Bosch 1987432221 Cabin Filter', brand:'Bosch', cat:'ac-filters', price:150, stock:110, featured:0, img:'',
    desc:'Bosch activated-carbon cabin filter for BMW 3 Series and X3. Filters fine particles and neutralises odours.',
    compat:['BMW:3 Series:2005-2013:2.0L|2.5L|3.0L','BMW:X3:2004-2010:2.0L|3.0L'] },
  { pn:'DENSO-DCF030-P', name:'Denso DCF030-P Cabin Filter', brand:'Denso', cat:'ac-filters', price:140, stock:105, featured:0, img:'',
    desc:'Denso cabin filter for Honda and Nissan models. Multi-layer filtration for cleaner cabin air.',
    compat:['Honda:Civic:2012-2015:1.8L','Honda:CR-V:2012-2016:2.0L|2.4L','Nissan:X-Trail:2013-2022:2.0L|2.5L','Nissan:Almera:2012-2019:1.5L'] },

  // ---- FUEL FILTERS ----
  { pn:'BOSCH-0450908141', name:'Bosch 0450908141 Fuel Filter', brand:'Bosch', cat:'fuel-filters', price:260, stock:65, featured:1, img:'',
    desc:'Bosch inline fuel filter with 5-micron filtration for Volkswagen petrol and diesel engines. Protects injectors and fuel pump.',
    compat:['Volkswagen:Golf:2000-2012:1.6L|1.4T|1.9 TDI','Volkswagen:Passat:2001-2010:1.8T|1.9 TDI','Volkswagen:Jetta:2005-2014:1.4T|2.0T'] },
  { pn:'TOYOTA-23390-0R010', name:'Toyota Genuine 23390-0R010 Fuel Filter', brand:'Toyota Genuine', cat:'fuel-filters', price:240, stock:80, featured:0, img:'',
    desc:'Toyota genuine fuel filter for Corolla, Yaris and RAV4. Keeps fuel clean and injectors working at peak performance.',
    compat:['Toyota:Corolla:2000-2013:1.5L|1.6L|1.8L','Toyota:Yaris:2006-2019:1.3L|1.5L','Toyota:RAV4:2001-2012:2.0L|2.4L'] },
  { pn:'MANN-WK31-8', name:'Mann-Filter WK 31/8 Fuel Filter', brand:'Mann-Filter', cat:'fuel-filters', price:220, stock:70, featured:0, img:'',
    desc:'Mann fuel filter for Mercedes-Benz diesel engines. High-efficiency separation of water and contaminants.',
    compat:['Mercedes-Benz:C-Class:2007-2014:2.2 CDI','Mercedes-Benz:E-Class:2009-2016:2.1 CDI'] },

  // ---- BRAKE PADS ----
  { pn:'BOSCH-BC1119', name:'Bosch BC1119 Brake Pad Set', brand:'Bosch', cat:'brake-pads', price:420, stock:75, featured:1, img:'/images/prod-bosch-brakepads.jpg',
    desc:'Bosch front brake pad set for Toyota Corolla and Camry. Low-dust, low-noise compound with excellent stopping power.',
    compat:['Toyota:Corolla:2003-2008:1.6L|1.8L','Toyota:Camry:2002-2006:2.4L'] },
  { pn:'BREMBO-P49040', name:'Brembo P49040 Brake Pads', brand:'Brembo', cat:'brake-pads', price:560, stock:40, featured:0, img:'',
    desc:'Brembo Prime brake pads for Honda Civic. Race-bred friction technology for daily driving confidence.',
    compat:['Honda:Civic:2006-2015:1.8L'] },
  { pn:'TOYOTA-04465-0R010', name:'Toyota Genuine 04465-0R010 Brake Pads', brand:'Toyota Genuine', cat:'brake-pads', price:380, stock:130, featured:0, img:'',
    desc:'Toyota genuine front brake pad set. Factory friction material for consistent, quiet braking.',
    compat:['Toyota:Corolla:2008-2013:1.6L|1.8L','Toyota:RAV4:2006-2012:2.0L|2.4L','Toyota:Yaris:2006-2011:1.3L|1.5L'] },
  { pn:'FERODO-FDB4040', name:'Ferodo FDB4040 Brake Pads', brand:'Ferodo', cat:'brake-pads', price:350, stock:90, featured:0, img:'',
    desc:'Ferodo Premier front pads for Hyundai and Kia. Low wear with stable performance in all conditions.',
    compat:['Hyundai:Elantra:2006-2015:1.6L|1.8L','Hyundai:Tucson:2005-2015:2.0L','Kia:Sportage:2005-2015:2.0L','Kia:Rio:2005-2017:1.4L|1.6L'] },

  // ---- BRAKE FLUID ----
  { pn:'BOSCH-DOT4-1L', name:'Bosch DOT 4 Brake Fluid 1L', brand:'Bosch', cat:'brake-fluid', price:130, stock:150, featured:1, img:'',
    desc:'High-performance DOT 4 brake fluid with a dry boiling point of 260°C. Suitable for all vehicles specifying DOT 3 or DOT 4.',
    compat:['Universal'] },
  { pn:'CASTROL-DOT4-500', name:'Castrol DOT 4 Brake Fluid 500ml', brand:'Castrol', cat:'brake-fluid', price:95, stock:180, featured:0, img:'',
    desc:'Castrol DOT 4 brake fluid for dependable braking in heat and humidity. Meets FMVSS 116 DOT 4 standards.',
    compat:['Universal'] },
  { pn:'TOYOTA-DOT3-1L', name:'Toyota Genuine DOT 3 Brake Fluid 1L', brand:'Toyota Genuine', cat:'brake-fluid', price:110, stock:140, featured:0, img:'',
    desc:'Toyota genuine DOT 3 brake fluid — the recommended fluid for Toyota and Lexus braking systems.',
    compat:['Universal'] },

  // ---- STABILIZER LINKS ----
  { pn:'MOOG-K90376', name:'MOOG K90376 Stabilizer Link', brand:'MOOG', cat:'stabilizer-links', price:190, stock:85, featured:0, img:'',
    desc:'MOOG premium stabilizer link with sealed, greased ball sockets. Restores sharp, quiet cornering.',
    compat:['Toyota:Corolla:2003-2008:1.6L|1.8L'] },
  { pn:'DELPHI-TC2814', name:'Delphi TC2814 Stabilizer Link', brand:'Delphi', cat:'stabilizer-links', price:175, stock:70, featured:0, img:'',
    desc:'Delphi stabilizer link for Honda CR-V. Corrosion-resistant finish for long service life.',
    compat:['Honda:CR-V:2007-2011:2.0L|2.4L'] },
  { pn:'FEBI-29410', name:'Febi 29410 Stabilizer Link', brand:'Febi Bilstein', cat:'stabilizer-links', price:165, stock:95, featured:0, img:'',
    desc:'Febi Bilstein sway bar link for Volkswagen Golf and Jetta. OE-quality ball sockets and boots.',
    compat:['Volkswagen:Golf:2003-2012:1.6L|1.4T|2.0T','Volkswagen:Jetta:2005-2014:1.4T|2.0T'] },
  { pn:'555-SB-2394', name:'555 SB-2394 Stabilizer Link', brand:'555', cat:'stabilizer-links', price:150, stock:100, featured:0, img:'',
    desc:'555-brand stabilizer link for Nissan X-Trail. Japanese quality at an affordable price.',
    compat:['Nissan:X-Trail:2007-2013:2.0L|2.5L'] },

  // ---- BALL JOINTS ----
  { pn:'MOOG-K9529', name:'MOOG K9529 Ball Joint', brand:'MOOG', cat:'ball-joints', price:230, stock:60, featured:1, img:'/images/prod-moog-balljoint.jpg',
    desc:'MOOG Problem Solver lower ball joint for Toyota Corolla. Powdered metal gusher bearing and greasable design for durability.',
    compat:['Toyota:Corolla:2003-2008:1.6L|1.8L'] },
  { pn:'DELPHI-TC1435', name:'Delphi TC1435 Ball Joint', brand:'Delphi', cat:'ball-joints', price:210, stock:55, featured:0, img:'',
    desc:'Delphi ball joint for Honda Civic. Precision-machined housing with pre-installed grease.',
    compat:['Honda:Civic:2006-2011:1.8L'] },
  { pn:'555-SB-2161', name:'555 SB-2161 Ball Joint', brand:'555', cat:'ball-joints', price:185, stock:75, featured:0, img:'',
    desc:'555 lower ball joint for Nissan Sunny and Almera. Built to withstand tough road conditions.',
    compat:['Nissan:Sunny:2002-2012:1.5L|1.6L','Nissan:Almera:2012-2019:1.5L'] },
  { pn:'FEBI-05310', name:'Febi 05310 Ball Joint', brand:'Febi Bilstein', cat:'ball-joints', price:195, stock:65, featured:0, img:'',
    desc:'Febi Bilstein control arm ball joint for Volkswagen models. OE specification rubber boot.',
    compat:['Volkswagen:Golf:2003-2012:1.6L|1.4T','Volkswagen:Passat:2005-2010:1.8T'] },

  // ---- LUBRICANTS & OILS ----
  { pn:'MOBIL1-5W30-4L', name:'Mobil 1 Fully Synthetic 5W-30 Engine Oil 4L', brand:'Mobil 1', cat:'lubricants-oils', price:850, stock:120, featured:1, img:'/images/prod-mobil1-oil.jpg',
    desc:'Mobil 1 advanced full-synthetic 5W-30 for outstanding engine protection and performance in all seasons. Suitable for petrol and diesel engines.',
    compat:['Universal'] },
  { pn:'CASTROL-MAG-10W40-4L', name:'Castrol Magnatec 10W-40 Engine Oil 4L', brand:'Castrol', cat:'lubricants-oils', price:620, stock:150, featured:0, img:'',
    desc:'Castrol Magnatec with Smart Molecules that cling to the engine, protecting from the moment you start. Ideal for everyday driving.',
    compat:['Universal'] },
  { pn:'SHELL-HX5-20W50-4L', name:'Shell Helix HX5 20W-50 Engine Oil 4L', brand:'Shell Helix', cat:'lubricants-oils', price:540, stock:200, featured:0, img:'',
    desc:'Shell Helix HX5 20W-50 — proven protection for older and high-mileage engines. Popular choice for African road conditions.',
    compat:['Universal'] },
  { pn:'TOYOTA-TGMO-5W30-4L', name:'Toyota Genuine Motor Oil 5W-30 4L', brand:'Toyota Genuine', cat:'lubricants-oils', price:680, stock:110, featured:0, img:'',
    desc:'Toyota Genuine Motor Oil, formulated for Toyota engines to deliver clean, reliable performance between services.',
    compat:['Universal'] },
  { pn:'TOTAL-QUARTZ-10W40-4L', name:'Total Quartz 7000 10W-40 Engine Oil 4L', brand:'TotalEnergies', cat:'lubricants-oils', price:480, stock:170, featured:0, img:'',
    desc:'Total Quartz 7000 semi-synthetic 10W-40. Excellent engine cleanliness and wear protection for everyday vehicles.',
    compat:['Universal'] },
  { pn:'CASTROL-SYNTRAX-75W90', name:'Castrol Syntrax 75W-90 Gear Oil 1L', brand:'Castrol', cat:'lubricants-oils', price:220, stock:90, featured:0, img:'',
    desc:'Castrol Syntrax Long Life 75W-90 for manual gearboxes and differentials. High load-carrying capacity with long service life.',
    compat:['Universal'] },

  // ---- AUTOMOTIVE CHEMICALS ----
  { pn:'LIQUIMOLY-5110', name:'Liqui Moly Fuel System Cleaner 300ml', brand:'Liqui Moly', cat:'automotive-chemicals', price:180, stock:140, featured:0, img:'',
    desc:'Liqui Moly fuel system cleaner removes deposits from injectors, valves and combustion chambers. Add to the fuel tank.',
    compat:['Universal'] },
  { pn:'WD40-400ML', name:'WD-40 Multi-Use Product 400ml', brand:'WD-40', cat:'automotive-chemicals', price:120, stock:300, featured:0, img:'',
    desc:'The classic WD-40 multi-use lubricant. Protects metal from rust, displaces moisture and loosens stuck parts.',
    compat:['Universal'] },
  { pn:'LIQUIMOLY-7502', name:'Liqui Moly Engine Flush 300ml', brand:'Liqui Moly', cat:'automotive-chemicals', price:165, stock:120, featured:0, img:'',
    desc:'Engine flush that removes sludge and deposits before an oil change. Add to warm oil, idle 10 minutes, then drain.',
    compat:['Universal'] },
  { pn:'PRESTONE-AF888', name:'Prestone Antifreeze / Coolant 3.78L', brand:'Prestone', cat:'automotive-chemicals', price:250, stock:95, featured:0, img:'',
    desc:'Prestone all-makes coolant with anti-corrosion protection. Ready-to-use for most cooling systems.',
    compat:['Universal'] },

  // ---- SEALANTS & EPOXY ----
  { pn:'PERMATEX-82180', name:'Permatex RTV Silicone Gasket Maker 85g', brand:'Permatex', cat:'sealants-epoxy', price:110, stock:130, featured:0, img:'',
    desc:'Permatex RTV silicone gasket maker for valve covers, oil pans and water pumps. Sensor-safe formula.',
    compat:['Universal'] },
  { pn:'JBWELD-8276', name:'J-B Weld KwikWeld Epoxy 24ml', brand:'J-B Weld', cat:'sealants-epoxy', price:140, stock:85, featured:0, img:'',
    desc:'Two-part steel-reinforced epoxy that sets in 6 minutes and cures to a strong bond. Repairs metal, plastic and more.',
    compat:['Universal'] },
  { pn:'LOCTITE-243-50ML', name:'Loctite 243 Threadlocker 50ml', brand:'Loctite', cat:'sealants-epoxy', price:130, stock:100, featured:0, img:'',
    desc:'Loctite 243 medium-strength threadlocker seals and locks threaded fasteners. Oil-tolerant formula for assembly.',
    compat:['Universal'] },
  { pn:'PERMATEX-101B', name:'Permatex Ultra Copper Gasket Maker 100g', brand:'Permatex', cat:'sealants-epoxy', price:115, stock:110, featured:0, img:'',
    desc:'High-temp copper RTV gasket maker for exhaust manifolds and high-heat applications. Withstands up to 371°C.',
    compat:['Universal'] }
];

/* ------------------------------------------------------------------ */
/*  SETTINGS                                                           */
/* ------------------------------------------------------------------ */
const SETTINGS = {
  site_name: 'PLUS 233 AUTOMASTER',
  motto: 'Home of Trusted Parts. Superior Performance.',
  address: '28 Chemu Rd, Accra, Down-Right',
  phone: '+233 000 000 0000',
  email: 'sales@plus233automaster.com',
  hours: 'Mon – Sat: 8:00 AM – 6:00 PM',
  currency: 'GHS',
  delivery_fee_accra: '40',
  delivery_fee_nationwide: '90',
  free_delivery_over: '1500',
  facebook_url: 'https://www.facebook.com/search/top?q=Plus%20Auto%20master',
  facebook_label: 'Plus Auto master',
  instagram_url: 'https://www.instagram.com/explore/search/keyword/?q=PluS%20233%20Auto%20Master',
  instagram_label: 'PluS 233 Auto Master',
  tiktok_url: 'https://www.tiktok.com/search?q=PluS%20233%20Auto%20Master',
  tiktok_label: 'PluS 233 Auto Master',
  maps_url: 'https://www.google.com/maps/search/?api=1&query=28+Chemu+Rd+Accra+Ghana'
};

/* ------------------------------------------------------------------ */
/*  SEED                                                               */
/* ------------------------------------------------------------------ */
function parseCompat(str) {
  if (!str) return null;
  if (str === 'Universal') return { make: 'Universal', model: 'All', year_start: 0, year_end: 9999, engine: '' };
  const m = str.match(/^([^:]+):([^:]+):(\d{4})-(\d{4})(?::(.*))?$/);
  if (!m) throw new Error('Bad compat string: ' + str);
  return { make: m[1], model: m[2], year_start: +m[3], year_end: +m[4], engine: m[5] ? m[5].split('|').map(s => s.trim()).join('|') : '' };
}

function seed() {
  const count = db.prepare('SELECT COUNT(*) c FROM products').get().c;
  if (count > 0 && !process.env.FORCE) {
    console.log('Database already seeded (' + count + ' products). Use FORCE=1 to re-seed.');
    return false;
  }

  db.exec('DELETE FROM order_items; DELETE FROM orders; DELETE FROM customers; DELETE FROM product_compatibility; DELETE FROM products; DELETE FROM categories; DELETE FROM vehicles; DELETE FROM users; DELETE FROM settings; DELETE FROM messages;');

  // settings
  const insSetting = db.prepare('INSERT INTO settings (key, value) VALUES (?, ?)');
  for (const [k, v] of Object.entries(SETTINGS)) insSetting.run(k, String(v));

  // categories
  const insCat = db.prepare('INSERT INTO categories (name, slug, description, image, sort_order) VALUES (?,?,?,?,?)');
  const catSlugToId = {};
  for (const [name, slug, desc, img, order] of CATEGORIES) {
    const r = insCat.run(name, slug, desc, img, order);
    catSlugToId[slug] = r.lastInsertRowid;
  }

  // vehicles
  const insVeh = db.prepare('INSERT INTO vehicles (make, model, year_start, year_end, engines) VALUES (?,?,?,?,?)');
  for (const [make, model, ys, ye, eng] of VEHICLES) insVeh.run(make, model, ys, ye, eng.join(','));

  // products + compatibility
  const insProd = db.prepare(`INSERT INTO products (part_number, name, brand, category_id, description, price_ghs, stock_qty, low_stock_at, image_url, featured, active)
    VALUES (@pn, @name, @brand, @cat, @desc, @price, @stock, @low, @img, @featured, 1)`);
  const insCompat = db.prepare('INSERT INTO product_compatibility (product_id, make, model, year_start, year_end, engine) VALUES (?,?,?,?,?,?)');
  const tx = db.transaction(() => {
    for (const p of PRODUCTS) {
      const r = insProd.run({
        pn: p.pn, name: p.name, brand: p.brand, cat: catSlugToId[p.cat],
        desc: p.desc, price: p.price, stock: p.stock, low: 10,
        img: p.img || CATEGORIES.find(c => c[1] === p.cat)[3],
        featured: p.featured
      });
      for (const c of p.compat) {
        const row = parseCompat(c);
        insCompat.run(r.lastInsertRowid, row.make, row.model, row.year_start, row.year_end, row.engine);
      }
    }
  });
  tx();

  // admin user (default: admin / admin123 — change in production!)
  const pw = hashPassword('admin123');
  db.prepare('INSERT INTO users (username, password_hash, full_name, role) VALUES (?,?,?,?)')
    .run('admin', pw, 'Store Administrator', 'admin');

  const prodCount = db.prepare('SELECT COUNT(*) c FROM products').get().c;
  console.log(`Seeded: ${CATEGORIES.length} categories, ${VEHICLES.length} vehicle models, ${prodCount} products, 1 admin user.`);
  return true;
}

module.exports = { seed, parseCompat, hashPassword };

// Run directly: node db/seed.js
if (require.main === module) {
  seed();
}
