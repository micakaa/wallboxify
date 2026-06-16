const CLIENT_ID = '967bcd3da47147ea807f9f951a1e0281';
const REDIRECT_URI = 'https://micakaa.github.io/wallboxify/';

// --- MASKERADE LÄNKAR FÖR ATT UNDVIKA FEL ---
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

// --- PKCE SÄKERHETSFLÖDE (iOS 12-KOMPATIBEL) ---
function generateRandomString(length) {
    let text = '';
    let possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < length; i++) {
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
}

// Egen funktion för att ersätta TextEncoder som saknas i gamla iPads
function asciiToUint8Array(str) {
    const chars = [];
    for (let i = 0; i < str.length; ++i) {
        chars.push(str.charCodeAt(i));
    }
    return new Uint8Array(chars);
}

async function generateCodeChallenge(codeVerifier) {
    const data = asciiToUint8Array(codeVerifier); // Använder vår egna iOS 12-vänliga funktion
    const digest = await window.crypto.subtle.digest('SHA-256', data);
    const digestBytes = new Uint8Array(digest);
    let binaryString = '';
    for (let i = 0; i < digestBytes.byteLength; i++) {
        binaryString += String.fromCharCode(digestBytes[i]);
    }
    return btoa(binaryString)
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');
}

// 1. Logga in
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
        code_challenge: codeChallenge
    });

    window.location.href = AUTH_URL + args.toString();
});

// 2. Initiera appen
async function init() {
    const urlParams = new URLSearchParams(window.location.search);
    let code = urlParams.get('code');

    if (code) {
        await getToken(code);
        window.history.replaceState({}, document.title, window.location.pathname);
    }

    if (accessToken) {
        document.getElementById('login-screen').classList.add('hidden');
        document.getElementById('app-container').classList.remove('hidden');
        
        // Här måste vi anropa funktionen och skicka med ID:t
        loadPlaylist('37i9dQZF1DWTMYgB8TqtmR'); 
        
        startPolling();
    }
}

// 3. Byt kod mot Token
async function getToken(code) {
    let codeVerifier = localStorage.getItem('code_verifier');

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
        } else {
            console.error("Fel vid inloggning:", data);
            alert("Kunde inte byta koden mot en inloggning. Kolla konsolen.");
        }
    } catch (error) {
         console.error("Kunde inte byta kod mot token:", error);
    }
}

// 4. Hämta spellista
// Ändra signaturen här till att acceptera 'id'
async function loadPlaylist(playlistId) {
    try {
        const response = await fetch(`${API_URL}/playlists/${playlistId}/tracks?limit=100`, {
            headers: { 'Authorization': `Bearer ${accessToken}` }
        });
        
        if (!response.ok) {
            console.error("Spotify-fel:", response.status);
            return; // Stoppa här om det är 403
        }

        const data = await response.json();
        
        // Säkerhetskoll: Om data.items finns, kör .map
        if (data && data.items) {
            const tracks = data.items.map(item => item.track).filter(track => track !== null);
            renderJukeboxLabels(tracks);
        }
    } catch (error) {
        console.error("Kunde inte hämta spellista", error);
    }
}
        
        // ... resten av koden är samma
        
        if (response.status === 401) {
            localStorage.removeItem('access_token');
            location.reload(); 
            return;
        }

        const data = await response.json();
        const tracks = data.items.map(item => item.track).filter(track => track !== null);
        renderJukeboxLabels(tracks);
    } catch (error) {
        console.error("Kunde inte hämta spellista", error);
    }
}

// 5. Bygg lapparna
function renderJukeboxLabels(tracks) {
    const container = document.getElementById('layer1-labels');
    container.innerHTML = '';

    for (let i = 0; i < tracks.length; i += 2) {
        const trackA = tracks[i];
        const trackB = tracks[i + 1]; 
        
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

// 6. Modal / Popup
function openModal(artist, trackA, trackB) {
    document.getElementById('modal-artist').innerText = artist;
    
    const btnA = document.getElementById('btn-song-a');
    btnA.innerText = trackA.name;
    btnA.onclick = () => playOrQueueSong(trackA.uri);

    const btnB = document.getElementById('btn-song-b');
    if (trackB) {
        btnB.style.display = 'block';
        btnB.innerText = trackB.name;
        btnB.onclick = () => playOrQueueSong(trackB.uri);
    } else {
        btnB.style.display = 'none';
    }

    document.getElementById('song-modal').classList.remove('hidden');
}

document.getElementById('close-modal').addEventListener('click', () => {
    document.getElementById('song-modal').classList.add('hidden');
});

// 7. Spela / Lägg i kö
async function playOrQueueSong(uri) {
    document.getElementById('song-modal').classList.add('hidden');

    try {
        const stateRes = await fetch(`${API_URL}/me/player`, {
            headers: { 'Authorization': `Bearer ${accessToken}` }
        });
        
        let isPlaying = false;
        if (stateRes.status === 200) {
            const state = await stateRes.json();
            isPlaying = state?.is_playing || false;
        }

        if (isPlaying) {
            await fetch(`${API_URL}/me/player/queue?uri=${encodeURIComponent(uri)}`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${accessToken}` }
            });
        } else {
            await fetch(`${API_URL}/me/player/play`, {
                method: 'PUT',
                headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ uris: [uri] })
            });
        }
        
        setTimeout(updatePlayerState, 1000); 
    } catch (error) {
        console.error("Fel vid uppspelning", error);
        alert("Ett fel uppstod. Se till att du har Spotify öppet på paddan/datorn och att det är aktivt.");
    }
}

// 8. Skip-knapp
document.getElementById('skip-btn').addEventListener('click', async () => {
    await fetch(`${API_URL}/me/player/next`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${accessToken}` }
    });
    setTimeout(updatePlayerState, 500);
});

// 9. Uppdatera UI i botten
function startPolling() {
    updatePlayerState();
    setInterval(updatePlayerState, 3000);
}

async function updatePlayerState() {
    try {
        const res = await fetch(`${API_URL}/me/player/currently-playing`, {
            headers: { 'Authorization': `Bearer ${accessToken}` }
        });
        if (res.status === 200) {
            const data = await res.json();
            if (data && data.item) {
                document.getElementById('np-title').innerText = data.item.name;
                document.getElementById('np-artist').innerText = data.item.artists[0].name;
                document.getElementById('np-image').src = data.item.album.images[0].url;
            }
        }
    } catch(e) {}

    try {
        const res = await fetch(`${API_URL}/me/player/queue`, {
            headers: { 'Authorization': `Bearer ${accessToken}` }
        });
        if (res.status === 200) {
            const data = await res.json();
            const queueList = document.getElementById('queue-list');
            if (data.queue && data.queue.length > 0) {
                const nextThree = data.queue.slice(0, 3).map((t, index) => `${index + 1}. ${t.name} - ${t.artists[0].name}`);
                queueList.innerHTML = nextThree.join('<br>');
            } else {
                queueList.innerText = "Ingen kö";
            }
        }
    } catch(e) {}
}

init();
