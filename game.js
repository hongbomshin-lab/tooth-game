const MODES = {
    easy: {
        directions: ['left', 'down', 'right'],
        spawnInterval: 900,
        hitWindow: 210,
        progressStep: 0.5
    },
    hard: {
        directions: ['up', 'left', 'down', 'right'],
        spawnInterval: 750,
        hitWindow: 190,
        progressStep: 0.5
    },
    crazy: {
        directions: ['q', 'w', 'e', 'left', 'down', 'right'],
        spawnInterval: 600,
        hitWindow: 180,
        progressStep: 0.5
    }
};

class Game {
    constructor() {
        this.score = 100;
        this.progress = 0;
        this.combo = 0;
        this.notes = [];
        this.active = false;
        this.lastSpawn = 0;
        this.mode = 'easy';
        this.config = MODES.easy;

        // DOM Elements
        this.gameContainer = document.getElementById('game-container');
        this.scoreEl = document.getElementById('score');
        this.progressGauge = document.getElementById('progress-gauge');
        this.comboContainer = document.getElementById('combo-container');
        this.comboCountEl = document.getElementById('combo-count');
        this.toothVisual = document.getElementById('tooth-visual');
        this.toothBlood = document.getElementById('tooth-blood');
        this.rhythmArea = document.getElementById('rhythm-area');

        this.screens = {
            start: document.getElementById('screen-start'),
            gameover: document.getElementById('screen-gameover'),
            success: document.getElementById('screen-success')
        };
        this.flashOverlay = document.getElementById('flash-overlay');
        this.musicInput = document.getElementById('music-url');

        // Audio setup
        this.bgm = new Audio();
        this.bgm.loop = true;
        this.defaultBgm = 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3'; // Example stable BGM

        // Bind events
        document.getElementById('btn-easy').onclick = () => this.start('easy');
        document.getElementById('btn-hard').onclick = () => this.start('hard');
        document.getElementById('btn-crazy').onclick = () => this.start('crazy');
        document.getElementById('btn-retry').onclick = () => this.start(this.mode);
        document.getElementById('btn-restart').onclick = () => {
            this.active = false;
            this.screens.success.classList.remove('active');
            this.screens.start.classList.add('active');
        };

        window.onkeydown = (e) => this.handleInput(e);

        this.init();
    }

    init() {
        this.updateTooth(false);
        this.updateUI();
    }

    start(mode = 'easy') {
        this.mode = mode;
        this.config = MODES[mode];
        this.score = 100;
        this.progress = 0;
        this.combo = 0;
        this.notes.forEach(n => n.el.remove());
        this.notes = [];
        this.active = true;
        this.gameContainer.className = mode; // Apply 'easy', 'hard', or 'crazy' class

        Object.values(this.screens).forEach(s => s.classList.remove('active'));
        this.updateUI();
        this.updateTooth(false);

        this.lastSpawn = performance.now();
        this.currentSpawnInterval = this.config.spawnInterval;
        this.currentNoteSpeed = 5; // Initial speed

        // Start Music
        const songUrl = this.musicInput.value.trim() || this.defaultBgm;
        if (this.bgm.src !== songUrl) {
            this.bgm.src = songUrl;
        }
        this.bgm.currentTime = 0;
        this.bgm.play().catch(e => console.log("Audio play blocked: " + e));

        requestAnimationFrame((t) => this.loop(t));
    }

    loop(timestamp) {
        if (!this.active) return;

        // Spawn note
        if (timestamp - this.lastSpawn > this.currentSpawnInterval) {
            this.spawnNote();
            this.lastSpawn = timestamp;
            // Gradually decrease interval to make it harder
            this.currentSpawnInterval = Math.max(400, this.currentSpawnInterval * 0.995);
        }

        // Update notes
        for (let i = this.notes.length - 1; i >= 0; i--) {
            const note = this.notes[i];
            note.y += this.currentNoteSpeed;
            note.el.style.top = note.y + 'px';

            // Miss check
            if (note.y > 680) {
                this.handleMiss(i);
            }
        }

        // Gradually increase falling speed
        this.currentNoteSpeed = Math.min(15, this.currentNoteSpeed + 0.012);

        requestAnimationFrame((t) => this.loop(t));
    }

    spawnNote() {
        const lanes = this.config.directions;
        const laneIdx = Math.floor(Math.random() * lanes.length);
        const laneId = lanes[laneIdx];
        const symbols = {
            up: '↑', left: '←', down: '↓', right: '→',
            q: 'Q', w: 'W', e: 'E'
        };

        const noteEl = document.createElement('div');
        noteEl.className = 'note';
        noteEl.innerText = symbols[laneId];

        const laneEl = document.getElementById(`lane-${laneId}`);
        laneEl.appendChild(noteEl);

        this.notes.push({
            el: noteEl,
            lane: laneId,
            y: -60
        });
    }

    handleInput(e) {
        if (!this.active) return;

        const keyMap = {
            ArrowUp: 'up',
            ArrowLeft: 'left',
            ArrowDown: 'down',
            ArrowRight: 'right',
            q: 'q', Q: 'q',
            w: 'w', W: 'w',
            e: 'e', E: 'e'
        };

        const laneId = keyMap[e.key];
        if (!laneId || !this.config.directions.includes(laneId)) return;

        // Visual feedback for hitzone
        const hitZone = document.querySelector(`#lane-${laneId} .hit-zone`);
        if (!hitZone) return;
        hitZone.classList.add('active');
        setTimeout(() => hitZone.classList.remove('active'), 100);

        // Check for hits
        let hitFound = false;
        for (let i = 0; i < this.notes.length; i++) {
            const note = this.notes[i];
            if (note.lane === laneId) {
                const distance = Math.abs(note.y - 610); // PERFECT_ZONE
                if (distance < this.config.hitWindow) {
                    this.handleHit(i, distance);
                    hitFound = true;
                    break;
                }
            }
        }

        if (!hitFound) {
            this.handleMiss(-1);
        }
    }

