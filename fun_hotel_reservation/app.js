const hotels = [
  { id: 1, name: 'Sunburst Miami Bay', location: 'Miami', price: 259, amenities: ['wifi', 'pool', 'breakfast', 'gym'], rooms: 6 },
  { id: 2, name: 'Neon Tokyo Gardens', location: 'Tokyo', price: 330, amenities: ['wifi', 'spa', 'gym'], rooms: 4 },
  { id: 3, name: 'Paris Glow Palace', location: 'Paris', price: 410, amenities: ['wifi', 'spa', 'breakfast', 'parking'], rooms: 5 },
  { id: 4, name: 'Ocean Pop Cancun', location: 'Cancun', price: 220, amenities: ['wifi', 'pool', 'breakfast'], rooms: 9 },
  { id: 5, name: 'Citrus Sky Barcelona', location: 'Barcelona', price: 285, amenities: ['wifi', 'parking', 'gym'], rooms: 7 },
  { id: 6, name: 'Aurora Palm Dubai', location: 'Dubai', price: 499, amenities: ['wifi', 'pool', 'spa', 'parking', 'gym'], rooms: 3 }
];

const countries = {
  us: { center: { lat: 37.1, lng: -95.7 }, zoom: 3 },
  ca: { center: { lat: 56.1, lng: -106.3 }, zoom: 3 },
  mx: { center: { lat: 23.6, lng: -102.5 }, zoom: 4 },
  uk: { center: { lat: 54.8, lng: -4.6 }, zoom: 5 },
  fr: { center: { lat: 46.2, lng: 2.2 }, zoom: 5 },
  de: { center: { lat: 51.2, lng: 10.4 }, zoom: 5 },
  es: { center: { lat: 40.5, lng: -3.7 }, zoom: 5 },
  it: { center: { lat: 41.9, lng: 12.6 }, zoom: 5 },
  pt: { center: { lat: 39.4, lng: -8.2 }, zoom: 6 },
  au: { center: { lat: -25.3, lng: 133.8 }, zoom: 4 },
  br: { center: { lat: -14.2, lng: -51.9 }, zoom: 3 },
  za: { center: { lat: -30.6, lng: 22.9 }, zoom: 5 },
  all: { center: { lat: 15, lng: 0 }, zoom: 2 }
};

const state = {
  account: JSON.parse(localStorage.getItem('funstay_account') || 'null'),
  visitLog: JSON.parse(localStorage.getItem('funstay_visit_log') || '[]'),
  booking: JSON.parse(localStorage.getItem('funstay_booking') || 'null'),
  activeResults: [...hotels],
  activeHotelsIndex: Object.fromEntries(hotels.map(h => [String(h.id), h])),
  googleIdentityReady: false,
  googlePlacesReady: false,
  autocompleteRequestToken: 0,
  placesService: null,
  map: null,
  mapMarkers: [],
  infoWindow: null,
  cityAutocomplete: null,
  selectedCountry: 'us',
  selectedPlace: null,
  gps: {
    permission: 'prompt',
    lastKnown: null,
    lastRequestedAt: null,
    lastError: null
  }
};

class OfflineVault {
  static dbName = 'FunStayOfflineDB';
  static dbVersion = 1;
  static storeName = 'compressed';
  static chunkSize = 300000;
  static db = null;

