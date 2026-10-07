// Set USE_MOCK=false in a development build (not Expo Go) to talk to the real ESP32.
// Expected ESP32 protocol (BluetoothSerial / SPP): app sends "READ\n",
// ESP32 replies one CSV line: "N,P,K,pH,M,T\n"  e.g. "152,34,120,6.4,62,28.5"
export const USE_MOCK = true;

const wait = ms => new Promise(r => setTimeout(r, ms));
const rnd = (a, b, d = 0) => +(a + Math.random() * (b - a)).toFixed(d);
let RNBC = null, conn = null;
const lib = () => (RNBC ??= require('react-native-bluetooth-classic').default);

export async function scanDevices() {
  if (USE_MOCK) {
    await wait(900);
    return [{ id: '01', name: 'AgriSense_Device_01', rssi: -60 }, { id: '02', name: 'AgriSense_Device_02', rssi: -72 }];
  }
  await lib().requestBluetoothEnabled();
  const paired = await lib().getBondedDevices(); // pair the ESP32 in Android settings first
  return paired.filter(d => d.name?.startsWith('AgriSense')).map(d => ({ id: d.address, name: d.name }));
}

export async function connectDevice(d) {
  if (USE_MOCK) { await wait(500); return true; }
  conn = await lib().connectToDevice(d.id, { delimiter: '\n' });
  return !!conn;
}

export async function readOnce() {
  if (USE_MOCK) {
    await wait(700);
    return { N: rnd(90, 260), P: rnd(12, 62), K: rnd(85, 290), pH: rnd(4.8, 7.2, 1), M: rnd(35, 80), T: rnd(22, 33, 1) };
  }
  await conn.write('READ\n');
  for (let i = 0; i < 20; i++) { // up to ~10 s
    await wait(500);
    const line = await conn.read();
    if (line) {
      const [N, P, K, pH, M, T] = String(line).trim().split(',').map(Number);
      return { N, P, K, pH, M, T };
    }
  }
  return null;
}
