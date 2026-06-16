const CLIENT_ID = '967bcd3da47147ea807f9f951a1e0281';
const REDIRECT_URI = 'https://micakaa.github.io/wallboxify/';
const AUTH_URL = 'https://accounts.spotify.com/authorize?';
const TOKEN_URL = 'https://accounts.spotify.com/api/token';
const API_URL = 'https://api.spotify.com/v1';

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

async function loadQueue() {
    try {
        const response = await fetch(`${API_URL}/me/player/queue`, {
            headers: { 'Authorization': `Bearer ${accessToken}` }
        });

        if (response.ok) {
            const data = await response.json();
            const queueContainer = document.getElementById('queue-list');
            queueContainer.innerHTML = ''; // Rensa texten "Laddar kö..."

            // Kolla om kön är tom
            if (!data.queue || data.queue.length === 0) {
                queueContainer.innerHTML = '<div>Inga låtar i kön</div>';
                return;
            }

            // Plocka ut de 3 nästa låtarna (eller ändra siffran till hur många du vill visa)
            const nextTracks = data.queue.slice(0, 3);
            
            nextTracks.forEach(track => {
                const trackElement = document.createElement('div');
                trackElement.className = 'queue-item'; // Bra att ha om du vill stila i CSS:en
                // Använd en fetare text för låt och smalare för artist
                trackElement.innerHTML = `<strong>${track.name}</strong> <br> ${track.artists[0].name} <hr style="border: 0.5px solid #333; margin: 5px 0;">`;
                queueContainer.appendChild(trackElement);
            });
        }
    } catch (err) {
        console.error("Kunde inte hämta kön:", err);
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
    let overlay = document.getElementById('loading-overlay') || createOverlay();
    overlay.classList.remove('hidden');
    
    isPlayingManually = true;

    try {
        // Skicka play-kommando
        const response = await fetch(`${API_URL}/me/player/play`, {
            method: 'PUT',
            headers: { 
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ uris: [uri] })
        });

        if (response.ok || response.status === 204) {
            // Vänta bara en kort stund för att låta Spotifys API hinna "registrera" ändringen
            await new Promise(resolve => setTimeout(resolve, 200));
            await updateNowPlaying();
            console.log("Låt uppdaterad!");
        } else if (response.status === 429) {
            console.error("Rate limit nådd! Vänta en stund innan nästa försök.");
        }
    } catch (error) {
        console.error("Fel vid uppspelning:", error);
    } finally {
        isPlayingManually = false;
        overlay.classList.add('hidden');
    }
}

async function queueTrack(uri) {
    let overlay = document.getElementById('loading-overlay') || createOverlay();
    overlay.classList.remove('hidden');
    
    try {
        // Skicka kommandot till Spotifys kö-API istället för play
        const response = await fetch(`${API_URL}/me/player/queue?uri=${encodeURIComponent(uri)}`, {
            method: 'POST',
            headers: { 
                'Authorization': `Bearer ${accessToken}`
            }
        });

        if (response.ok || response.status === 204) {
            // Vänta en kort stund för att Spotify ska hinna registrera ändringen
            await new Promise(resolve => setTimeout(resolve, 200));
            
            // Tvinga fram en uppdatering av kön så vi ser låten dyka upp direkt
            await loadQueue(); 
            console.log("Låt tillagd i kön!");
        } else if (response.status === 429) {
            console.error("Rate limit nådd! Vänta en stund innan nästa försök.");
        }
    } catch (error) {
        console.error("Fel vid tillägg i kön:", error);
    } finally {
        overlay.classList.add('hidden');
    }
}

function openModal(trackA, trackB) {
    const modal = document.getElementById('jukebox-modal');
    const btnA = document.getElementById('btn-a');
    const btnB = document.getElementById('btn-b');

    // Sätt upp Knapp A
    btnA.innerText = trackA.name;
    btnA.onclick = () => { 
        queueTrack(trackA.uri); // Ändrat från playTrack
        closeModal(); 
    };
    
    // Sätt upp Knapp B
    if (trackB) {
        btnB.innerText = trackB.name;
        btnB.onclick = () => { 
            queueTrack(trackB.uri); // Ändrat från playTrack
            closeModal(); 
        };
    } else {
        btnB.innerText = "Ingen låt";
        btnB.onclick = null; 
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
        await new Promise(resolve => setTimeout(resolve, 500));
        await loadQueue();
        refreshNowPlaying()
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

document.getElementById('skip-btn').addEventListener('click', () => {
    skipTrack();
    // Tvinga fram en direkt uppdatering av UI:t så vi inte behöver vänta 5 sekunder
    setTimeout(refreshNowPlaying, 500); 
});

async function refreshNowPlaying() {
    if (isPollingPaused) return;
    await updateNowPlaying();
    //await loadQueue();
}

async function init() {
    console.log("Init körs...");
    const urlParams = new URLSearchParams(window.location.search);
    let code = urlParams.get('code');
    
    // 1. Om vi har kod, byt ut den mot en token
    if (code) {
        console.log("Kod hittad, byter ut mot token...");
        await getToken(code);
        window.history.replaceState({}, document.title, window.location.pathname);
    }
    
    // 2. Hämta token och uppdatera den globala variabeln
    accessToken = localStorage.getItem('access_token');
    
    // 3. Visa rätt vy
    if (accessToken) {
        document.getElementById('login-screen').classList.add('hidden');
        document.getElementById('app-container').classList.remove('hidden');
        
        createOverlay();
        loadPlaylist('0EhSuHg92oacvq77lKHp1B');
        
        // 4. Hämta direkt vid start (lägg till await här med!)
        await refreshNowPlaying();  
        
        // 5. Starta loopen som uppdaterar var 5:e sekund (5000 millisekunder)
        currentCheckLoop = setInterval(refreshNowPlaying, 5000);
    }
}

init();
console.log("DIN REFRESH TOKEN ÄR:", localStorage.getItem('refresh_token'));
