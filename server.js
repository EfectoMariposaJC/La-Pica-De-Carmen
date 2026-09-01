require('dotenv').config();
const express = require('express');
const cookieParser = require('cookie-parser');
const db = require('./lib/db');
const wallet = require('./lib/wallet');

const app = express();
app.set('view engine', 'ejs');
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));
app.use(cookieParser());

const COOKIE_NAME = 'nfc_customer_id';
const COOKIE_MAX_AGE = 1000 * 60 * 60 * 24 * 365;

app.get('/t/:slug', (req, res) => {
  const location = db.getLocation(req.params.slug);
  if (!location) return res.status(404).send('Local no encontrado');

  const customerId = req.cookies[COOKIE_NAME];
  const existing = customerId ? db.getCustomer(customerId) : null;

  if (existing) {
    const updated = db.addVisit(existing.id);
    wallet.updatePass(updated.walletSerial, updated, location).catch((e) =>
      console.error('Error actualizando pase:', e.message)
    );
    return res.render('welcome', { customer: updated, location, isNew: false });
  }

  res.render('register', { location, error: null });
});

app.post('/t/:slug/register', async (req, res) => {
  const location = db.getLocation(req.params.slug);
  if (!location) return res.status(404).send('Local no encontrado');

  const { name, phone } = req.body;
  if (!name || !phone) {
    return res.render('register', { location, error: 'Completa nombre y telefono.' });
  }

  let customer = db.findCustomerByPhone(location.slug, phone);
  if (!customer) {
    customer = db.createCustomer({ name, phone, locationSlug: location.slug });
  }

  try {
    const pass = await wallet.issuePass(customer, location);
    customer = db.setWalletInfo(customer.id, {
      walletSerial: pass.serialNumber,
      walletShareUrl: pass.shareUrl,
    });
    res.cookie(COOKIE_NAME, customer.id, { maxAge: COOKIE_MAX_AGE, httpOnly: false });
    res.render('welcome', { customer, location, isNew: true, wallet: pass });
  } catch (e) {
    console.error(e);
    res.render('register', {
      location,
      error: 'Hubo un problema generando tu tarjeta. Intenta de nuevo.',
    });
  }
});

const DASHBOARD_COOKIE = 'dashboard_auth';

function requireDashboardAuth(req, res, next) {
  if (req.cookies[DASHBOARD_COOKIE] === process.env.DASHBOARD_PASSWORD) return next();
  res.redirect('/dashboard/login');
}

app.get('/dashboard/login', (req, res) => {
  res.render('dashboard-login', { error: null });
});

app.post('/dashboard/login', (req, res) => {
  if (req.body.password === process.env.DASHBOARD_PASSWORD) {
    res.cookie(DASHBOARD_COOKIE, req.body.password, { httpOnly: true });
    return res.redirect('/dashboard');
  }
  res.render('dashboard-login', { error: 'Password incorrecta.' });
});

app.get('/dashboard', requireDashboardAuth, (req, res) => {
  const locations = db.listLocations().map((loc) => {
    const customers = db.listCustomersByLocation(loc.slug);
    return { ...loc, totalCustomers: customers.length };
  });
  res.render('dashboard-home', { locations });
});

app.get('/dashboard/:slug', requireDashboardAuth, (req, res) => {
  const location = db.getLocation(req.params.slug);
  if (!location) return res.status(404).send('Local no encontrado');

  const customers = db.listCustomersByLocation(location.slug).map((c) => ({
    ...c,
    segment: db.segmentFor(c),
  }));

  const stats = {
    total: customers.length,
    frecuentes: customers.filter((c) => c.segment === 'frecuente').length,
    inactivos: customers.filter((c) => c.segment === 'inactivo').length,
    nuevos: customers.filter((c) => c.segment === 'nuevo').length,
  };

  const campaignLog = db.listCampaignLog(location.slug);

  res.render('dashboard-location', { location, customers, stats, campaignLog });
});

app.post('/dashboard/:slug/campaign', requireDashboardAuth, (req, res) => {
  const location = db.getLocation(req.params.slug);
  if (!location) return res.status(404).send('Local no encontrado');

  const { segment, message } = req.body;
  const customers = db
    .listCustomersByLocation(location.slug)
    .filter((c) => db.segmentFor(c) === segment);

  db.logCampaign({
    locationSlug: location.slug,
    segment,
    message,
    recipients: customers.length,
  });

  console.log(
    `[CAMPANA SIMULADA] Local=${location.slug} segmento=${segment} destinatarios=${customers.length} mensaje="${message}"`
  );

  res.redirect(`/dashboard/${location.slug}`);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});
