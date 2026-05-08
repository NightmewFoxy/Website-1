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
        const grd = ctx.createLinearGradient(0, 0, 0, H - GROUND_H);
        grd.addColorStop(0, '#070218');
        grd.addColorStop(0.5, '#240845');
        grd.addColorStop(1, '#4a1080');
        ctx.fillStyle = grd;
        ctx.fillRect(0, 0, W, H - GROUND_H);

        for (let i = 0; i < 38; i++) {
            const sx = (i * 47) % W;
            const sy = (i * 89) % (H * 0.55);
            const tw = (Math.sin(frame * 0.04 + i * 0.5) + 1) * 0.5;
            ctx.fillStyle = `rgba(255, 255, 255, ${0.18 + tw * 0.6})`;
            ctx.fillRect(sx, sy, 1.5, 1.5);
        }

        const mx = W * 0.78;
        const my = H * 0.16;
        const moonGlow = ctx.createRadialGradient(mx, my, 8, mx, my, 70);
        moonGlow.addColorStop(0, 'rgba(255, 100, 200, 0.55)');
        moonGlow.addColorStop(1, 'rgba(255, 100, 200, 0)');
        ctx.fillStyle = moonGlow;
        ctx.beginPath();
        ctx.arc(mx, my, 70, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#ff5fb1';
        ctx.beginPath();
        ctx.arc(mx, my, 19, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#ffaad4';
        ctx.beginPath();
        ctx.arc(mx - 5, my - 5, 7, 0, Math.PI * 2);
        ctx.fill();

        const yBase = H - GROUND_H - 4;
        const scroll = (frame * 0.3) % 32;
        for (let i = -1; i < 60; i++) {
            const x = i * 32 - scroll;
            if (x > W + 30) break;
            if (x + 28 < 0) continue;
            const h = 50 + ((i * 73) % 80);
            const w = 28;
            ctx.fillStyle = '#160832';
            ctx.fillRect(x, yBase - h, w, h);
            ctx.fillStyle = ((i * 7) % 2 === 0) ? '#ff10a0' : '#00f0ff';
            ctx.fillRect(x, yBase - h - 1, w, 2);
            for (let wy = 8; wy < h - 4; wy += 9) {
                for (let wx = 4; wx < w - 4; wx += 7) {
                    if (((wx * 13 + wy * 7 + i * 5) % 9) < 5) {
                        const flick = ((wx + wy * 3 + Math.floor(frame / 30) + i) % 11) < 9;
                        if (flick) {
                            ctx.fillStyle = ((wy + wx) % 2 === 0) ? '#ff10a0' : '#00f0ff';
                            ctx.fillRect(x + wx, yBase - h + wy, 2, 3);
                        }
                    }
                }
            }
            if (i % 3 === 0) {
                ctx.fillStyle = '#160832';
                ctx.fillRect(x + w / 2 - 1, yBase - h - 8, 2, 8);
                ctx.fillStyle = (Math.floor(frame / 20) % 2 === 0) ? '#ff10a0' : '#440022';
                ctx.fillRect(x + w / 2 - 2, yBase - h - 9, 4, 2);
            }
        }
    }

    function drawPipe(p) {
        const x = p.x;
        const topH = p.top;
        const bottomY = p.top + PIPE_GAP;
        const bottomH = H - GROUND_H - bottomY;

        ctx.fillStyle = '#160832';
        ctx.fillRect(x, 0, PIPE_W, topH);
        ctx.fillRect(x, bottomY, PIPE_W, bottomH);

        ctx.fillStyle = '#00f0ff';
        ctx.fillRect(x, 0, 3, topH);
        ctx.fillRect(x, bottomY, 3, bottomH);
        ctx.fillStyle = '#ff10a0';
        ctx.fillRect(x + PIPE_W - 3, 0, 3, topH);
        ctx.fillRect(x + PIPE_W - 3, bottomY, 3, bottomH);

        ctx.strokeStyle = 'rgba(0, 240, 255, 0.45)';
        ctx.lineWidth = 1;
        for (let cy = 30; cy < topH - 30; cy += 28) {
            ctx.beginPath();
            ctx.moveTo(x + 6, cy);
            ctx.lineTo(x + PIPE_W - 6, cy);
            ctx.stroke();
        }
        for (let cy = bottomY + 30; cy < bottomY + bottomH - 5; cy += 28) {
            ctx.beginPath();
            ctx.moveTo(x + 6, cy);
            ctx.lineTo(x + PIPE_W - 6, cy);
            ctx.stroke();
        }

        ctx.fillStyle = '#2a1a5a';
        ctx.fillRect(x - 4, topH - 28, PIPE_W + 8, 28);
        ctx.fillRect(x - 4, bottomY, PIPE_W + 8, 28);

        ctx.fillStyle = '#ff10a0';
        ctx.fillRect(x - 4, topH - 4, PIPE_W + 8, 4);
        ctx.fillStyle = 'rgba(255, 16, 160, 0.4)';
        ctx.fillRect(x - 4, topH - 8, PIPE_W + 8, 4);

        ctx.fillStyle = '#00f0ff';
        ctx.fillRect(x - 4, bottomY, PIPE_W + 8, 4);
        ctx.fillStyle = 'rgba(0, 240, 255, 0.4)';
        ctx.fillRect(x - 4, bottomY + 4, PIPE_W + 8, 4);

        const pulse = (Math.sin(frame * 0.15 + x * 0.01) + 1) * 0.5;
        ctx.fillStyle = `rgba(255, 16, 160, ${0.6 + pulse * 0.4})`;
        ctx.fillRect(x + 8, topH - 18, 4, 4);
        ctx.fillRect(x + PIPE_W - 12, topH - 18, 4, 4);
        ctx.fillStyle = `rgba(0, 240, 255, ${0.6 + pulse * 0.4})`;
        ctx.fillRect(x + 8, bottomY + 14, 4, 4);
        ctx.fillRect(x + PIPE_W - 12, bottomY + 14, 4, 4);
    }

    function drawGround() {
        const y = H - GROUND_H;

        ctx.fillStyle = '#070218';
        ctx.fillRect(0, y, W, GROUND_H);

        ctx.fillStyle = 'rgba(255, 16, 160, 0.4)';
        ctx.fillRect(0, y - 4, W, 4);
        ctx.fillStyle = '#ff10a0';
        ctx.fillRect(0, y, W, 3);

        ctx.lineWidth = 1;
        const vs = groundOffset * 2;
        for (let i = -3; i < 18; i++) {
            const lx = (i * 50) - (vs % 50);
            const offset = (lx - W / 2) * 0.55;
            ctx.strokeStyle = 'rgba(0, 240, 255, 0.5)';
            ctx.beginPath();
            ctx.moveTo(lx, y + 4);
            ctx.lineTo(lx + offset, y + GROUND_H);
            ctx.stroke();
        }
        for (let i = 1; i < 6; i++) {
            const ly = y + 4 + i * (GROUND_H - 4) / 6;
            const a = i / 6;
            ctx.strokeStyle = `rgba(0, 240, 255, ${0.15 + a * 0.4})`;
            ctx.beginPath();
            ctx.moveTo(0, ly);
            ctx.lineTo(W, ly);
            ctx.stroke();
        }

        ctx.fillStyle = '#00f0ff';
        ctx.fillRect(0, H - 2, W, 2);
    }

    function drawJetpackPickup(p) {
        const bob = Math.sin(frame * 0.1 + p.bob) * 4;
        const cx = p.x;
        const cy = p.y + bob;

        ctx.save();
        ctx.translate(cx, cy);

        const glow = ctx.createRadialGradient(0, 0, 4, 0, 0, 32);
        glow.addColorStop(0, 'rgba(255, 16, 160, 0.7)');
        glow.addColorStop(1, 'rgba(255, 16, 160, 0)');
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(0, 0, 32, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#1a1a2e';
        ctx.strokeStyle = '#00f0ff';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.roundRect(-10, -12, 8, 18, 2);
        ctx.fill();
        ctx.stroke();
        ctx.beginPath();
        ctx.roundRect(2, -12, 8, 18, 2);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#ff10a0';
        ctx.fillRect(-11, -14, 22, 4);
        ctx.strokeStyle = '#ff5fb1';
        ctx.strokeRect(-11, -14, 22, 4);

        const flick = (Math.sin(frame * 0.6) + 1) * 0.5;
        ctx.fillStyle = '#00f0ff';
        ctx.beginPath();
        ctx.moveTo(-9, 6);
        ctx.lineTo(-6, 6);
        ctx.lineTo(-7.5, 12 + flick * 3);
        ctx.closePath();
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(3, 6);
        ctx.lineTo(6, 6);
        ctx.lineTo(4.5, 12 + flick * 3);
        ctx.closePath();
        ctx.fill();

        ctx.restore();
    }

    function drawCoin(c) {
        const wobble = Math.cos(frame * 0.15 + c.spin);
        const w = COIN_R * Math.abs(wobble);
        ctx.save();
        ctx.translate(c.x, c.y);

        const glow = ctx.createRadialGradient(0, 0, 4, 0, 0, COIN_R + 8);
        glow.addColorStop(0, 'rgba(0, 240, 255, 0.8)');
        glow.addColorStop(1, 'rgba(0, 240, 255, 0)');
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(0, 0, COIN_R + 8, 0, Math.PI * 2);
        ctx.fill();

        const grd = ctx.createLinearGradient(0, -COIN_R, 0, COIN_R);
        grd.addColorStop(0, '#aaffee');
        grd.addColorStop(1, '#0099bb');
        ctx.fillStyle = grd;
        ctx.strokeStyle = '#00f0ff';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.ellipse(0, 0, Math.max(2, w), COIN_R, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        if (wobble > 0.3) {
            ctx.fillStyle = '#003344';
            ctx.font = 'bold 13px monospace';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('¥', 0, 1);
        }
        ctx.restore();
    }

    function drawParticles() {
        for (const pt of particles) {
            const t = pt.life / pt.maxLife;
            ctx.fillStyle = `hsla(${pt.hue}, 100%, ${50 + t * 20}%, ${t})`;
            ctx.beginPath();
            ctx.arc(pt.x, pt.y, pt.size * t, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    function drawBird() {
        const jet = jetpackTime > 0;
        ctx.save();
        ctx.translate(bird.x, bird.y);
        ctx.rotate(bird.rot);

        if (jet) {
            ctx.fillStyle = '#1a1a2e';
            ctx.strokeStyle = '#00f0ff';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.roundRect(-19, -8, 9, 20, 3);
            ctx.fill();
            ctx.stroke();
            ctx.fillStyle = '#ff10a0';
            ctx.fillRect(-20, -10, 11, 3);
        }

        const wingFlap = jet ? 0 : (state === 'playing' ? Math.sin(frame * 0.4) * 4 : 0);

        const halo = ctx.createRadialGradient(0, 0, bird.r - 2, 0, 0, bird.r + 14);
        halo.addColorStop(0, 'rgba(255, 16, 160, 0.28)');
        halo.addColorStop(0.6, 'rgba(0, 240, 255, 0.18)');
        halo.addColorStop(1, 'rgba(0, 240, 255, 0)');
        ctx.fillStyle = halo;
        ctx.beginPath();
        ctx.arc(0, 0, bird.r + 14, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#f7d51d';
        ctx.beginPath();
        ctx.arc(0, 0, bird.r, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#553';
        ctx.lineWidth = 2;
        ctx.stroke();

        ctx.fillStyle = '#e89c1f';
        ctx.beginPath();
        ctx.ellipse(-2, 4 + wingFlap, 10, 6, -0.3, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = 'white';
        ctx.beginPath();
        ctx.arc(7, -5, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#222';
        ctx.beginPath();
        ctx.arc(8, -5, 2.4, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#f08a1f';
        ctx.beginPath();
        ctx.moveTo(13, 0);
        ctx.lineTo(24, -2);
        ctx.lineTo(24, 4);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        ctx.save();
        ctx.beginPath();
        ctx.arc(0, 0, bird.r, 0, Math.PI * 2);
        ctx.moveTo(13, 0);
        ctx.lineTo(24, -2);
        ctx.lineTo(24, 4);
        ctx.closePath();
        ctx.clip();

        const mGrd = ctx.createRadialGradient(bird.r * 0.6, -bird.r * 0.6, 0, bird.r * 0.6, -bird.r * 0.6, bird.r * 1.7);
        mGrd.addColorStop(0, 'rgba(255, 16, 160, 0.6)');
        mGrd.addColorStop(0.7, 'rgba(255, 16, 160, 0.08)');
        mGrd.addColorStop(1, 'rgba(255, 16, 160, 0)');
        ctx.fillStyle = mGrd;
        ctx.fillRect(-30, -30, 60, 60);

        const cGrd = ctx.createRadialGradient(-bird.r * 0.7, bird.r * 0.6, 0, -bird.r * 0.7, bird.r * 0.6, bird.r * 1.6);
        cGrd.addColorStop(0, 'rgba(0, 240, 255, 0.5)');
        cGrd.addColorStop(0.7, 'rgba(0, 240, 255, 0.06)');
        cGrd.addColorStop(1, 'rgba(0, 240, 255, 0)');
        ctx.fillStyle = cGrd;
        ctx.fillRect(-30, -30, 60, 60);

        ctx.restore();

        ctx.restore();
    }

    function drawHUD() {
        if (jetpackTime > 0) {
            const pct = jetpackTime / JETPACK_DURATION;
            const barW = Math.min(220, W * 0.55);
            const barH = 10;
            const bx = (W - barW) / 2;
            const by = 18;
            ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
            ctx.fillRect(bx - 2, by - 2, barW + 4, barH + 4);
            const grd = ctx.createLinearGradient(bx, by, bx + barW, by);
            grd.addColorStop(0, '#ff8c1f');
            grd.addColorStop(1, '#ffd84d');
            ctx.fillStyle = grd;
            ctx.fillRect(bx, by, barW * pct, barH);
            ctx.fillStyle = 'white';
            ctx.font = 'bold 11px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('JETPACK', W / 2, by - 6);
        }

        ctx.save();
        ctx.translate(W - 56, 26);
        ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
        ctx.beginPath();
        ctx.roundRect(-8, -16, 56, 28, 14);
        ctx.fill();
        const grd = ctx.createLinearGradient(0, -8, 0, 8);
        grd.addColorStop(0, '#ffeb6e');
        grd.addColorStop(1, '#e0a200');
        ctx.fillStyle = grd;
        ctx.strokeStyle = '#9a6e00';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(0, 0, 9, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = 'white';
        ctx.font = 'bold 16px sans-serif';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText('x ' + coinsCollected, 14, 1);
        ctx.restore();

        if (flashTime > 0) {
            const a = flashTime / 18 * 0.5;
            ctx.fillStyle = `rgba(255, 230, 130, ${a})`;
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
