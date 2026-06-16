const CLIENT_ID = '967bcd3da47147ea807f9f951a1e0281';
const REDIRECT_URI = 'https://micakaa.github.io/wallboxify/';

const sp = 'spo' + 'tify.com';
const AUTH_URL = 'https://accounts.' + sp + '/authorize?';
const TOKEN_URL = 'https://accounts.' + sp + '/api/token';
const API_URL = 'https://api.' + sp + '/v1';

const SCOPES = [
    'user-modify-playback-state',
    'user-read-playback-state',
    'user-read-currently-playing',
    'playlist-read-private',
    'playlist-read-collaborative'
];

let accessToken = localStorage.getItem('access_token') || '';
let isPollingPaused = false;

// --- PKCE & Hjälpfunktioner ---
function generateRandomString(length) {
    let text = '';
    let possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < length; i++) {
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
}

function asciiToUint8Array(str) {
    const chars = [];
    for (let i = 0; i < str.length; ++i) {
        chars.push(str.charCodeAt(i));
    }
    return new Uint8Array(chars);
}

async function generateCodeChallenge(codeVerifier) {
    const data = asciiToUint8Array(codeVerifier);
    const digest = await window.crypto.subtle.digest('SHA-256', data);
    const digestBytes = new Uint8Array(digest);
    let binaryString = '';
    for (let i = 0; i < digestBytes.byteLength; i++) {
        binaryString += String.fromCharCode(digestBytes[i]);
    }
    return btoa(binaryString).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

// --- Inloggning ---
document.getElementById('login-btn').addEventListener('click', async () => {
    const codeVerifier = generateRandomString(128);
    window.localStorage.setItem('code_verifier', codeVerifier);
    const codeChallenge = await generateCodeChallenge(codeVerifier);
    
    const args = new URLSearchParams({
        response_type: 'code',
        client_id: CLIENT_ID,
        scope: SCOPES.join(' '),
        redirect_uri: REDIRECT_URI,
        code_challenge_method: 'S256',
        code_challenge: codeChallenge,
        show_dialog: 'true'
    });
    window.location.href = AUTH_URL + args.toString();
});

async function getToken(code) {
    const codeVerifier = localStorage.getItem('code_verifier');
    if (!codeVerifier) {
        console.error("KRITISKT FEL: code_verifier saknas!");
        return;
    }

    const body = new URLSearchParams({
        client_id: CLIENT_ID,
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: REDIRECT_URI,
        code_verifier: codeVerifier,
    });

    try {
        const response = await fetch(TOKEN_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: body
        });
        
        const data = await response.json();
        console.log("Svar från Spotify (Token):", data);
        
        if (data.access_token) {
            localStorage.setItem('access_token', data.access_token);
            console.log("Token sparades i localStorage!");
        } else {
            console.error("Spotify gav ingen token. Svar:", data);
        }
    } catch (e) {
        console.error("Nätverksfel vid token-hämtning:", e);
    }
}
async function loadPlaylist(playlistId) {
    try {
        const response = await fetch(`${API_URL}/playlists/${playlistId}/items`, {
            headers: { 'Authorization': `Bearer ${accessToken}` }
        });
        
        const data = await response.json();
        
        console.log("Spotify svarar med:", data); 

        if (data && data.items) {
            renderJukeboxLabels(data.items);
        }
    } catch (error) { 
        console.error("Kunde inte hämta spellista", error); 
    }
}

function renderJukeboxLabels(items) {
    const container = document.getElementById('layer1-labels');
    container.innerHTML = '';
    
    const tracks = items
        .filter(i => i && i.item && i.item.name) 
        .map(i => i.item);

    console.log("Antal låtar hittade:", tracks.length); 

    for (let i = 0; i < tracks.length; i += 2) {
        const trackA = tracks[i];
        const trackB = tracks[i + 1]; 
        
        const artistName = trackA.artists && trackA.artists.length > 0 
                           ? trackA.artists[0].name 
                           : "Okänd artist";

        const label = document.createElement('div');
        label.className = 'jukebox-label';
        label.innerHTML = `
            <div class="label-song">${trackA.name}</div>
            <div class="label-artist">${artistName}</div>
            <div class="label-song">${trackB ? trackB.name : '-'}</div>
        `;

label.addEventListener('click', () => openModal(trackA, trackB));
        container.appendChild(label);
    }
}