  static async open() {
    if (OfflineVault.db) return OfflineVault.db;
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(OfflineVault.dbName, OfflineVault.dbVersion);
      request.onupgradeneeded = event => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains(OfflineVault.storeName)) {
          db.createObjectStore(OfflineVault.storeName, { keyPath: 'key' });
        }
      };
      request.onsuccess = event => {
        OfflineVault.db = event.target.result;
        resolve(OfflineVault.db);
      };
      request.onerror = event => reject(event.target.error);
    });
  }

  static async write(record) {
    const db = await OfflineVault.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(OfflineVault.storeName, 'readwrite');
      tx.objectStore(OfflineVault.storeName).put(record);
      tx.oncomplete = () => resolve();
      tx.onerror = event => reject(event.target.error);
    });
  }

  static async read(key) {
    const db = await OfflineVault.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(OfflineVault.storeName, 'readonly');
      const req = tx.objectStore(OfflineVault.storeName).get(key);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = event => reject(event.target.error);
    });
  }

  static toBase64Utf8(text) {
    return btoa(unescape(encodeURIComponent(text)));
  }

  static fromBase64Utf8(text) {
    return decodeURIComponent(escape(atob(text)));
  }

  static async compress(text) {
    if (typeof CompressionStream === 'undefined') {
      return { payload: OfflineVault.toBase64Utf8(text), compressed: false };
    }
    const stream = new Blob([text]).stream().pipeThrough(new CompressionStream('gzip'));
    const bytes = new Uint8Array(await new Response(stream).arrayBuffer());
    let binary = '';
    bytes.forEach(b => {
      binary += String.fromCharCode(b);
    });
    return { payload: btoa(binary), compressed: true };
  }

  static async decompress(base64, compressed) {
    if (!compressed || typeof DecompressionStream === 'undefined') {
      return OfflineVault.fromBase64Utf8(base64);
    }
    const binary = atob(base64);
    const bytes = Uint8Array.from(binary, c => c.charCodeAt(0));
    const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
    return new Response(stream).text();
  }

  static split(payload) {
    const chunks = [];
    for (let i = 0; i < payload.length; i += OfflineVault.chunkSize) {
      chunks.push(payload.slice(i, i + OfflineVault.chunkSize));
    }
    return chunks;
  }

  static async set(key, value) {
    const raw = JSON.stringify(value);
    const { payload, compressed } = await OfflineVault.compress(raw);
    const chunks = OfflineVault.split(payload);
    const chunkKeys = [];

    for (let i = 0; i < chunks.length; i += 1) {
      const chunkKey = `${key}::${i}`;
      chunkKeys.push(chunkKey);
      await OfflineVault.write({ key: chunkKey, value: chunks[i], type: 'chunk' });
    }

    await OfflineVault.write({
      key,
      type: 'manifest',
      compressed,
      chunkKeys,
      totalChunks: chunks.length,
      updatedAt: new Date().toISOString()
    });
  }

  static async get(key) {
    const manifest = await OfflineVault.read(key);
    if (!manifest || manifest.type !== 'manifest') return null;

    let payload = '';
    for (const chunkKey of manifest.chunkKeys) {
      const record = await OfflineVault.read(chunkKey);
      if (!record) return null;
      payload += record.value;
    }

    const text = await OfflineVault.decompress(payload, manifest.compressed);
    return JSON.parse(text);
  }
}

const config = window.FUNSTAY_CONFIG || {
  google: { clientId: '', mapsApiKey: '' },
  wallet: { issuerId: '', classId: 'funstay.hotel.class', savePassEndpoint: '' }
};

const el = {
  googleSignInBtn: document.getElementById('googleSignInBtn'),
  googleSignInContainer: document.getElementById('googleSignInContainer'),
  createAccountBtn: document.getElementById('createAccountBtn'),
  guestBtn: document.getElementById('guestBtn'),
  accountStatus: document.getElementById('accountStatus'),
  discountDetails: document.getElementById('discountDetails'),
  countrySelect: document.getElementById('countrySelect'),
  searchInput: document.getElementById('searchInput'),
  autocompleteList: document.getElementById('autocompleteList'),
  map: document.getElementById('map'),
  checkIn: document.getElementById('checkIn'),
  checkOut: document.getElementById('checkOut'),
  maxPrice: document.getElementById('maxPrice'),
  guestCount: document.getElementById('guestCount'),
  searchBtn: document.getElementById('searchBtn'),
  results: document.getElementById('results'),
  bookingSummary: document.getElementById('bookingSummary'),
  googleCalendarBtn: document.getElementById('googleCalendarBtn'),
  appleCalendarBtn: document.getElementById('appleCalendarBtn'),
  walletBtn: document.getElementById('walletBtn'),
  offlineStatus: document.getElementById('offlineStatus')
};

const appLog = {
  entries: [],
  max: 500,
  push(level, message, meta = {}) {
    const entry = { ts: new Date().toISOString(), level, message, meta };
    this.entries.push(entry);
    if (this.entries.length > this.max) this.entries.shift();
    const logger = level === 'error' ? console.error : level === 'warn' ? console.warn : console.log;
    logger('[FunStay]', message, meta);
  }
};

function renderConnectivity() {
  if (!el.offlineStatus) return;
  const online = navigator.onLine;
  el.offlineStatus.classList.toggle('offline', !online);
  el.offlineStatus.innerHTML = online
    ? '🟢 Online. PWA cache + offline vault are active.'
    : '🟠 Offline. Running fully from local cache/storage (no backend required).';
}

async function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  try {
    await navigator.serviceWorker.register('./sw.js');
  } catch {
  }
}

async function persistOfflineSnapshot() {
  const snapshot = {
    account: state.account,
    visitLog: state.visitLog,
    booking: state.booking,
    gps: state.gps,
    activeResults: state.activeResults,
    timestamp: new Date().toISOString()
  };
  await OfflineVault.set('funstay.snapshot.v1', snapshot).catch(() => null);
}

