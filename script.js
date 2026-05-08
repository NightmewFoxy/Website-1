(() => {
    const canvas = document.getElementById('game');
    const ctx = canvas.getContext('2d');
    const scoreEl = document.getElementById('score');
    const overlay = document.getElementById('overlay');
    const gameover = document.getElementById('gameover');
    const finalScoreEl = document.getElementById('final-score');
    const bestScoreEl = document.getElementById('best-score');
    const bestStartEl = document.getElementById('best-start');
    const startBtn = document.getElementById('start-btn');
    const restartBtn = document.getElementById('restart-btn');

    const BASE_W = 400;
    const BASE_H = 600;
    const GROUND_H = 80;
    const GRAVITY = 0.5;
    const FLAP = -8.5;
    const PIPE_W = 70;
    const PIPE_GAP = 160;
    const PIPE_SPACING = 220;
    const PIPE_SPEED = 2.5;

    const JETPACK_DURATION = 360;
    const JETPACK_TARGET_RATIO = 0.28;
    const PICKUP_R = 16;
    const COIN_R = 11;
    const PICKUP_CHANCE = 0.22;

    let W = BASE_W, H = BASE_H, scale = 1;
    let bird, pipes, pickups, coins, particles, flashTime;
    let score, coinsCollected, best, frame, groundOffset;
    let jetpackTime = 0;
    let state = 'menu';
    let lastTime = 0;

    best = parseInt(localStorage.getItem('flappy-best') || '0', 10);
    bestStartEl.textContent = best;

    function resize() {
        const dpr = window.devicePixelRatio || 1;
        const w = canvas.clientWidth;
        const h = canvas.clientHeight;
        canvas.width = w * dpr;
        canvas.height = h * dpr;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        scale = Math.min(w / BASE_W, h / BASE_H);
        W = w / scale;
        H = h / scale;
        ctx.scale(scale, scale);
    }
    window.addEventListener('resize', resize);

    function reset() {
        bird = { x: W * 0.28, y: H / 2, vy: 0, r: 16, rot: 0 };
        pipes = [];
        pickups = [];
        coins = [];
        particles = [];
        score = 0;
        coinsCollected = 0;
        jetpackTime = 0;
        flashTime = 0;
        frame = 0;
        groundOffset = 0;
        scoreEl.textContent = '0';
        for (let i = 0; i < 3; i++) {
            spawnPipe(W + i * PIPE_SPACING);
        }
    }

    function spawnPipe(x) {
        const minTop = 60;
        const maxTop = H - GROUND_H - PIPE_GAP - 60;
        const top = minTop + Math.random() * (maxTop - minTop);
        pipes.push({ x, top, passed: false });
        if (jetpackTime <= 0 && pipes.length > 2 && Math.random() < PICKUP_CHANCE) {
            pickups.push({
                x: x + PIPE_W / 2 + PIPE_SPACING / 2,
                y: top + PIPE_GAP / 2,
                bob: Math.random() * Math.PI * 2,
                collected: false,
            });
        }
    }

    function spawnCoinTrail(startX) {
        const baseY = H * JETPACK_TARGET_RATIO;
        const count = 10;
        for (let i = 0; i < count; i++) {
            coins.push({
                x: startX + 180 + i * 55,
                y: baseY + Math.sin(i * 0.7) * 36,
                collected: false,
                spin: i * 0.2,
            });
        }
    }

    function flap() {
        if (state === 'playing' && jetpackTime <= 0) {
            bird.vy = FLAP;
        }
    }

    function startGame() {
        overlay.classList.add('hidden');
        gameover.classList.add('hidden');
        reset();
        state = 'playing';
        bird.vy = FLAP;
        lastTime = performance.now();
        requestAnimationFrame(loop);
    }

    function endGame() {
        state = 'over';
        if (score > best) {
            best = score;
            localStorage.setItem('flappy-best', String(best));
        }
        finalScoreEl.textContent = score;
        bestScoreEl.textContent = best;
        bestStartEl.textContent = best;
        gameover.classList.remove('hidden');
    }

    function activateJetpack() {
        const refresh = jetpackTime > 0;
        jetpackTime = JETPACK_DURATION;
        flashTime = 18;
        if (!refresh) spawnCoinTrail(bird.x);
    }

    function update() {
        const jet = jetpackTime > 0;

        if (jet) {
            jetpackTime--;
            const targetY = H * JETPACK_TARGET_RATIO + Math.sin(frame * 0.12) * 10;
            bird.y += (targetY - bird.y) * 0.14;
            bird.vy = 0;
            bird.rot = -0.25;

            if (frame % 2 === 0) {
                particles.push({
                    x: bird.x - 14,
                    y: bird.y + 6,
                    vx: -2.5 - Math.random() * 1.5,
                    vy: (Math.random() - 0.5) * 1.2,
                    life: 26,
                    maxLife: 26,
                    size: 5 + Math.random() * 3,
                    hue: Math.random() < 0.5 ? 180 + Math.random() * 20 : 320 + Math.random() * 20,
                });
            }
        } else {
            bird.vy += GRAVITY;
            bird.y += bird.vy;
            bird.rot = Math.max(-0.5, Math.min(1.4, bird.vy * 0.08));
        }

        groundOffset = (groundOffset + PIPE_SPEED) % 24;

        for (const p of pipes) p.x -= PIPE_SPEED;
        for (const p of pickups) p.x -= PIPE_SPEED;
        for (const c of coins) c.x -= PIPE_SPEED;

        if (pipes.length && pipes[0].x + PIPE_W < 0) {
            pipes.shift();
            const lastX = pipes[pipes.length - 1].x;
            spawnPipe(lastX + PIPE_SPACING);
        }

        for (const p of pipes) {
            if (!p.passed && p.x + PIPE_W < bird.x) {
                p.passed = true;
                score++;
                scoreEl.textContent = score;
            }
            if (jet) continue;
            const inX = bird.x + bird.r > p.x && bird.x - bird.r < p.x + PIPE_W;
            const hitTop = bird.y - bird.r < p.top;
            const hitBottom = bird.y + bird.r > p.top + PIPE_GAP;
            if (inX && (hitTop || hitBottom)) {
                endGame();
                return;
            }
        }

        for (const p of pickups) {
            if (p.collected) continue;
            const dx = bird.x - p.x;
            const dy = bird.y - p.y;
            if (dx * dx + dy * dy < (bird.r + PICKUP_R) * (bird.r + PICKUP_R)) {
                p.collected = true;
                activateJetpack();
            }
        }
        pickups = pickups.filter(p => !p.collected && p.x + PICKUP_R > -10);

        for (const c of coins) {
            if (c.collected) continue;
            const dx = bird.x - c.x;
            const dy = bird.y - c.y;
            if (dx * dx + dy * dy < (bird.r + COIN_R) * (bird.r + COIN_R)) {
                c.collected = true;
                coinsCollected++;
                score++;
                scoreEl.textContent = score;
            }
        }
        coins = coins.filter(c => !c.collected && c.x + COIN_R > -10);

        for (const pt of particles) {
            pt.x += pt.vx;
            pt.y += pt.vy;
            pt.life--;
        }
        particles = particles.filter(pt => pt.life > 0);

        if (flashTime > 0) flashTime--;

        if (!jet) {
            if (bird.y + bird.r > H - GROUND_H) {
                bird.y = H - GROUND_H - bird.r;
                endGame();
                return;
            }
            if (bird.y - bird.r < 0) {
                bird.y = bird.r;
                bird.vy = 0;
            }
        } else {
            if (bird.y - bird.r < 0) bird.y = bird.r;
            if (bird.y + bird.r > H - GROUND_H - 20) bird.y = H - GROUND_H - 20 - bird.r;
        }

        frame++;
    }

    function drawCloud(x, y, s) {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.92)';
        ctx.beginPath();
        ctx.arc(x, y, 18 * s, 0, Math.PI * 2);
        ctx.arc(x + 18 * s, y - 6 * s, 22 * s, 0, Math.PI * 2);
        ctx.arc(x + 38 * s, y, 18 * s, 0, Math.PI * 2);
        ctx.arc(x + 20 * s, y + 8 * s, 16 * s, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = '#8aa6b8';
        ctx.lineWidth = 1.6 * s;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(x + 12 * s, y - 2 * s);
        ctx.quadraticCurveTo(x + 15 * s, y - 6 * s, x + 18 * s, y - 2 * s);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(x + 24 * s, y - 2 * s);
        ctx.quadraticCurveTo(x + 27 * s, y - 6 * s, x + 30 * s, y - 2 * s);
        ctx.stroke();

        ctx.fillStyle = 'rgba(255, 150, 175, 0.45)';
        ctx.beginPath();
        ctx.arc(x + 11 * s, y + 4 * s, 2.2 * s, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(x + 31 * s, y + 4 * s, 2.2 * s, 0, Math.PI * 2);
        ctx.fill();
    }

    function drawBackground() {
        ctx.fillStyle = '#faf6e8';
        ctx.fillRect(0, 0, W, H - GROUND_H);

        const mx = W * 0.78;
        const my = H * 0.16;
        ctx.strokeStyle = '#1a1a1a';
        ctx.fillStyle = 'white';
        ctx.lineWidth = 2;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.beginPath();
        ctx.arc(mx, my, 22, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        for (let i = 0; i < 8; i++) {
            const angle = i * Math.PI / 4 + frame * 0.005;
            const inner = 27;
            const outer = 34;
            ctx.beginPath();
            ctx.moveTo(mx + Math.cos(angle) * inner, my + Math.sin(angle) * inner);
            ctx.lineTo(mx + Math.cos(angle) * outer, my + Math.sin(angle) * outer);
            ctx.stroke();
        }

        const cloudShift = (frame * 0.3) % (W + 240);
        drawDoodleCloud(W - cloudShift + 40, H * 0.18);
        drawDoodleCloud(W - cloudShift + 260, H * 0.32);
        drawDoodleCloud(W - cloudShift - 180, H * 0.10);
    }

    function drawDoodleCloud(x, y) {
        ctx.fillStyle = 'white';
        ctx.strokeStyle = '#1a1a1a';
        ctx.lineWidth = 2;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.beginPath();
        ctx.moveTo(x - 22, y + 4);
        ctx.bezierCurveTo(x - 32, y - 4, x - 22, y - 16, x - 8, y - 10);
        ctx.bezierCurveTo(x - 4, y - 22, x + 14, y - 22, x + 16, y - 10);
        ctx.bezierCurveTo(x + 28, y - 16, x + 38, y - 4, x + 28, y + 4);
        ctx.lineTo(x - 22, y + 4);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
    }

    function drawPipe(p) {
        const x = p.x;
        const topH = p.top;
        const bottomY = p.top + PIPE_GAP;
        const bottomH = H - GROUND_H - bottomY;

        ctx.fillStyle = 'white';
        ctx.strokeStyle = '#1a1a1a';
        ctx.lineWidth = 2.5;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        ctx.beginPath();
        ctx.rect(x, 0, PIPE_W, topH - 18);
        ctx.fill();
        ctx.stroke();
        ctx.beginPath();
        ctx.rect(x - 5, topH - 20, PIPE_W + 10, 20);
        ctx.fill();
        ctx.stroke();

        ctx.beginPath();
        ctx.rect(x - 5, bottomY, PIPE_W + 10, 20);
        ctx.fill();
        ctx.stroke();
        ctx.beginPath();
        ctx.rect(x, bottomY + 18, PIPE_W, bottomH - 18);
        ctx.fill();
        ctx.stroke();

        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(x + 8, 8);
        ctx.lineTo(x + 8, topH - 24);
        ctx.moveTo(x + 8, bottomY + 24);
        ctx.lineTo(x + 8, bottomY + bottomH - 8);
        ctx.stroke();
    }

    function drawGround() {
        const y = H - GROUND_H;

        ctx.fillStyle = '#faf6e8';
        ctx.fillRect(0, y, W, GROUND_H);

        ctx.strokeStyle = '#1a1a1a';
        ctx.lineWidth = 2.5;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(W, y);
        ctx.stroke();

        ctx.lineWidth = 1.6;
        for (let x = -groundOffset; x < W; x += 28) {
            ctx.beginPath();
            ctx.moveTo(x, y);
            ctx.lineTo(x - 1, y - 5);
            ctx.moveTo(x + 4, y);
            ctx.lineTo(x + 5, y - 6);
            ctx.moveTo(x + 8, y);
            ctx.lineTo(x + 8, y - 4);
            ctx.stroke();
        }

        ctx.lineWidth = 1.4;
        for (let x = -groundOffset * 0.5 % 120; x < W; x += 120) {
            const sx = x + 40;
            const sy = y + 18;
            ctx.beginPath();
            ctx.arc(sx, sy + 4, 2.5, 0, Math.PI * 2);
            ctx.stroke();
            ctx.beginPath();
            ctx.arc(sx - 3, sy, 1.2, 0, Math.PI * 2);
            ctx.arc(sx - 1, sy - 1.5, 1.2, 0, Math.PI * 2);
            ctx.arc(sx + 1, sy - 1.5, 1.2, 0, Math.PI * 2);
            ctx.arc(sx + 3, sy, 1.2, 0, Math.PI * 2);
            ctx.stroke();
        }
    }

    function drawJetpackPickup(p) {
        const bob = Math.sin(frame * 0.1 + p.bob) * 4;
        const cx = p.x;
        const cy = p.y + bob;

        ctx.save();
        ctx.translate(cx, cy);

        ctx.fillStyle = 'white';
        ctx.strokeStyle = '#1a1a1a';
        ctx.lineWidth = 2;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        ctx.beginPath();
        ctx.roundRect(-10, -12, 8, 18, 2);
        ctx.fill();
        ctx.stroke();
        ctx.beginPath();
        ctx.roundRect(2, -12, 8, 18, 2);
        ctx.fill();
        ctx.stroke();

        ctx.beginPath();
        ctx.rect(-11, -14, 22, 4);
        ctx.fill();
        ctx.stroke();

        const flick = (Math.sin(frame * 0.6) + 1) * 0.5;
        ctx.beginPath();
        ctx.moveTo(-9, 6);
        ctx.lineTo(-7.5, 12 + flick * 3);
        ctx.lineTo(-6, 6);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(3, 6);
        ctx.lineTo(4.5, 12 + flick * 3);
        ctx.lineTo(6, 6);
        ctx.stroke();

        ctx.restore();
    }

    function drawCoin(c) {
        const wobble = Math.cos(frame * 0.15 + c.spin);
        const w = COIN_R * Math.abs(wobble);
        ctx.save();
        ctx.translate(c.x, c.y);

        ctx.fillStyle = 'white';
        ctx.strokeStyle = '#1a1a1a';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.ellipse(0, 0, Math.max(2, w), COIN_R, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        if (wobble > 0.4) {
            ctx.fillStyle = '#1a1a1a';
            ctx.beginPath();
            ctx.ellipse(0, 2, 3, 2.5, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.beginPath();
            ctx.arc(-3.6, -2, 1.4, 0, Math.PI * 2);
            ctx.fill();
            ctx.beginPath();
            ctx.arc(-1.3, -4.2, 1.4, 0, Math.PI * 2);
            ctx.fill();
            ctx.beginPath();
            ctx.arc(1.3, -4.2, 1.4, 0, Math.PI * 2);
            ctx.fill();
            ctx.beginPath();
            ctx.arc(3.6, -2, 1.4, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.restore();
    }

    function drawParticles() {
        for (const pt of particles) {
            const t = pt.life / pt.maxLife;
            ctx.fillStyle = `rgba(26, 26, 26, ${t * 0.6})`;
            ctx.beginPath();
            ctx.arc(pt.x, pt.y, pt.size * t * 0.55, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    function drawBird() {
        const jet = jetpackTime > 0;
        ctx.save();
        ctx.translate(bird.x, bird.y);
        ctx.rotate(bird.rot);

        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        if (jet) {
            ctx.fillStyle = 'white';
            ctx.strokeStyle = '#1a1a1a';
            ctx.lineWidth = 1.8;
            ctx.beginPath();
            ctx.rect(-19, -7, 8, 16);
            ctx.fill();
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(-18, 9);
            ctx.lineTo(-15, 14);
            ctx.lineTo(-12, 9);
            ctx.stroke();
        }

        const wingFlap = jet ? 0 : (state === 'playing' ? Math.sin(frame * 0.4) * 5 : 0);

        ctx.strokeStyle = '#1a1a1a';
        ctx.fillStyle = 'white';
        ctx.lineWidth = 2.2;

        ctx.beginPath();
        ctx.moveTo(-bird.r + 2, 1);
        ctx.bezierCurveTo(-bird.r - 4, -3, -bird.r - 9, 4, -bird.r - 6, 8);
        ctx.bezierCurveTo(-bird.r - 4, 10, -bird.r - 8, 11, -bird.r - 9, 9);
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(0, 0, bird.r, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(-9, -bird.r + 5);
        ctx.lineTo(-11, -bird.r - 6);
        ctx.lineTo(-3, -bird.r + 1);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(4, -bird.r + 1);
        ctx.lineTo(8, -bird.r - 7);
        ctx.lineTo(11, -bird.r + 4);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(-3, bird.r - 1);
        ctx.lineTo(-5, bird.r + 7 - wingFlap);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(3, bird.r - 1);
        ctx.lineTo(4, bird.r + 7 + wingFlap);
        ctx.stroke();

        ctx.fillStyle = '#1a1a1a';
        ctx.beginPath();
        ctx.arc(2, -3, 1.6, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(9, -3, 1.6, 0, Math.PI * 2);
        ctx.fill();

        ctx.beginPath();
        ctx.ellipse(11.5, 3, 1.8, 1.4, 0, 0, Math.PI * 2);
        ctx.fill();

        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.moveTo(11.5, 4.4);
        ctx.lineTo(11.5, 6.5);
        ctx.moveTo(11.5, 6.5);
        ctx.quadraticCurveTo(9, 8, 7.5, 6.5);
        ctx.moveTo(11.5, 6.5);
        ctx.quadraticCurveTo(14, 8, 15, 6.5);
        ctx.stroke();

        ctx.restore();
    }

    function drawHUD() {
        if (jetpackTime > 0) {
            const pct = jetpackTime / JETPACK_DURATION;
            const barW = Math.min(220, W * 0.55);
            const barH = 12;
            const bx = (W - barW) / 2;
            const by = 18;
            ctx.fillStyle = 'white';
            ctx.strokeStyle = '#1a1a1a';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.rect(bx, by, barW, barH);
            ctx.fill();
            ctx.stroke();
            ctx.fillStyle = '#1a1a1a';
            ctx.fillRect(bx + 2, by + 2, (barW - 4) * pct, barH - 4);
            ctx.fillStyle = '#1a1a1a';
            ctx.font = 'bold 12px "Comic Sans MS", cursive';
            ctx.textAlign = 'center';
            ctx.fillText('JETPACK!', W / 2, by - 4);
        }

        ctx.save();
        ctx.translate(W - 56, 26);
        ctx.fillStyle = 'white';
        ctx.strokeStyle = '#1a1a1a';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(0, 0, 9, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#1a1a1a';
        ctx.beginPath();
        ctx.ellipse(0, 1.5, 2.4, 2, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(-2.8, -1.5, 1, 0, Math.PI * 2);
        ctx.arc(-1, -3, 1, 0, Math.PI * 2);
        ctx.arc(1, -3, 1, 0, Math.PI * 2);
        ctx.arc(2.8, -1.5, 1, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#1a1a1a';
        ctx.font = 'bold 17px "Comic Sans MS", cursive';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText('x ' + coinsCollected, 14, 1);
        ctx.restore();

        if (flashTime > 0) {
            const a = flashTime / 18 * 0.4;
            ctx.fillStyle = `rgba(26, 26, 26, ${a})`;
            ctx.fillRect(0, 0, W, H);
        }
    }

    function render() {
        ctx.clearRect(0, 0, W, H);
        drawBackground();
        for (const p of pipes) drawPipe(p);
        for (const c of coins) drawCoin(c);
        for (const p of pickups) drawJetpackPickup(p);
        drawParticles();
        drawGround();
        drawBird();
        drawHUD();
    }

    function loop(now) {
        if (state !== 'playing') return;
        const dt = Math.min(32, now - lastTime);
        lastTime = now;
        const steps = Math.max(1, Math.round(dt / 16.67));
        for (let i = 0; i < steps && state === 'playing'; i++) {
            update();
        }
        render();
        if (state === 'playing') requestAnimationFrame(loop);
    }

    function idleRender() {
        if (state !== 'menu') return;
        frame++;
        ctx.clearRect(0, 0, W, H);
        drawBackground();
        drawGround();
        ctx.save();
        ctx.translate(W / 2, H / 2 + Math.sin(frame * 0.08) * 6);
        ctx.rotate(Math.sin(frame * 0.08) * 0.1);
        ctx.translate(-W / 2, -H / 2);
        bird = bird || { x: W / 2, y: H / 2, vy: 0, r: 16, rot: 0 };
        bird.x = W / 2;
        bird.y = H / 2;
        bird.rot = 0;
        drawBird();
        ctx.restore();
        requestAnimationFrame(idleRender);
    }

    function handleTap(e) {
        if (e) e.preventDefault();
        if (state === 'playing') flap();
    }

    canvas.addEventListener('touchstart', handleTap, { passive: false });
    canvas.addEventListener('mousedown', handleTap);
    document.addEventListener('keydown', (e) => {
        if (e.code === 'Space' || e.code === 'ArrowUp') {
            e.preventDefault();
            if (state === 'menu') startGame();
            else if (state === 'over') startGame();
            else flap();
        }
    });

    if (!CanvasRenderingContext2D.prototype.roundRect) {
        CanvasRenderingContext2D.prototype.roundRect = function (x, y, w, h, r) {
            const rr = Math.min(r, w / 2, h / 2);
            this.beginPath();
            this.moveTo(x + rr, y);
            this.arcTo(x + w, y, x + w, y + h, rr);
            this.arcTo(x + w, y + h, x, y + h, rr);
            this.arcTo(x, y + h, x, y, rr);
            this.arcTo(x, y, x + w, y, rr);
            this.closePath();
            return this;
        };
    }

    startBtn.addEventListener('click', startGame);
    restartBtn.addEventListener('click', startGame);

    resize();
    reset();
    state = 'menu';
    requestAnimationFrame(idleRender);
})();
