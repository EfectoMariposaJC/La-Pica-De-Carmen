const API_BASE = 'https://api.walletwallet.dev/api/passes';

function isMockMode() {
  return !process.env.WALLETWALLET_API_KEY;
}

function authHeaders() {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${process.env.WALLETWALLET_API_KEY}`,
  };
}

function buildLoyaltyPassBody(customer, location) {
  return {
    barcodeValue: customer.id,
    barcodeFormat: 'QR',
    logoText: location.name,
    primaryFields: [
      { label: 'VISITAS', value: `${customer.visits}/${location.visitsForReward}` },
    ],
    secondaryFields: [
      { label: 'CLIENTE', value: customer.name },
      { label: 'PREMIO', value: location.rewardMessage || 'Consulta en el local' },
    ],
  };
}

async function issuePass(customer, location) {
  if (isMockMode()) {
    const fakeSerial = `MOCK-${customer.id.slice(0, 8)}`;
    return {
      serialNumber: fakeSerial,
      googleSaveUrl: '#modo-simulado',
      shareUrl: '#modo-simulado',
      mock: true,
    };
  }

  const res = await fetch(API_BASE, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(buildLoyaltyPassBody(customer, location)),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`WalletWallet issuePass fallo: ${res.status} ${err.error || ''}`);
  }

  const data = await res.json();
  return {
    serialNumber: data.serialNumber,
    googleSaveUrl: data.googleSaveUrl,
    shareUrl: data.shareUrl,
    mock: false,
  };
}

async function updatePass(serialNumber, customer, location) {
  if (isMockMode() || !serialNumber || serialNumber.startsWith('MOCK-')) {
    return { mock: true };
  }

  const res = await fetch(`${API_BASE}/${serialNumber}`, {
    method: 'PUT',
    headers: authHeaders(),
    body: JSON.stringify(buildLoyaltyPassBody(customer, location)),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`WalletWallet updatePass fallo: ${res.status} ${err.error || ''}`);
  }

  return res.json();
}

module.exports = { issuePass, updatePass, isMockMode };
