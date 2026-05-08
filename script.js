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

    let W = BASE_W, H = BASE_H, scale = 1;
    let bird, pipes, score, best, frame, groundOffset;
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
        bird = {
            x: W * 0.28,
            y: H / 2,
            vy: 0,
            r: 16,
            rot: 0,
        };
        pipes = [];
        score = 0;
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
    }

    function flap() {
        if (state === 'playing') {
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

    function update() {
        bird.vy += GRAVITY;
        bird.y += bird.vy;
        bird.rot = Math.max(-0.5, Math.min(1.4, bird.vy * 0.08));

        groundOffset = (groundOffset + PIPE_SPEED) % 24;

        for (const p of pipes) {
            p.x -= PIPE_SPEED;
        }

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
            const inX = bird.x + bird.r > p.x && bird.x - bird.r < p.x + PIPE_W;
            const hitTop = bird.y - bird.r < p.top;
            const hitBottom = bird.y + bird.r > p.top + PIPE_GAP;
            if (inX && (hitTop || hitBottom)) {
                endGame();
                return;
            }
        }

        if (bird.y + bird.r > H - GROUND_H) {
            bird.y = H - GROUND_H - bird.r;
            endGame();
            return;
        }
        if (bird.y - bird.r < 0) {
            bird.y = bird.r;
            bird.vy = 0;
        }

        frame++;
    }

    function drawCloud(x, y, s) {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
        ctx.beginPath();
        ctx.arc(x, y, 18 * s, 0, Math.PI * 2);
        ctx.arc(x + 18 * s, y - 6 * s, 22 * s, 0, Math.PI * 2);
        ctx.arc(x + 38 * s, y, 18 * s, 0, Math.PI * 2);
        ctx.arc(x + 20 * s, y + 8 * s, 16 * s, 0, Math.PI * 2);
        ctx.fill();
    }

    function drawBackground() {
        const grd = ctx.createLinearGradient(0, 0, 0, H - GROUND_H);
        grd.addColorStop(0, '#70c5ce');
        grd.addColorStop(1, '#a3e0e8');
        ctx.fillStyle = grd;
        ctx.fillRect(0, 0, W, H - GROUND_H);

        const cloudShift = (frame * 0.3) % (W + 200);
        drawCloud(W - cloudShift + 40, H * 0.18, 1);
        drawCloud(W - cloudShift + 260, H * 0.28, 0.8);
        drawCloud(W - cloudShift - 180, H * 0.12, 1.1);
    }

    function drawPipe(p) {
        const x = p.x;
        const topH = p.top;
        const bottomY = p.top + PIPE_GAP;
        const bottomH = H - GROUND_H - bottomY;

        ctx.fillStyle = '#5cb74a';
        ctx.fillRect(x, 0, PIPE_W, topH);
        ctx.fillRect(x, bottomY, PIPE_W, bottomH);

        ctx.fillStyle = '#74d268';
        ctx.fillRect(x + 4, 0, 8, topH);
        ctx.fillRect(x + 4, bottomY, 8, bottomH);

        ctx.fillStyle = '#3d8a2e';
        ctx.fillRect(x + PIPE_W - 10, 0, 6, topH);
        ctx.fillRect(x + PIPE_W - 10, bottomY, 6, bottomH);

        ctx.fillStyle = '#5cb74a';
        ctx.fillRect(x - 4, topH - 28, PIPE_W + 8, 28);
        ctx.fillRect(x - 4, bottomY, PIPE_W + 8, 28);
        ctx.strokeStyle = '#3d8a2e';
        ctx.lineWidth = 2;
        ctx.strokeRect(x - 4, topH - 28, PIPE_W + 8, 28);
        ctx.strokeRect(x - 4, bottomY, PIPE_W + 8, 28);
    }

    function drawGround() {
        const y = H - GROUND_H;
        ctx.fillStyle = '#ded895';
        ctx.fillRect(0, y, W, GROUND_H);

        ctx.fillStyle = '#c8b96d';
        for (let x = -groundOffset; x < W; x += 24) {
            ctx.fillRect(x, y, 12, 8);
        }
        ctx.fillStyle = '#a87a3c';
        ctx.fillRect(0, y + 8, W, 6);
        ctx.fillStyle = '#7d5a2c';
        ctx.fillRect(0, y + 14, W, GROUND_H - 14);
    }

    function drawBird() {
        ctx.save();
        ctx.translate(bird.x, bird.y);
        ctx.rotate(bird.rot);

        const wingFlap = state === 'playing' ? Math.sin(frame * 0.4) * 4 : 0;

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

        ctx.restore();
    }

    function render() {
        ctx.clearRect(0, 0, W, H);
        drawBackground();
        for (const p of pipes) drawPipe(p);
        drawGround();
        drawBird();
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

    startBtn.addEventListener('click', startGame);
    restartBtn.addEventListener('click', startGame);

    resize();
    reset();
    state = 'menu';
    requestAnimationFrame(idleRender);
})();
