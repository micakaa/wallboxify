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

// --- App-Logik ---
async function init() {
    const urlParams = new URLSearchParams(window.location.search);
    let code = urlParams.get('code');
    if (code) {
        await getToken(code);
        // ...
    }
    
    // VIKTIGT: Kontrollera att denna körs
    console.log("Token finns:", !!accessToken); 
    
    if (accessToken) {
        document.getElementById('login-screen').classList.add('hidden');
        document.getElementById('app-container').classList.remove('hidden');
        loadPlaylist('37i9dQZF1DWTMYgB8TqtmR');
        startPolling();
    }
}

async function getToken(code) {
    let codeVerifier = localStorage.getItem('code_verifier');
    const payload = {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
            client_id: CLIENT_ID, grant_type: 'authorization_code', code: code,
            redirect_uri: REDIRECT_URI, code_verifier: codeVerifier
        })
    };
    try {
        const response = await fetch(TOKEN_URL, payload);
        const data = await response.json();
        if (data.access_token) {
            accessToken = data.access_token;
            localStorage.setItem('access_token', accessToken);
        }
    } catch (error) { console.error("Token-fel:", error); }
}

async function loadPlaylist(playlistId) {
    try {
        const response = await fetch(`${API_URL}/playlists/${playlistId}/items?limit=100`, {
            headers: { 'Authorization': `Bearer ${accessToken}` }
        });
        const data = await response.json();
        
        console.log("Spotify svarar med:", data); // <--- LÄGG TILL DENNA

        if (data && data.items) {
            renderJukeboxLabels(data.items);
        }
    } catch (error) { console.error("Kunde inte hämta spellista", error); }
}

function renderJukeboxLabels(items) {
    const container = document.getElementById('layer1-labels');
    container.innerHTML = '';
    
    // Vi filtrerar stenhårt:
    // 1. item måste finnas
    // 2. item.track måste finnas
    // 3. item.track.artists måste finnas
    const tracks = items
        .filter(item => item && item.track && item.track.artists && item.track.artists.length > 0)
        .map(item => item.track);

    for (let i = 0; i < tracks.length; i += 2) {
        const trackA = tracks[i];
        const trackB = tracks[i + 1]; 
        
        // Nu är vi 100% säkra på att trackA och trackA.artists finns
        const artistName = trackA.artists[0].name;

        const label = document.createElement('div');
        label.className = 'jukebox-label';
        label.innerHTML = `
            <div class="label-song">${trackA.name}</div>
            <div class="label-artist">${artistName}</div>
            <div class="label-song">${trackB ? trackB.name : '-'}</div>
        `;

        label.addEventListener('click', () => openModal(artistName, trackA, trackB));
        container.appendChild(label);
    }
}

function startPolling() { /* ...din polling-kod... */ }

init();
