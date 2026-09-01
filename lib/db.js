const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DATA_FILE = path.join(__dirname, '..', 'data', 'data.json');

function emptyDB() {
  return {
    locations: {
      'cafe-centro': {
        slug: 'cafe-centro',
        name: 'Cafe Central',
        visitsForReward: 10,
        rewardMessage: 'Un cafe gratis',
      },
    },
    customers: {},
    campaignLog: [],
  };
}

function load() {
  if (!fs.existsSync(DATA_FILE)) {
    save(emptyDB());
  }
  const raw = fs.readFileSync(DATA_FILE, 'utf-8');
  return JSON.parse(raw);
}

function save(db) {
  fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
  fs.writeFileSync(DATA_FILE, JSON.stringify(db, null, 2));
}

function getLocation(slug) {
  const db = load();
  return db.locations[slug] || null;
}

function listLocations() {
  const db = load();
  return Object.values(db.locations);
}

function upsertLocation(slug, data) {
  const db = load();
  db.locations[slug] = { ...(db.locations[slug] || {}), slug, ...data };
  save(db);
  return db.locations[slug];
}

function getCustomer(id) {
  const db = load();
  return db.customers[id] || null;
}

function findCustomerByPhone(locationSlug, phone) {
  const db = load();
  return Object.values(db.customers).find(
    (c) => c.locationSlug === locationSlug && c.phone === phone
  ) || null;
}

function createCustomer({ name, phone, locationSlug }) {
  const db = load();
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const customer = {
    id,
    name,
    phone,
    locationSlug,
    visits: 1,
    createdAt: now,
    lastVisitAt: now,
    walletSerial: null,
    walletShareUrl: null,
  };
  db.customers[id] = customer;
  save(db);
  return customer;
}

function addVisit(customerId) {
  const db = load();
  const customer = db.customers[customerId];
  if (!customer) return null;
  customer.visits += 1;
  customer.lastVisitAt = new Date().toISOString();
  save(db);
  return customer;
}

function setWalletInfo(customerId, { walletSerial, walletShareUrl }) {
  const db = load();
  const customer = db.customers[customerId];
  if (!customer) return null;
  customer.walletSerial = walletSerial;
  customer.walletShareUrl = walletShareUrl;
  save(db);
  return customer;
}

function listCustomersByLocation(locationSlug) {
  const db = load();
  return Object.values(db.customers)
    .filter((c) => c.locationSlug === locationSlug)
    .sort((a, b) => new Date(b.lastVisitAt) - new Date(a.lastVisitAt));
}

function segmentFor(customer) {
  const daysSinceVisit =
    (Date.now() - new Date(customer.lastVisitAt).getTime()) / (1000 * 60 * 60 * 24);
  if (daysSinceVisit > 20) return 'inactivo';
  if (customer.visits >= 5) return 'frecuente';
  return 'nuevo';
}

function logCampaign(entry) {
  const db = load();
  db.campaignLog.push({ ...entry, sentAt: new Date().toISOString() });
  save(db);
}

function listCampaignLog(locationSlug) {
  const db = load();
  return db.campaignLog.filter((c) => c.locationSlug === locationSlug).reverse();
}

module.exports = {
  getLocation,
  listLocations,
  upsertLocation,
  getCustomer,
  findCustomerByPhone,
  createCustomer,
  addVisit,
  setWalletInfo,
  listCustomersByLocation,
  segmentFor,
  logCampaign,
  listCampaignLog,
};
