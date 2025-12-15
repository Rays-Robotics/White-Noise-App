document.addEventListener('DOMContentLoaded', () => {
    // --- Elements ---
    const playBtn = document.getElementById('play-btn');
    const statusDisplay = document.getElementById('status-display');
    const pitchSlider = document.getElementById('pitch-slider');
    const volumeSlider = document.getElementById('volume-slider');
    const timerSelect = document.getElementById('timer-select');
    const timerBtn = document.getElementById('timer-btn');
    const timerDisplay = document.getElementById('timer-display');

    // --- Audio State ---
    let audioCtx;
    let whiteNoiseSource;
    let bandpassFilter;
    let gainNode;
    let isPlaying = false;

    // --- Timer State ---
    let timerInterval;
    let timerEndTime;

    // --- Audio Engine Initialization ---
    function initAudio() {
        if (!audioCtx) {
            // Create Audio Context
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            audioCtx = new AudioContext();
        }

        // 1. Create Buffer Source (The Noise)
        const bufferSize = audioCtx.sampleRate * 2; // 2 seconds of noise (looped)
        const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
        const data = buffer.getChannelData(0);

        // Fill buffer with random noise [-1.0, 1.0]
        for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1;
        }

        whiteNoiseSource = audioCtx.createBufferSource();
        whiteNoiseSource.buffer = buffer;
        whiteNoiseSource.loop = true;

        // 2. Create Filter (The Pitch/Tone)
        bandpassFilter = audioCtx.createBiquadFilter();
        bandpassFilter.type = 'bandpass';
        bandpassFilter.Q.value = 1; // Quality factor (Width of the band)
        bandpassFilter.frequency.value = pitchSlider.value;

        // 3. Create Gain (Volume)
        gainNode = audioCtx.createGain();
        gainNode.gain.value = volumeSlider.value;

        // 4. Connect the graph
        whiteNoiseSource.connect(bandpassFilter);
        bandpassFilter.connect(gainNode);
        gainNode.connect(audioCtx.destination);
    }

    // --- Playback Control ---
    function togglePlay() {
        if (isPlaying) {
            stopAudio();
        } else {
            startAudio();
        }
    }

    function startAudio() {
        // iOS Requirement: Context must resume on user gesture
        if (audioCtx && audioCtx.state === 'suspended') {
            audioCtx.resume();
        }
        
        initAudio(); // Re-build graph (nodes are one-time use)
        whiteNoiseSource.start(0);
        
        isPlaying = true;
        document.body.classList.add('is-playing');
        statusDisplay.textContent = "Playing White Noise";
        
        // Setup Wake Lock (Experimental but good for PWAs)
        if ('wakeLock' in navigator) {
            navigator.wakeLock.request('screen').catch(err => console.log('Wake Lock error:', err));
        }
    }

    function stopAudio() {
        if (whiteNoiseSource) {
            try {
                whiteNoiseSource.stop();
            } catch(e) { /* ignore if already stopped */ }
        }
        isPlaying = false;
        document.body.classList.remove('is-playing');
        statusDisplay.textContent = "Paused";
    }

    // --- Audio Adjustments ---
    pitchSlider.addEventListener('input', (e) => {
        if (bandpassFilter) {
            // Smoothly transition frequency
            bandpassFilter.frequency.setTargetAtTime(e.target.value, audioCtx.currentTime, 0.1);
        }
    });

    volumeSlider.addEventListener('input', (e) => {
        if (gainNode) {
            // Smoothly transition volume to prevent popping
            gainNode.gain.setTargetAtTime(e.target.value, audioCtx.currentTime, 0.1);
        }
    });

    // --- Timer Logic ---
    function toggleTimer() {
        if (timerInterval) {
            cancelTimer();
        } else {
            startTimer();
        }
    }

    function startTimer() {
        const minutes = parseInt(timerSelect.value);
        if (isNaN(minutes)) return; // Simple handling for now

        const now = Date.now();
        timerEndTime = now + (minutes * 60 * 1000);
        
        timerBtn.textContent = "Cancel Timer";
        timerBtn.classList.add('active');
        timerDisplay.classList.remove('hidden');

        // Start playback if not already
        if (!isPlaying) togglePlay();

        updateTimerDisplay(); // Initial call
        timerInterval = setInterval(updateTimerDisplay, 1000);
    }

    function cancelTimer() {
        clearInterval(timerInterval);
        timerInterval = null;
        timerBtn.textContent = "Start Timer";
        timerBtn.classList.remove('active');
        timerDisplay.classList.add('hidden');
        statusDisplay.textContent = isPlaying ? "Playing" : "Paused";
    }

    function updateTimerDisplay() {
        const now = Date.now();
        const remaining = timerEndTime - now;

        if (remaining <= 0) {
            stopAudio();
            cancelTimer();
            statusDisplay.textContent = "Timer Finished";
            return;
        }

        const m = Math.floor((remaining / 1000 / 60) % 60);
        const s = Math.floor((remaining / 1000) % 60);
        timerDisplay.textContent = `${m}:${s < 10 ? '0' : ''}${s}`;
    }

    // --- Event Listeners ---
    playBtn.addEventListener('click', togglePlay);
    timerBtn.addEventListener('click', toggleTimer);
});