    handleHit(index, distance) {
        const note = this.notes[index];
        note.el.remove();
        this.notes.splice(index, 1);

        this.combo++;
        this.score += 15; // SCORE_PER_HIT
        this.progress += this.config.progressStep;

        this.createHitEffect(note.lane);
        this.triggerFlash('hit');
        this.updateUI();
        this.updateTooth(true);
        this.checkWinLoss();
    }

    createHitEffect(laneId) {
        const laneEl = document.getElementById(`lane-${laneId}`);
        const effect = document.createElement('div');
        effect.className = 'hit-effect';
        laneEl.appendChild(effect);

        // Position at hit zone
        effect.style.bottom = '40px';
        effect.style.left = '50%';
        effect.style.transform = 'translate(-50%, 0) scale(0)';
        effect.style.opacity = '1';

        effect.animate([
            { transform: 'translate(-50%, 0) scale(0)', opacity: 1 },
            { transform: 'translate(-50%, -20px) scale(2.5)', opacity: 0 }
        ], {
            duration: 400,
            easing: 'ease-out'
        }).onfinish = () => effect.remove();
    }

    handleMiss(index) {
        if (index !== -1) {
            const note = this.notes[index];
            note.el.remove();
            this.notes.splice(index, 1);
        }

        this.combo = 0;
        this.score = Math.max(0, this.score - 30); // MISS_PENALTY
        this.progress = Math.max(0, this.progress - 1.0); // PROGRESS_PENALTY (Reduced to 1.0)
        this.triggerFlash('miss');

        this.updateUI();
        this.updateTooth(false);
        this.checkWinLoss();
    }

    triggerFlash(type) {
        this.flashOverlay.className = type;
        this.flashOverlay.style.opacity = '1';
        setTimeout(() => {
            if (this.flashOverlay.className === type) {
                this.flashOverlay.style.opacity = '0';
            }
        }, 100);
    }

    updateUI() {
        this.scoreEl.innerText = `${Math.min(100, Math.floor(this.progress))}%`;
        this.progressGauge.style.width = `${Math.min(100, this.progress)}%`;

        if (this.combo > 1) {
            this.comboContainer.classList.add('active');
            this.comboCountEl.innerText = this.combo;
        } else {
            this.comboContainer.classList.remove('active');
        }
    }

    updateTooth(isHit = false) {
        const lift = (this.progress / 100) * 160;
        const tilt = Math.sin(this.progress * 0.2) * (this.progress / 4);
        const wobble = (Math.random() - 0.5) * (this.combo > 5 ? 8 : 4);

        // Update blood opacity as it pulls out
        if (this.toothBlood) {
            this.toothBlood.style.opacity = (this.progress / 150).toString();
        }

        const scale = isHit ? 1.15 : 1.0;
        this.toothVisual.style.transform = `translateY(-${lift}px) rotate(${tilt + wobble}deg) scale(${scale})`;

        if (isHit) {
            setTimeout(() => {
                this.toothVisual.style.transform = `translateY(-${lift}px) rotate(${tilt}deg) scale(1.0)`;
            }, 80);
        }

        if (this.progress >= 100) {
            this.toothVisual.style.opacity = '0';
            this.toothVisual.style.transition = 'opacity 0.5s ease-out, transform 0.5s ease-out';
            this.toothVisual.style.transform += ' translateY(-400px) rotate(360deg) scale(2)';
        } else {
            this.toothVisual.style.opacity = '1';
        }
    }

    checkWinLoss() {
        if (this.score <= 0) {
            this.gameOver(false);
        } else if (this.progress >= 100) { // WIN_PROGRESS
            this.gameOver(true);
        }
    }

    gameOver(success) {
        this.active = false;

        // Stop music
        this.bgm.pause();
        this.bgm.currentTime = 0;

        if (success) {
            this.celebrate();
            setTimeout(() => {
                this.screens.success.classList.add('active');
                this.screens.success.querySelector('h1').classList.add('success-pop');
            }, 800);
        } else {
            this.screens.gameover.classList.add('active');
        }
    }

    celebrate() {
        this.triggerFlash('success');
        this.gameContainer.classList.add('shake');
        setTimeout(() => this.gameContainer.classList.remove('shake'), 500);

        // Explode confetti
        for (let i = 0; i < 100; i++) {
            this.createConfetti();
        }
    }

    createConfetti() {
        const confetti = document.createElement('div');
        confetti.className = 'confetti';

        const colors = ['#38bdf8', '#10b981', '#fbbf24', '#f472b6', '#ffffff'];
        confetti.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];

        const startX = Math.random() * window.innerWidth;
        const startY = window.innerHeight + 10;

        confetti.style.left = startX + 'px';
        confetti.style.top = startY + 'px';
        document.body.appendChild(confetti);

        const destinationX = startX + (Math.random() - 0.5) * 400;
        const destinationY = -100 - (Math.random() * 500);
        const rotation = Math.random() * 720;

        confetti.animate([
            { transform: 'translate(0, 0) rotate(0deg)', opacity: 1 },
            { transform: `translate(${destinationX - startX}px, ${destinationY - startY}px) rotate(${rotation}deg)`, opacity: 0 }
        ], {
            duration: 1500 + Math.random() * 1000,
            easing: 'cubic-bezier(0, .9, .57, 1)'
        }).onfinish = () => confetti.remove();
    }
}

new Game();
