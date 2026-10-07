import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, Alert, ActivityIndicator, StyleSheet } from 'react-native';
import { Screen, H1, H2, P, Card, Row, Tag, Btn, C } from './ui';
import { useApp } from './store';
import { PARAMS, TH, ICON, N_AREAS } from './data';
import { average, failed, compatibleCrops, amendments, validate } from './analysis';
import { scanDevices, connectDevice, readOnce } from './bluetooth';

export function Splash({ navigation }) {
  useEffect(() => { const t = setTimeout(() => navigation.replace('Login'), 1500); return () => clearTimeout(t); }, []);
  return (
    <View style={[st.center, { backgroundColor: '#fff' }]}>
      <View style={st.logo}><Text style={{ fontSize: 46 }}>🌱</Text></View>
      <H1>AgriSense</H1><P>Smart soil monitoring. Better crop decisions.</P>
      <ActivityIndicator color={C.g} style={{ marginTop: 28 }} />
    </View>
  );
}

export function Login({ navigation }) {
  const go = () => navigation.replace('Main');
  return (
    <Screen>
      <View style={{ paddingTop: 60 }}>
        <H1>Welcome back</H1><P>Log in to continue</P>
        <TextInput style={st.input} placeholder="Email or phone number" autoCapitalize="none" />
        <TextInput style={st.input} placeholder="Password" secureTextEntry />
        <Btn title="Log in" onPress={go} />
        <Btn title="Register" outline onPress={go} />
        <Btn title="Continue as guest" outline onPress={go} style={{ borderWidth: 0 }} />
      </View>
    </Screen>
  );
}

export function Home({ navigation }) {
  const { device, records } = useApp();
  const Q = ({ icon, label, to }) => (
    <Card style={st.q} onPress={() => navigation.navigate(to)}><Text style={{ fontSize: 26 }}>{icon}</Text><P>{label}</P></Card>
  );
  return (
    <Screen>
      <H1>Hello, Farmer!</H1>
      <Card><P>Device status</P>
        <Row><Text style={{ fontWeight: '700' }}>{device?.name || 'AgriSense device'}</Text>
          <Tag text={device ? 'Connected' : 'Not connected'} kind={device ? 'ok' : 'bad'} /></Row></Card>
      <H2>Quick actions</H2>
      <View style={st.grid}>
        <Q icon="⏱" label="New monitoring" to="Monitor" /><Q icon="📋" label="View records" to="Records" />
        <Q icon="💡" label="Recommendations" to="Monitor" /><Q icon="🔄" label="Sync data" to="Sync" />
      </View>
      <Btn title="Connect device" outline onPress={() => navigation.navigate('Connect')} />
      <P style={{ marginTop: 12, textAlign: 'center' }}>{records.length} saved record(s)</P>
    </Screen>
  );
}

export function Connect({ navigation }) {
  const { setDevice } = useApp();
  const [list, setList] = useState([]); const [busy, setBusy] = useState(false);
  const scan = async () => {
    setBusy(true); setList([]);
    try { setList(await scanDevices()); } catch (e) { Alert.alert('Bluetooth', 'Could not scan. Turn on Bluetooth and allow permissions.'); }
    setBusy(false);
  };
  useEffect(() => { scan(); }, []);
  const pick = async d => {
    try { await connectDevice(d); setDevice(d); navigation.goBack(); }
    catch { Alert.alert('Connection failed', 'Move closer to the device and try again.'); }
  };
  return (
    <Screen>
      <View style={{ alignItems: 'center', marginVertical: 18 }}>
        <View style={[st.logo, { backgroundColor: C.g2 }]}><Text style={{ fontSize: 40 }}>ᛒ</Text></View>
        <P>{busy ? 'Scanning for devices…' : `${list.length} device(s) found`}</P>
      </View>
      <H2>Available devices</H2>
      {list.map(d => (
        <Card key={d.id}><Row>
          <View><Text style={{ fontWeight: '700' }}>{d.name}</Text>{d.rssi && <P>RSSI {d.rssi} dBm</P>}</View>
          <Btn title="Connect" onPress={() => pick(d)} style={{ marginTop: 0, paddingVertical: 8 }} />
        </Row></Card>
      ))}
      <Btn title="Scan again" outline onPress={scan} />
    </Screen>
  );
}