let isPlayingManually = false;
let currentCheckLoop = null;

const CLIENT_ID = '967bcd3da47147ea807f9f951a1e0281';
const REDIRECT_URI = 'https://micakaa.github.io/wallboxify/';

const sp = 'spo' + 'tify.com';
const AUTH_URL = 'https://accounts.' + sp + '/authorize?';
const TOKEN_URL = 'https://accounts.' + sp + '/api/token';
const API_URL = 'https://api.' + sp + '/v1';

const SCOPES = [
    'user-modify-playback-state',
    'user-read-playback-state',
    'user-read-currently-playing',
    'playlist-read-private',
    'playlist-read-collaborative'
];

let accessToken = localStorage.getItem('access_token') || '';
let isPollingPaused = false;

// --- PKCE & Hjälpfunktioner ---
function generateRandomString(length) {
    let text = '';
    let possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < length; i++) {
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
}

function asciiToUint8Array(str) {
    const chars = [];
    for (let i = 0; i < str.length; ++i) {
        chars.push(str.charCodeAt(i));
    }
    return new Uint8Array(chars);
}

async function generateCodeChallenge(codeVerifier) {
    const data = asciiToUint8Array(codeVerifier);
    const digest = await window.crypto.subtle.digest('SHA-256', data);
    const digestBytes = new Uint8Array(digest);
    let binaryString = '';
    for (let i = 0; i < digestBytes.byteLength; i++) {
        binaryString += String.fromCharCode(digestBytes[i]);
    }
    return btoa(binaryString).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

// --- Inloggning ---
document.getElementById('login-btn').addEventListener('click', async () => {
    const codeVerifier = generateRandomString(128);
    window.localStorage.setItem('code_verifier', codeVerifier);
    const codeChallenge = await generateCodeChallenge(codeVerifier);
    
    const args = new URLSearchParams({
        response_type: 'code',
        client_id: CLIENT_ID,
        scope: SCOPES.join(' '),
        redirect_uri: REDIRECT_URI,
        code_challenge_method: 'S256',
        code_challenge: codeChallenge,
        show_dialog: 'true'
    });
    window.location.href = AUTH_URL + args.toString();
});

async function getToken(code) {
    const codeVerifier = localStorage.getItem('code_verifier');
    if (!codeVerifier) {
        console.error("KRITISKT FEL: code_verifier saknas!");
        return;
    }

    const body = new URLSearchParams({
        client_id: CLIENT_ID,
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: REDIRECT_URI,
        code_verifier: codeVerifier,
    });

    try {
        const response = await fetch(TOKEN_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: body
        });
        
        const data = await response.json();
        console.log("Svar från Spotify (Token):", data);
        
        if (data.access_token) {
            localStorage.setItem('access_token', data.access_token);
            console.log("Token sparades i localStorage!");
        } else {
            console.error("Spotify gav ingen token. Svar:", data);
        }
    } catch (e) {
        console.error("Nätverksfel vid token-hämtning:", e);
    }
}
async function loadPlaylist(playlistId) {
    try {
        const response = await fetch(`${API_URL}/playlists/${playlistId}/items`, {
            headers: { 'Authorization': `Bearer ${accessToken}` }
        });
        
        const data = await response.json();
        
        console.log("Spotify svarar med:", data); 

        if (data && data.items) {
            renderJukeboxLabels(data.items);
        }
    } catch (error) { 
        console.error("Kunde inte hämta spellista", error); 
    }
}

function renderJukeboxLabels(items) {
    const container = document.getElementById('layer1-labels');
    container.innerHTML = '';
    
    const tracks = items
        .filter(i => i && i.item && i.item.name) 
        .map(i => i.item);

    console.log("Antal låtar hittade:", tracks.length); 

    for (let i = 0; i < tracks.length; i += 2) {
        const trackA = tracks[i];
        const trackB = tracks[i + 1]; 
        
        const artistName = trackA.artists && trackA.artists.length > 0 
                           ? trackA.artists[0].name 
                           : "Okänd artist";

        const label = document.createElement('div');
        label.className = 'jukebox-label';
        label.innerHTML = `
            <div class="label-song">${trackA.name}</div>
            <div class="label-artist">${artistName}</div>
            <div class="label-song">${trackB ? trackB.name : '-'}</div>
        `;

label.addEventListener('click', () => openModal(trackA, trackB));
        container.appendChild(label);
    }
}

