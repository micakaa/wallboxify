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
    }
    
    // Vi kollar bara accessToken EN gång här
    if (accessToken) {
        document.getElementById('login-screen').classList.add('hidden');
        document.getElementById('app-container').classList.remove('hidden');
        loadPlaylist('0EhSuHg92oacvq77lKHp1B');
        startPolling();

        const skipBtn = document.getElementById('skip-btn');
        if (skipBtn) {
            skipBtn.addEventListener('click', skipTrack);
        }
    }
}

    // VIKTIGT: Kontrollera att denna körs
    console.log("Token finns:", !!accessToken); 
    
    if (accessToken) {
        document.getElementById('login-screen').classList.add('hidden');
        document.getElementById('app-container').classList.remove('hidden');
        loadPlaylist('0EhSuHg92oacvq77lKHp1B');
        startPolling();
    }

async function getToken(code) {
    let codeVerifier = localStorage.getItem('code_verifier');
    
    // Om vi inte har en verifier, avbryt direkt
    if (!codeVerifier) return;

    const payload = {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
            client_id: CLIENT_ID,
            grant_type: 'authorization_code',
            code: code,
            redirect_uri: REDIRECT_URI,
            code_verifier: codeVerifier,
        }),
    };

    try {
        const response = await fetch(TOKEN_URL, payload);
        const data = await response.json();
        
        if (data.access_token) {
            accessToken = data.access_token;
            localStorage.setItem('access_token', accessToken);
            // Ta bort verifier när den är använd så vi inte försöker igen
            localStorage.removeItem('code_verifier'); 
        } else {
            console.warn("Kunde inte byta kod, troligen redan använd.");
        }
    } catch (error) { 
        console.error("Token-fel:", error); 
    }
}

async function loadPlaylist(playlistId) {
    try {
        // OBS! Vi använder /tracks här, det är den officiella endpointen
        const response = await fetch(`${API_URL}/playlists/${playlistId}/items`, {
            headers: { 'Authorization': `Bearer ${accessToken}` }
        });
        
        const data = await response.json();
        
        console.log("Spotify svarar med:", data); 

        // För /tracks endpointen heter datan 'items' direkt
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
    
    // Vi filtrerar på 'item.item' eftersom det är där din låtdata ligger
    const tracks = items
        .filter(i => i && i.item && i.item.name) 
        .map(i => i.item);

    console.log("Antal låtar hittade:", tracks.length); 

    for (let i = 0; i < tracks.length; i += 2) {
        const trackA = tracks[i];
        const trackB = tracks[i + 1]; 
        
        // Vi hämtar artisten från trackA.artists
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

        // Ändra denna rad inne i din for-loop:
label.addEventListener('click', () => openModal(trackA, trackB));
        container.appendChild(label);
    }
}

let isPlayingManually = false;
let currentCheckLoop = null;

async function playTrack(uri) {
    const overlay = document.getElementById('loading-overlay');
    overlay.classList.remove('hidden'); // Aktivera grått filter/paus
    
    isPlayingManually = true;
    if (currentCheckLoop) clearInterval(currentCheckLoop);

    try {
        await fetch(`${API_URL}/me/player/play`, {
            method: 'PUT',
            headers: { 
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ uris: [uri] })
        });

        let retries = 5; 
        currentCheckLoop = setInterval(async () => {
            try {
                const response = await fetch(`${API_URL}/me/player/currently-playing`, {
                    headers: { 'Authorization': `Bearer ${accessToken}` }
                });
                
                if (response.status === 200) {
                    const data = await response.json();
                    if (data.item && data.item.uri === uri) {
                        updateNowPlaying();
                        cleanup(); // Hjälpfunktion för att städa upp
                    }
                }
            } catch (err) { console.error(err); }
            
            retries--;
            if (retries <= 0) cleanup();
        }, 1500);

    } catch (error) {
        console.error("Fel:", error);
        cleanup();
    }

    // Hjälpfunktion för att städa upp
    function cleanup() {
        if (currentCheckLoop) clearInterval(currentCheckLoop);
        currentCheckLoop = null;
        isPlayingManually = false;
        overlay.classList.add('hidden'); // Dölj grått filter
    }
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

async function startPolling() {
    setInterval(async () => {
        if (isPlayingManually) return; // Gör inget om vi precis bytt låt manuellt
        await updateNowPlaying();
    }, 5000);
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

init();