export function Monitor({ navigation }) {
  const { device, areas, session, setSession } = useApp();
  const done = areas.every(Boolean);
  const start = () => {
    if (!device) { Alert.alert('No device', 'Connect to an AgriSense device first.'); return navigation.navigate('Connect'); }
    if (done) return navigation.navigate('Average');
    navigation.navigate('Area', { index: areas.findIndex(a => !a) });
  };
  return (
    <Screen>
      <H1>New monitoring</H1>
      <P>Session name</P>
      <TextInput style={st.input} value={session.name} placeholder="e.g. North field - Oct 2026" onChangeText={name => setSession({ ...session, name })} />
      <P style={{ marginTop: 10 }}>Location (optional)</P>
      <TextInput style={st.input} value={session.location} placeholder="Brgy., municipality" onChangeText={location => setSession({ ...session, location })} />
      <H2>Sampling areas</H2>
      {areas.map((a, i) => (
        <Card key={i}><Row><Text>Area {i + 1}</Text><Tag text={a ? 'Collected ✓' : 'Pending'} kind={a ? 'ok' : 'warn'} /></Row></Card>
      ))}
      <P>Collect {N_AREAS} points per hectare in a zigzag (W) pattern. Insert the probe fully at the same depth each time.</P>
      <Btn title={done ? 'Analyze soil' : 'Start monitoring'} onPress={start} />
    </Screen>
  );
}

export function Area({ route, navigation }) {
  const { index } = route.params;
  const { areas, setAreas } = useApp();
  const [r, setR] = useState(null); const [busy, setBusy] = useState(false);
  useEffect(() => navigation.setOptions({ title: `Area ${index + 1} readings` }), []);
  const read = async () => {
    setBusy(true);
    const v = await readOnce();
    setBusy(false);
    if (!validate(v)) return Alert.alert('Invalid reading', 'Check probe contact with the soil and retake the reading.');
    setR(v);
  };
  const save = () => { const n = [...areas]; n[index] = r; setAreas(n); navigation.goBack(); };
  return (
    <Screen>
      <H2>Reading from device</H2>
      {r ? PARAMS.map(p => <Card key={p.k}><Row><Text>{p.label}</Text><Text style={{ fontWeight: '700' }}>{r[p.k]} {p.unit}</Text></Row></Card>)
         : <P>{busy ? 'Reading…' : 'No reading yet. Insert the probe fully into the soil, then tap Read from device.'}</P>}
      <Btn title={busy ? 'Reading…' : 'Read from device'} outline onPress={read} disabled={busy} />
      <Row style={{ gap: 10 }}>
        <Btn title="Retake" outline onPress={() => setR(null)} style={{ flex: 1 }} disabled={!r} />
        <Btn title="Save" onPress={save} style={{ flex: 1 }} disabled={!r} />
      </Row>
    </Screen>
  );
}

export function Average({ navigation }) {
  const { areas } = useApp();
  const avg = average(areas);
  if (!avg) return <Screen><P>Collect all {N_AREAS} areas first.</P></Screen>;
  const ok = compatibleCrops(avg);
  return (
    <Screen>
      <H2>Average results ({N_AREAS} areas)</H2>
      {PARAMS.map(p => <Card key={p.k}><Row><Text>{p.label}</Text><Text style={{ fontWeight: '700' }}>{avg[p.k]} {p.unit}</Text></Row></Card>)}
      <View style={[st.verdict, { backgroundColor: ok.length ? C.okbg : C.badbg }]}>
        <Text style={{ fontSize: 17, fontWeight: '700', color: ok.length ? C.ok : C.bad }}>
          {ok.length ? `${ok.length} of 5 crops compatible` : 'No crop fully compatible'}</Text>
        <P>{ok.length ? ok.join(', ') : 'See amendment suggestions to improve your soil.'}</P>
      </View>
      <Btn title="View recommendations" onPress={() => navigation.navigate('Crops')} />
    </Screen>
  );
}

export function Crops({ navigation }) {
  const { areas, pref, setPref } = useApp();
  const avg = average(areas); if (!avg) return null;
  return (
    <Screen>
      <P>Tap a crop to set it as your preferred crop.</P>
      <View style={{ marginTop: 10 }}>
        {Object.keys(TH).map(c => {
          const f = failed(avg, c);
          return (
            <Card key={c} onPress={() => setPref(c)} style={c === pref && { borderColor: C.g, borderWidth: 2 }}>
              <Row><Text style={{ fontSize: 17 }}>{ICON[c]} <Text style={{ fontWeight: '700' }}>{c}</Text></Text>
                <Tag text={f.length ? `Incompatible · ${f.length} off` : 'Compatible'} kind={f.length ? 'bad' : 'ok'} /></Row>
              {c === pref && <P>Preferred crop</P>}
            </Card>
          );
        })}
      </View>
      <Btn title="View soil amendment suggestions" onPress={() => navigation.navigate('Amend')} />
    </Screen>
  );
}