let isPlayingManually = false;
let currentCheckLoop = null;

async function playTrack(uri) {
    // 1. Visa overlay
    let overlay = document.getElementById('loading-overlay') || createOverlay();
    overlay.classList.remove('hidden');
    
    isPlayingManually = true;

    try {
        // 2. Skicka play-kommando
        await fetch(`${API_URL}/me/player/play`, {
            method: 'PUT',
            headers: { 
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ uris: [uri] })
        });

        // 3. Vänta kort stund (Spotify behöver några millisekunder för att reagera)
        await new Promise(resolve => setTimeout(resolve, 800));

        // 4. Uppdatera UI EN GÅNG
        await updateNowPlaying();
        
        console.log("Låt uppdaterad!");
    } catch (error) {
        console.error("Fel vid uppspelning:", error);
    } finally {
        // 5. Stäng overlay och återställ flaggor
        isPlayingManually = false;
        overlay.classList.add('hidden');
    }
}

async function refreshNowPlaying() {
    if (isPollingPaused) return;
    await updateNowPlaying();
}

function openModal(trackA, trackB) {
    const modal = document.getElementById('jukebox-modal');
    const btnA = document.getElementById('btn-a');
    const btnB = document.getElementById('btn-b');

    btnA.innerText = trackA.name;
    // Använd addEventListener istället för .onclick för bättre stabilitet
    btnA.onclick = null; // Rensa gamla klick
    btnA.addEventListener('click', () => { playTrack(trackA.uri); closeModal(); });
    
    btnB.innerText = trackB ? trackB.name : "Ingen låt";
    btnB.onclick = null;
    if (trackB) {
        btnB.addEventListener('click', () => { playTrack(trackB.uri); closeModal(); });
    }

    modal.classList.remove('hidden');
}

function closeModal() {
    document.getElementById('jukebox-modal').classList.add('hidden');
}

async function updateNowPlaying() {
    try {
        const response = await fetch(`${API_URL}/me/player/currently-playing`, {
            headers: { 'Authorization': `Bearer ${accessToken}` }
        });

        if (response.status === 200) {
            const data = await response.json();
            if (data && data.item) {
                document.getElementById('np-title').innerText = data.item.name;
                document.getElementById('np-artist').innerText = data.item.artists[0].name;
                document.getElementById('np-image').src = data.item.album.images[0].url;
            }
        }
    } catch (err) {
        console.error("Kunde inte hämta aktuell låt:", err);
    }
}

async function skipTrack() {
    try {
        await fetch(`${API_URL}/me/player/next`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${accessToken}` }
        });
        console.log("Skippade låt!");
    } catch (err) { console.error("Skip misslyckades", err); }
}
function createOverlay() {
    let overlay = document.getElementById('loading-overlay');
    if (!overlay) {
        const container = document.getElementById('layer1-labels');
        overlay = document.createElement('div');
        overlay.id = 'loading-overlay';
        overlay.className = 'hidden';
        overlay.innerText = 'Väntar på Spotify...';
        container.appendChild(overlay);
    }
    return overlay;
}

async function init() {
    console.log("Init körs...");
    const urlParams = new URLSearchParams(window.location.search);
    let code = urlParams.get('code');
    
    if (code) {
        console.log("Kod hittad, byter ut mot token...");
        await getToken(code);
        window.history.replaceState({}, document.title, window.location.pathname);
    }
    
    accessToken = localStorage.getItem('access_token');
    
    if (accessToken) {
        console.log("Token finns, startar appen!");
        document.getElementById('login-screen').classList.add('hidden');
        document.getElementById('app-container').classList.remove('hidden');
        
        createOverlay();
        loadPlaylist('0EhSuHg92oacvq77lKHp1B');
        updateNowPlaying(); 
    } else {
        console.log("Ingen token hittad, visar inloggningsskärm.");
        document.getElementById('login-screen').classList.remove('hidden');
        document.getElementById('app-container').classList.add('hidden');
    }
}

init();