async function hydrateFromOfflineSnapshot() {
  const snapshot = await OfflineVault.get('funstay.snapshot.v1').catch(() => null);
  if (!snapshot) return;
  if (!state.account && snapshot.account) state.account = snapshot.account;
  if ((!state.visitLog || !state.visitLog.length) && Array.isArray(snapshot.visitLog)) state.visitLog = snapshot.visitLog;
  if (!state.booking && snapshot.booking) state.booking = snapshot.booking;
  if (snapshot.gps) state.gps = { ...state.gps, ...snapshot.gps };
}

async function refreshGeolocationPermission() {
  if (!('permissions' in navigator) || !navigator.permissions?.query) return;
  try {
    const permissionStatus = await navigator.permissions.query({ name: 'geolocation' });
    state.gps.permission = permissionStatus.state;
    permissionStatus.onchange = () => {
      state.gps.permission = permissionStatus.state;
      appLog.push('info', 'GPS permission changed', { state: state.gps.permission });
    };
  } catch {
  }
}

function getCurrentPositionPromise(options) {
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(resolve, reject, options);
  });
}

async function requestClientLocation(reason = 'general', options = {}) {
  const { forcePrompt = false, maxAgeMs = 120000, timeout = 10000 } = options;
  if (!('geolocation' in navigator)) {
    state.gps.lastError = 'Geolocation unsupported';
    return null;
  }

  const now = Date.now();
  const last = state.gps.lastKnown?.timestamp || 0;
  if (!forcePrompt && state.gps.lastKnown && now - last < maxAgeMs) {
    return state.gps.lastKnown;
  }

  state.gps.lastRequestedAt = new Date().toISOString();

  try {
    const position = await getCurrentPositionPromise({
      enableHighAccuracy: true,
      timeout,
      maximumAge: 60000
    });
    const value = {
      lat: position.coords.latitude,
      lng: position.coords.longitude,
      accuracy: position.coords.accuracy,
      timestamp: Date.now(),
      capturedFor: reason
    };
    state.gps.lastKnown = value;
    state.gps.lastError = null;
    appLog.push('info', 'GPS captured', { reason, accuracy: value.accuracy });
    persistOfflineSnapshot().catch(() => null);
    return value;
  } catch (error) {
    state.gps.lastError = error?.message || 'Location unavailable';
    appLog.push('warn', 'GPS capture failed', { reason, error: state.gps.lastError });
    persistOfflineSnapshot().catch(() => null);
    return null;
  }
}

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const found = [...document.querySelectorAll('script')].find(s => s.src === src);
    if (found) {
      resolve();
      return;
    }
    const script = document.createElement('script');
    script.src = src;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`Failed to load script: ${src}`));
    document.head.appendChild(script);
  });
}

function parseJwtPayload(token) {
  const parts = token.split('.');
  if (parts.length < 2) return null;
  const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64 + '='.repeat((4 - (base64.length % 4 || 4)) % 4);
  try {
    return JSON.parse(atob(padded));
  } catch {
    return null;
  }
}

async function initializeGoogleIdentity() {
  if (!config.google.clientId) return;
  await loadScript('https://accounts.google.com/gsi/client');
  if (!window.google?.accounts?.id) return;

  window.google.accounts.id.initialize({
    client_id: config.google.clientId,
    callback: response => {
      const payload = parseJwtPayload(response.credential || '');
      if (!payload) {
        setAccountStatus('Google sign-in failed: invalid credential payload.');
        return;
      }
      state.account = {
        type: 'google',
        email: payload.email || null,
        name: payload.name || payload.given_name || 'Google User',
        sub: payload.sub || null,
        picture: payload.picture || null
      };
      saveState();
      setAccountStatus(`Signed in with Google: ${state.account.name}${state.account.email ? ` (${state.account.email})` : ''}`);
    }
  });

  el.googleSignInContainer.style.display = 'block';
  el.googleSignInContainer.innerHTML = '';
  window.google.accounts.id.renderButton(el.googleSignInContainer, {
    theme: 'outline',
    size: 'large',
    type: 'standard',
    shape: 'pill',
    text: 'signin_with',
    logo_alignment: 'left'
  });

  state.googleIdentityReady = true;
}