export function Amend({ navigation }) {
  const { areas, pref, saveRecord } = useApp();
  const avg = average(areas); if (!avg) return null;
  const list = amendments(avg, pref);
  const save = () => { saveRecord(avg, compatibleCrops(avg)); navigation.popToTop(); navigation.navigate('Main', { screen: 'Records' }); };
  return (
    <Screen>
      <P>Preferred crop: <Text style={{ fontWeight: '700' }}>{ICON[pref]} {pref}</Text></P>
      <View style={{ marginTop: 10 }}>
        {list.length ? list.map(a => (
          <Card key={a.k}>
            <Row><Text style={{ fontWeight: '700' }}>{PARAMS.find(p => p.k === a.k).label}</Text><Tag text={a.low ? 'Too low' : 'Too high'} kind="bad" /></Row>
            <P>Current {a.value} · target {a.range[0]}–{a.range[1]}</P>
            <Text style={{ color: C.ink, marginTop: 4 }}>{a.tip}</Text>
          </Card>
        )) : <View style={[st.verdict, { backgroundColor: C.okbg }]}><Text style={{ fontWeight: '700', color: C.ok }}>Your soil is compatible. No amendments needed.</Text></View>}
      </View>
      <P style={{ textAlign: 'center', marginTop: 8 }}>Guidance only. Not a replacement for advice from the Department of Agriculture or certified specialists.</P>
      <Btn title="Save assessment" onPress={save} />
    </Screen>
  );
}

export function Records() {
  const { records } = useApp();
  return (
    <Screen>
      <H1>Monitoring records</H1>
      {records.length ? records.map(r => (
        <Card key={r.id}><Row>
          <View style={{ flex: 1 }}><Text style={{ fontWeight: '700' }}>{r.name}</Text>
            <P>{new Date(r.date).toLocaleString()} · {r.synced ? 'synced' : 'on this phone'}</P></View>
          <Tag text={`${r.compatible.length} compatible`} kind={r.compatible.length ? 'ok' : 'bad'} />
        </Row></Card>
      )) : <P>No records yet. Complete a monitoring session and tap Save assessment.</P>}
    </Screen>
  );
}

export function Sync() {
  const { sync, lastSync, records } = useApp();
  const [msg, setMsg] = useState('');
  const pending = records.filter(r => !r.synced).length;
  return (
    <Screen>
      <View style={{ alignItems: 'center', paddingTop: 30 }}>
        <View style={[st.logo, { backgroundColor: C.g2 }]}><Text style={{ fontSize: 40 }}>☁</Text></View>
        <P>Last sync</P><Text style={{ fontWeight: '700' }}>{lastSync ? new Date(lastSync).toLocaleString() : 'Never'}</Text>
        <P style={{ marginTop: 10 }}>{msg || (pending ? `${pending} record(s) waiting to sync.` : 'All data are up to date.')}</P>
      </View>
      <Btn title="Sync now" onPress={async () => setMsg(`${await sync()} record(s) synced.`)} />
    </Screen>
  );
}

export function Profile({ navigation }) {
  return (
    <Screen>
      <H1>Profile</H1>
      <Card><Text style={{ fontWeight: '700' }}>Juan Dela Cruz</Text><P>Farmer</P></Card>
      {['Account settings', 'Device management', 'Units: mg/kg, °C, %', 'About AgriSense'].map(t => <Card key={t}><Text>{t}</Text></Card>)}
      <Btn title="Log out" outline danger onPress={() => navigation.getParent().replace('Login')} />
    </Screen>
  );
}

const st = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  logo: { width: 92, height: 92, borderRadius: 46, backgroundColor: C.g2, alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
  input: { backgroundColor: '#fff', borderWidth: 1, borderColor: C.line, borderRadius: 10, padding: 12, fontSize: 14, marginTop: 10 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 9 },
  q: { width: '48.5%', alignItems: 'center', paddingVertical: 18 },
  verdict: { borderRadius: 12, padding: 14, alignItems: 'center', marginTop: 12 },
});