async function initializeGooglePlaces() {
  if (!config.google.mapsApiKey) return;
  if (window.google?.maps?.places) {
    setupGoogleMapAndPlaces();
    return;
  }

  const callbackName = '__funstayPlacesInit';
  await new Promise((resolve, reject) => {
    window[callbackName] = () => resolve();
    const src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(config.google.mapsApiKey)}&libraries=places&callback=${callbackName}`;
    loadScript(src).catch(reject);
    setTimeout(() => reject(new Error('Timed out loading Google Maps Places API.')), 12000);
  }).catch(() => null);

  if (window.google?.maps?.places) {
    setupGoogleMapAndPlaces();
  }
}

function setupGoogleMapAndPlaces() {
  if (!window.google?.maps || !el.map) return;

  const countryDef = countries[state.selectedCountry] || countries.us;
  state.map = new window.google.maps.Map(el.map, {
    zoom: countryDef.zoom,
    center: countryDef.center,
    mapTypeControl: false,
    streetViewControl: false,
    fullscreenControl: false
  });

  state.infoWindow = new window.google.maps.InfoWindow();
  state.placesService = new window.google.maps.places.PlacesService(state.map);
  state.cityAutocomplete = new window.google.maps.places.Autocomplete(el.searchInput, {
    types: ['(cities)'],
    fields: ['geometry', 'name', 'formatted_address', 'place_id']
  });
  applyCountryRestriction();

  state.cityAutocomplete.addListener('place_changed', () => {
    const place = state.cityAutocomplete.getPlace();
    if (place?.geometry?.location) {
      state.selectedPlace = place;
      state.map.panTo(place.geometry.location);
      state.map.setZoom(13);
      runApiHotelSearchFromPlace(place).catch(error => {
        appLog.push('error', 'API search failed from place', { error: String(error) });
      });
    }
  });

  state.googlePlacesReady = true;
  appLog.push('info', 'Google Places initialized', { country: state.selectedCountry });
}

function applyCountryRestriction() {
  if (!state.cityAutocomplete) return;
  const c = state.selectedCountry;
  if (c === 'all') {
    state.cityAutocomplete.setComponentRestrictions({ country: [] });
  } else {
    state.cityAutocomplete.setComponentRestrictions({ country: c });
  }
}

function setCountryScope() {
  state.selectedCountry = el.countrySelect?.value || 'us';
  const countryDef = countries[state.selectedCountry] || countries.us;
  if (state.map) {
    state.map.setCenter(countryDef.center);
    state.map.setZoom(countryDef.zoom);
  }
  applyCountryRestriction();
  clearMapMarkers();
  appLog.push('info', 'Country scope updated', { country: state.selectedCountry });
}

function clearMapMarkers() {
  state.mapMarkers.forEach(marker => marker.setMap(null));
  state.mapMarkers = [];
}

function hashNumber(value) {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

function estimateNightlyPrice(place) {
  if (typeof place.price_level === 'number') {
    return 120 + place.price_level * 90;
  }
  const seed = hashNumber(place.place_id || place.name || 'hotel');
  return 120 + (seed % 360);
}

function inferAmenities(place) {
  const types = place.types || [];
  const amenities = new Set(['wifi']);
  if (types.includes('spa') || /spa/i.test(place.name || '')) amenities.add('spa');
  if (types.includes('gym') || /fitness|gym/i.test(place.name || '')) amenities.add('gym');
  if (/resort|beach|bay|ocean|pool/i.test(place.name || '')) amenities.add('pool');
  if (/parking|motor|inn/i.test(place.name || '')) amenities.add('parking');
  if (/breakfast|suite|hotel/i.test(place.name || '')) amenities.add('breakfast');
  return [...amenities];
}

function placeToHotelModel(place, index = 0) {
  const id = `api-${place.place_id || hashNumber(place.name || String(index))}`;
  return {
    id,
    name: place.name || 'Hotel',
    location: place.vicinity || place.formatted_address || 'Unknown location',
    price: estimateNightlyPrice(place),
    amenities: inferAmenities(place),
    rooms: 2 + (hashNumber(id) % 7),
    rating: place.rating || null,
    website: place.website || null,
    phone: place.formatted_phone_number || null,
    placeId: place.place_id || null,
    source: 'google_places'
  };
}

function nearbySearchPromise(request) {
  return new Promise(resolve => {
    const collected = [];
    const searchPage = () => {
      state.placesService.nearbySearch(request, (results, status, pagination) => {
        const ok = window.google?.maps?.places?.PlacesServiceStatus?.OK;
        if (status === ok && results?.length) {
          collected.push(...results);
          if (pagination?.hasNextPage && collected.length < 60) {
            setTimeout(() => pagination.nextPage(), 250);
            return;
          }
        }
        resolve(collected);
      });
    };
    searchPage();
  });
}

function placeDetailsPromise(placeId) {
  return new Promise(resolve => {
    if (!placeId) {
      resolve(null);
      return;
    }
    state.placesService.getDetails(
      {
        placeId,
        fields: ['place_id', 'name', 'rating', 'website', 'formatted_phone_number', 'price_level', 'types', 'vicinity']
      },
      (place, status) => {
        const ok = window.google?.maps?.places?.PlacesServiceStatus?.OK;
        if (status === ok && place) {
          resolve(place);
          return;
        }
        resolve(null);
      }
    );
  });
}

async function processInBatches(items, batchSize, worker) {
  const results = [];
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const settled = await Promise.allSettled(batch.map((item, idx) => worker(item, i + idx)));
    settled.forEach(result => {
      if (result.status === 'fulfilled') results.push(result.value);
    });
  }
  return results;
}

async function enrichNearbyResults(nearbyResults) {
  const details = await processInBatches(nearbyResults, 8, async result => {
    const detail = await placeDetailsPromise(result.place_id);
    return detail || result;
  });
  return details.filter(Boolean);
}

function updateActiveHotelIndex() {
  state.activeHotelsIndex = Object.fromEntries(state.activeResults.map(h => [String(h.id), h]));
}

function renderMapMarkers(results) {
  if (!state.map) return;
  clearMapMarkers();

  results.slice(0, 26).forEach((place, index) => {
    const location = place.geometry?.location;
    if (!location) return;
    const label = String.fromCharCode('A'.charCodeAt(0) + (index % 26));
    const marker = new window.google.maps.Marker({
      map: state.map,
      position: location,
      animation: window.google.maps.Animation.DROP,
      label
    });
    marker.__place = place;
    marker.addListener('click', () => {
      const p = marker.__place;
      const rating = p.rating ? `⭐ ${p.rating}` : 'No rating';
      state.infoWindow.setContent(`<strong>${p.name || 'Hotel'}</strong><br>${p.vicinity || ''}<br>${rating}`);
      state.infoWindow.open({ map: state.map, anchor: marker });
    });
    state.mapMarkers.push(marker);
  });
}

async function runApiHotelSearchFromPlace(place) {
  if (!state.googlePlacesReady || !state.map || !state.placesService || !place?.geometry?.location) return;
  const request = {
    location: place.geometry.location,
    radius: 6000,
    type: 'lodging'
  };

  appLog.push('info', 'API nearby search start', { placeId: place.place_id || null });
  const nearby = await nearbySearchPromise(request);
  appLog.push('info', 'API nearby search completed', { count: nearby.length });

  const enrichedPlaces = await enrichNearbyResults(nearby);
  renderMapMarkers(enrichedPlaces);

  const models = enrichedPlaces.map((result, index) => placeToHotelModel(result, index));
  state.activeResults = models;
  updateActiveHotelIndex();
  renderResults();
  persistOfflineSnapshot().catch(() => null);
}

async function runApiHotelSearchFromCoords(coords) {
  if (!state.googlePlacesReady || !state.map || !state.placesService || !coords) return false;
  const location = new window.google.maps.LatLng(coords.lat, coords.lng);
  state.map.panTo(location);
  state.map.setZoom(14);

  const request = {
    location,
    radius: 7000,
    type: 'lodging'
  };

  appLog.push('info', 'API nearby search from GPS start', { lat: coords.lat, lng: coords.lng });
  const nearby = await nearbySearchPromise(request);
  if (!nearby.length) {
    appLog.push('warn', 'API nearby search from GPS returned no results');
    return false;
  }

  const enrichedPlaces = await enrichNearbyResults(nearby);
  renderMapMarkers(enrichedPlaces);
  const models = enrichedPlaces.map((result, index) => placeToHotelModel(result, index));
  state.activeResults = models;
  updateActiveHotelIndex();
  renderResults();
  persistOfflineSnapshot().catch(() => null);
  return true;
}

function todayPlus(days = 0) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function initDates() {
  el.checkIn.value = todayPlus(7);
  el.checkOut.value = todayPlus(10);
}

function saveState() {
  localStorage.setItem('funstay_account', JSON.stringify(state.account));
  localStorage.setItem('funstay_visit_log', JSON.stringify(state.visitLog));
  localStorage.setItem('funstay_booking', JSON.stringify(state.booking));
  persistOfflineSnapshot().catch(() => null);
}

function logVisit() {
  const now = Date.now();
  state.visitLog.push(now);
  state.visitLog = state.visitLog.slice(-500);
  saveState();
}

function computeDiscount() {
  const visitCount = Math.max(0, state.visitLog.length - 1);
  const onePercentLoyalty = visitCount;
  const now = Date.now();
  const weekCount = state.visitLog.filter(ts => now - ts <= 7 * 24 * 60 * 60 * 1000).length;
  const monthCount = state.visitLog.filter(ts => now - ts <= 30 * 24 * 60 * 60 * 1000).length;
  const periodBonus = monthCount >= 4 ? 7.5 : weekCount >= 2 ? 5 : 0;
  const total = Math.min(40, onePercentLoyalty + periodBonus);
  return {
    onePercentLoyalty,
    periodBonus,
    weekCount,
    monthCount,
    total
  };
}

function renderDiscount() {
  const d = computeDiscount();
  el.discountDetails.innerHTML = [
    `Visits tracked: <strong>${state.visitLog.length}</strong>`,
    `Return discount: <strong>${d.onePercentLoyalty.toFixed(1)}%</strong>`,
    `Weekly/Monthly bonus: <strong>${d.periodBonus.toFixed(1)}%</strong>`,
    `Current total discount: <strong>${d.total.toFixed(1)}%</strong>`
  ].join('<br>');
}

function setAccountStatus(msg) {
  el.accountStatus.textContent = msg;
}

function signInGoogleMock() {
  if (state.googleIdentityReady && window.google?.accounts?.id) {
    window.google.accounts.id.prompt();
    return;
  }
  const email = prompt('Google Sign-In demo: enter Google email');
  if (!email) return;
  state.account = { type: 'google', email, name: email.split('@')[0] };
  saveState();
  setAccountStatus(`Signed in as ${state.account.email} (Google demo mode)`);
}

function createAccountMock() {
  const email = prompt('Create account: email');
  if (!email) return;
  const name = prompt('Create account: display name') || email.split('@')[0];
  state.account = { type: 'local', email, name };
  saveState();
  setAccountStatus(`Account created: ${name} (${email})`);
}

function continueAsGuest() {
  state.account = { type: 'guest', email: null, name: 'Guest Traveler' };
  saveState();
  setAccountStatus('Continuing as guest. Booking is enabled.');
}

function applyAutocomplete() {
  const q = el.searchInput.value.trim().toLowerCase();
  el.autocompleteList.innerHTML = '';
  if (!q) return;

  if (state.googlePlacesReady && state.placesService && q.length >= 2) {
    const token = Date.now();
    state.autocompleteRequestToken = token;
    state.placesService.getPlacePredictions({ input: q }, (predictions, status) => {
      if (state.autocompleteRequestToken !== token) return;
      const ok = window.google?.maps?.places?.PlacesServiceStatus?.OK;
      if (status !== ok || !predictions?.length) {
        renderLocalAutocomplete(q);
        return;
      }
      el.autocompleteList.innerHTML = '';
      predictions.slice(0, 6).forEach(prediction => {
        const li = document.createElement('li');
        li.textContent = prediction.description;
        li.addEventListener('click', () => {
          el.searchInput.value = prediction.description;
          el.autocompleteList.innerHTML = '';
        });
        el.autocompleteList.appendChild(li);
      });
    });
    return;
  }

  renderLocalAutocomplete(q);
}

function renderLocalAutocomplete(q) {
  const query = q.toLowerCase();
  el.autocompleteList.innerHTML = '';
  if (!query) return;

  const options = hotels
    .filter(h => h.name.toLowerCase().includes(query) || h.location.toLowerCase().includes(query))
    .slice(0, 6);

  options.forEach(hotel => {
    const li = document.createElement('li');
    li.textContent = `${hotel.name} — ${hotel.location}`;
    li.addEventListener('click', () => {
      el.searchInput.value = `${hotel.name} ${hotel.location}`;
      el.autocompleteList.innerHTML = '';
    });
    el.autocompleteList.appendChild(li);
  });
}

function selectedAmenities() {
  return [...document.querySelectorAll('.amenities input:checked')].map(x => x.value);
}

function parseDate(input) {
  const d = new Date(input + 'T00:00:00');
  return Number.isNaN(d.getTime()) ? null : d;
}

function daysBetween(start, end) {
  const ms = end - start;
  return Math.max(1, Math.ceil(ms / (1000 * 60 * 60 * 24)));
}

async function runSearch() {
  const query = el.searchInput.value.trim().toLowerCase();
  const maxPrice = Number(el.maxPrice.value || 0);
  const guests = Number(el.guestCount.value || 1);
  const wants = selectedAmenities();

  if (state.googlePlacesReady && !query) {
    const coords = await requestClientLocation('search-empty-query', { forcePrompt: false });
    if (coords) {
      const used = await runApiHotelSearchFromCoords(coords);
      if (used) return;
    }
  }

  if (state.googlePlacesReady && state.selectedPlace && query) {
    await runApiHotelSearchFromPlace(state.selectedPlace).catch(() => null);
  }

  const base = state.activeResults?.length ? state.activeResults : hotels;
  const results = base.filter(h => {
    const matchText = !query || h.name.toLowerCase().includes(query) || h.location.toLowerCase().includes(query);
    const matchPrice = h.price <= maxPrice;
    const matchAmenities = wants.every(a => h.amenities.includes(a));
    const matchCapacity = h.rooms >= 1 && guests <= 8;
    return matchText && matchPrice && matchAmenities && matchCapacity;
  });

  state.activeResults = results;
  updateActiveHotelIndex();
  renderResults();
  persistOfflineSnapshot().catch(() => null);
}

function finalPrice(basePrice, nights) {
  const discount = computeDiscount().total;
  const subtotal = basePrice * nights;
  const total = subtotal * (1 - discount / 100);
  return {
    subtotal,
    discount,
    total
  };
}

function renderResults() {
  el.results.innerHTML = '';
  if (!state.activeResults.length) {
    el.results.innerHTML = '<div class="status">No matching hotels. Try broadening your search.</div>';
    return;
  }

  state.activeResults.forEach(hotel => {
    const card = document.createElement('article');
    card.className = 'hotel-card';

    const start = parseDate(el.checkIn.value);
    const end = parseDate(el.checkOut.value);
    const nights = start && end && end > start ? daysBetween(start, end) : 1;
    const quote = finalPrice(hotel.price, nights);

    card.innerHTML = `
      <div class="hotel-head">
        <strong>${hotel.name}</strong>
        <strong>$${hotel.price}/night</strong>
      </div>
      <div>${hotel.location}</div>
      <div class="hotel-tags">
        ${hotel.amenities.map(a => `<span class="tag">${a}</span>`).join('')}
      </div>
      <div class="status">${nights} night(s) • Subtotal: $${quote.subtotal.toFixed(2)} • Discount: ${quote.discount.toFixed(1)}% • Total: <strong>$${quote.total.toFixed(2)}</strong></div>
      <button class="btn btn-primary" data-book="${hotel.id}">Book Room</button>
    `;

    el.results.appendChild(card);
  });

  [...document.querySelectorAll('[data-book]')].forEach(btn => {
    btn.addEventListener('click', () => {
      const hotelId = String(btn.getAttribute('data-book'));
      createBooking(hotelId).catch(error => appLog.push('error', 'Booking failed', { error: String(error) }));
    });
  });
}

async function createBooking(hotelId) {
  const hotel = state.activeHotelsIndex[String(hotelId)] || hotels.find(h => String(h.id) === String(hotelId));
  if (!hotel) return;

  const checkIn = parseDate(el.checkIn.value);
  const checkOut = parseDate(el.checkOut.value);
  if (!checkIn || !checkOut || checkOut <= checkIn) {
    alert('Please pick valid check-in and check-out dates.');
    return;
  }

  const nights = daysBetween(checkIn, checkOut);
  const quote = finalPrice(hotel.price, nights);
  const bookingRef = `FS-${Date.now().toString(36).toUpperCase()}`;
  const bookingCoords = await requestClientLocation('booking-confirmation', { forcePrompt: false, timeout: 8000 });

  state.booking = {
    bookingRef,
    guest: state.account || { type: 'guest', name: 'Guest Traveler', email: null },
    hotel,
    checkIn: el.checkIn.value,
    checkOut: el.checkOut.value,
    guests: Number(el.guestCount.value || 1),
    nights,
    subtotal: quote.subtotal,
    discountPct: quote.discount,
    total: quote.total,
    guestLocation: bookingCoords || state.gps.lastKnown,
    createdAt: new Date().toISOString()
  };

  saveState();
  renderBooking();
}

function renderBooking() {
  if (!state.booking) {
    el.bookingSummary.textContent = 'No booking yet.';
    el.googleCalendarBtn.disabled = true;
    el.appleCalendarBtn.disabled = true;
    el.walletBtn.disabled = true;
    return;
  }

  const b = state.booking;
  el.bookingSummary.innerHTML = [
    `Booking Ref: <strong>${b.bookingRef}</strong>`,
    `Guest: <strong>${b.guest.name}</strong>${b.guest.email ? ` (${b.guest.email})` : ''}`,
    `Hotel: <strong>${b.hotel.name}</strong> — ${b.hotel.location}`,
    `Stay: <strong>${b.checkIn}</strong> to <strong>${b.checkOut}</strong> (${b.nights} nights)`,
    `Total: <strong>$${b.total.toFixed(2)}</strong> (discount ${b.discountPct.toFixed(1)}%)`,
    b.guestLocation ? `Guest GPS: <strong>${b.guestLocation.lat.toFixed(5)}, ${b.guestLocation.lng.toFixed(5)}</strong> (±${Math.round(b.guestLocation.accuracy)}m)` : 'Guest GPS: <strong>Not available</strong>'
  ].join('<br>');

  el.googleCalendarBtn.disabled = false;
  el.appleCalendarBtn.disabled = false;
  el.walletBtn.disabled = false;
}

function isoForCalendar(dateStr, hour = 15) {
  const d = new Date(`${dateStr}T${String(hour).padStart(2, '0')}:00:00`);
  return d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
}

function openGoogleCalendar() {
  if (!state.booking) return;
  const b = state.booking;
  const dates = `${isoForCalendar(b.checkIn, 15)}/${isoForCalendar(b.checkOut, 11)}`;
  const text = encodeURIComponent(`Hotel Stay: ${b.hotel.name}`);
  const details = encodeURIComponent(`Booking ${b.bookingRef}\nGuests: ${b.guests}\nTotal: $${b.total.toFixed(2)}`);
  const location = encodeURIComponent(b.hotel.location);
  const url = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${text}&dates=${dates}&details=${details}&location=${location}`;
  window.open(url, '_blank');
}

function buildICS() {
  const b = state.booking;
  const dtStart = isoForCalendar(b.checkIn, 15);
  const dtEnd = isoForCalendar(b.checkOut, 11);
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//FunStay//Reservation//EN',
    'BEGIN:VEVENT',
    `UID:${b.bookingRef}@funstay.local`,
    `DTSTAMP:${isoForCalendar(new Date().toISOString().slice(0, 10), 12)}`,
    `DTSTART:${dtStart}`,
    `DTEND:${dtEnd}`,
    `SUMMARY:Hotel Stay - ${b.hotel.name}`,
    `LOCATION:${b.hotel.location}`,
    `DESCRIPTION:Booking ${b.bookingRef} | Guests ${b.guests} | Total $${b.total.toFixed(2)}`,
    'END:VEVENT',
    'END:VCALENDAR'
  ].join('\r\n');
}

function downloadICS() {
  if (!state.booking) return;
  const data = buildICS();
  const blob = new Blob([data], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${state.booking.bookingRef}.ics`;
  a.click();
  URL.revokeObjectURL(url);
}

function googleWalletPayload() {
  const b = state.booking;
  return {
    issuer: config.wallet.issuerId || 'FunStay Demo Issuer',
    classId: config.wallet.classId || 'funstay.hotel.class',
    objectId: `funstay.hotel.${b.bookingRef.toLowerCase()}`,
    cardTitle: b.hotel.name,
    subTitle: `Ref ${b.bookingRef}`,
    arrival: b.checkIn,
    checkout: b.checkOut,
    doorUnlockEligible: true,
    note: 'Production requires Google Wallet issuer credentials and smart lock integration.'
  };
}

async function addToGoogleWalletDemo() {
  if (!state.booking) return;
  const payload = googleWalletPayload();

  if (config.wallet.savePassEndpoint) {
    try {
      const response = await fetch(config.wallet.savePassEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (response.ok) {
        const data = await response.json();
        if (data?.saveUrl) {
          window.open(data.saveUrl, '_blank');
          return;
        }
      }
    } catch {
      if (!navigator.onLine) {
        alert('Offline mode: generated local Google Wallet payload instead.');
      }
    }
  }

  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${state.booking.bookingRef}-wallet-pass.json`;
  a.click();
  URL.revokeObjectURL(url);
  alert('Google Wallet demo payload downloaded. Connect issuer API + JWT for live Save to Google Wallet.');
}

function hydrateAccount() {
  if (!state.account) {
    if (config.google.clientId) {
      setAccountStatus('Not signed in. Google Sign-In is configured; you can also continue as guest.');
    } else {
      setAccountStatus('Not signed in. You can still book as guest.');
    }
    return;
  }
  const label = state.account.type === 'google' ? 'Google' : state.account.type === 'local' ? 'Account' : 'Guest';
  setAccountStatus(`${label} session: ${state.account.name}${state.account.email ? ` (${state.account.email})` : ''}`);
}

function bindEvents() {
  el.googleSignInBtn.addEventListener('click', signInGoogleMock);
  el.createAccountBtn.addEventListener('click', createAccountMock);
  el.guestBtn.addEventListener('click', continueAsGuest);
  el.searchInput.addEventListener('input', applyAutocomplete);
  el.searchBtn.addEventListener('click', () => {
    runSearch().catch(error => appLog.push('error', 'Search failed', { error: String(error) }));
  });
  el.googleCalendarBtn.addEventListener('click', openGoogleCalendar);
  el.appleCalendarBtn.addEventListener('click', downloadICS);
  el.walletBtn.addEventListener('click', addToGoogleWalletDemo);
  el.countrySelect?.addEventListener('change', setCountryScope);
  window.addEventListener('online', renderConnectivity);
  window.addEventListener('offline', renderConnectivity);
}

async function init() {
  await registerServiceWorker();
  await hydrateFromOfflineSnapshot();
  await refreshGeolocationPermission();
  logVisit();
  initDates();
  if (state.gps.permission !== 'denied') {
    requestClientLocation('init', { forcePrompt: false, timeout: 7000 }).catch(() => null);
  }
  hydrateAccount();
  renderConnectivity();
  renderDiscount();
  bindEvents();
  initializeGoogleIdentity().catch(() => null);
  initializeGooglePlaces().catch(() => null);
  renderResults();
  renderBooking();
  persistOfflineSnapshot().catch(() => null);
}

init().catch(() => null);
