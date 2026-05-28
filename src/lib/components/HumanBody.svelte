<script lang="ts">
  import { bloodSugar, insulinLevel, glucagonLevel, score, gameStatus, secreteInsulin, secreteGlucagon } from '$lib/stores/game';
  import { onMount } from 'svelte';

  function showScorePopup(clientX: number, clientY: number, bonus: number) {
    const pop = document.createElement('div');
    pop.textContent = `+${bonus.toLocaleString()}점`;
    Object.assign(pop.style, {
      position: 'fixed',
      left: `${clientX}px`,
      top: `${clientY}px`,
      transform: 'translate(-50%, -50%) scale(0.8)',
      fontSize: '20px',
      fontWeight: '900',
      color: '#166534',
      background: 'rgba(255,255,255,0.95)',
      padding: '6px 12px',
      borderRadius: '999px',
      boxShadow: '0 6px 16px rgba(22,101,52,0.25)',
      border: '2px solid #22c55e',
      pointerEvents: 'none',
      zIndex: '9999',
      opacity: '0',
      transition: 'transform 0.9s cubic-bezier(0.2, 0.7, 0.2, 1), opacity 0.9s ease-out',
      willChange: 'transform, opacity',
      whiteSpace: 'nowrap'
    });
    document.body.appendChild(pop);
    requestAnimationFrame(() => {
      pop.style.transform = 'translate(-50%, calc(-50% - 60px)) scale(1.1)';
      pop.style.opacity = '1';
      setTimeout(() => { pop.style.opacity = '0'; }, 500);
    });
    setTimeout(() => pop.remove(), 1000);
  }

  function handleInsulin(e: MouseEvent) {
    if ($gameStatus !== 'playing') return;
    const bonus = secreteInsulin();
    showScorePopup(e.clientX, e.clientY, bonus);
  }

  function handleGlucagon(e: MouseEvent) {
    if ($gameStatus !== 'playing') return;
    const bonus = secreteGlucagon();
    showScorePopup(e.clientX, e.clientY, bonus);
  }

  interface Particle {
    id: number;
    progress: number;
    speed: number;
    type: 'glucose' | 'insulin' | 'glucagon';
    offset: number;
  }

  let particles = $state<Particle[]>([]);
  let nextId = 0;

  const WIDTH = 650;
  const HEIGHT = 650;
  const LOOP_X = 100;
  const LOOP_Y = 205; 
  const LOOP_WIDTH = 400;
  const LOOP_HEIGHT = 200;
  const ARC_R = 40;

  const targetGlucoseCount = $derived(Math.min(Math.floor($bloodSugar / 3), 120));
  const targetInsulinCount = $derived(Math.min(Math.floor($insulinLevel * 0.5), 12));
  const targetGlucagonCount = $derived(Math.min(Math.floor($glucagonLevel * 0.5), 12));

  function createParticle(type: 'glucose' | 'insulin' | 'glucagon'): Particle {
    return {
      id: nextId++,
      progress: Math.random(),
      speed: (Math.random() * 0.0015) + 0.001,
      type,
      offset: (Math.random() - 0.5) * 24
    };
  }

  function syncParticles(current: Particle[], target: number, type: 'glucose' | 'insulin' | 'glucagon') {
    const typed = current.filter(p => p.type === type);
    if (typed.length < target) {
      for (let i = 0; i < target - typed.length; i++) {
        particles.push(createParticle(type));
      }
    } else if (typed.length > target) {
      let removed = 0;
      const toRemove = typed.length - target;
      for (let i = 0; i < particles.length && removed < toRemove; i++) {
        if (particles[i].type === type) {
          particles.splice(i, 1);
          i--;
          removed++;
        }
      }
    }
  }

  $effect(() => { syncParticles(particles, targetGlucoseCount, 'glucose'); });
  $effect(() => { syncParticles(particles, targetInsulinCount, 'insulin'); });
  $effect(() => { syncParticles(particles, targetGlucagonCount, 'glucagon'); });

  function getPosition(progress: number, offset: number) {
    let p = progress % 1;
    const straightW = LOOP_WIDTH - ARC_R * 2;
    const straightH = LOOP_HEIGHT - ARC_R * 2;
    const arcL = (Math.PI * ARC_R) / 2;
    const totalL = (straightW * 2) + (straightH * 2) + (arcL * 4);

    const s1 = straightW / totalL;
    const a1 = (straightW + arcL) / totalL;
    const s2 = (straightW + arcL + straightH) / totalL;
    const a2 = (straightW + arcL * 2 + straightH) / totalL;
    const s3 = (straightW * 2 + arcL * 2 + straightH) / totalL;
    const a3 = (straightW * 2 + arcL * 3 + straightH) / totalL;
    const s4 = (straightW * 2 + arcL * 3 + straightH * 2) / totalL;

    if (p < s1) { return { x: LOOP_X + ARC_R + (p/s1)*straightW, y: LOOP_Y + offset }; }
    else if (p < a1) {
      const t = (p-s1)/(a1-s1);
      const angle = (t-1) * Math.PI/2;
      return { x: LOOP_X + LOOP_WIDTH - ARC_R + Math.cos(angle)*(ARC_R+offset), y: LOOP_Y + ARC_R + Math.sin(angle)*(ARC_R+offset) };
    } else if (p < s2) { return { x: LOOP_X + LOOP_WIDTH + offset, y: LOOP_Y + ARC_R + ((p-a1)/(s2-a1))*straightH }; }
    else if (p < a2) {
      const t = (p-s2)/(a2-s2);
      const angle = t * Math.PI/2;
      return { x: LOOP_X + LOOP_WIDTH - ARC_R + Math.cos(angle)*(ARC_R+offset), y: LOOP_Y + LOOP_HEIGHT - ARC_R + Math.sin(angle)*(ARC_R+offset) };
    } else if (p < s3) { return { x: LOOP_X + LOOP_WIDTH - ARC_R - ((p-a2)/(s3-a2))*straightW, y: LOOP_Y + LOOP_HEIGHT - offset }; }
    else if (p < a3) {
      const t = (p-s3)/(a3-s3);
      const angle = (t+1) * Math.PI/2;
      return { x: LOOP_X + ARC_R + Math.cos(angle)*(ARC_R+offset), y: LOOP_Y + LOOP_HEIGHT - ARC_R + Math.sin(angle)*(ARC_R+offset) };
    } else if (p < s4) { return { x: LOOP_X - offset, y: LOOP_Y + LOOP_HEIGHT - ARC_R - ((p-a3)/(s4-a3))*straightH }; }
    else {
      const t = (p-s4)/(1-s4);
      const angle = (t+2) * Math.PI/2;
      return { x: LOOP_X + ARC_R + Math.cos(angle)*(ARC_R+offset), y: LOOP_Y + ARC_R + Math.sin(angle)*(ARC_R+offset) };
    }
  }

  let animationFrame: number;
  function animate() {
    for (let p of particles) { p.progress += p.speed; }
    animationFrame = requestAnimationFrame(animate);
  }

  onMount(() => {
    animationFrame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animationFrame);
  });

  const BS_MIN = 40;
  const BS_MAX = 250;
  const BAR_H = 120;
  const NORMAL_LOW = 70;
  const NORMAL_HIGH = 140;
  const yFromValue = (v: number) => BAR_H - ((v - BS_MIN) / (BS_MAX - BS_MIN)) * BAR_H;
  const Y_NORMAL_TOP = yFromValue(NORMAL_HIGH);
  const Y_NORMAL_BOTTOM = yFromValue(NORMAL_LOW);

  const statusLabel = $derived($bloodSugar < NORMAL_LOW ? 'LOW' : ($bloodSugar > NORMAL_HIGH ? 'HIGH' : 'GOOD'));
  const statusColor = $derived(($bloodSugar < NORMAL_LOW || $bloodSugar > NORMAL_HIGH) ? '#ef4444' : '#166534');
  const barH = $derived(Math.min(BAR_H, Math.max(0, (($bloodSugar - BS_MIN) / (BS_MAX - BS_MIN)) * BAR_H)));
</script>

<div class="simulation-container">
  <svg viewBox="40 55 600 500" class="svg-canvas" preserveAspectRatio="xMidYMid meet">
    <defs>
      <filter id="glow"><feGaussianBlur stdDeviation="1" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
    </defs>

    <!-- 0. Organ connector vessels (최하단 Z - 장기/주 혈관이 덮음) -->
    {#each [
      { x: 165, y1: 140, y2: 187.5 },
      { x: 255, y1: 140, y2: 187.5 },
      { x: 345, y1: 140, y2: 187.5 },
      { x: 435, y1: 140, y2: 187.5 }
    ] as c}
      <line x1={c.x} y1={c.y1} x2={c.x} y2={c.y2} stroke="#ef4444" stroke-width="12" stroke-opacity="0.15" stroke-linecap="butt" />
    {/each}
    <!-- 이자 연결 혈관 -->
    <line x1="300" y1="422.5" x2="300" y2="485" stroke="#ef4444" stroke-width="12" stroke-opacity="0.15" stroke-linecap="butt" />

    <!-- 1. Blood Vessel Loop (Base layer) -->
    <rect x={LOOP_X} y={LOOP_Y} width={LOOP_WIDTH} height={LOOP_HEIGHT} rx={ARC_R} fill="none" stroke="#ef4444" stroke-width="35" stroke-opacity="0.15" />

    <!-- 2. Particles (Middle layer - flows BEHIND organs) -->
    {#each particles as p (p.id)}
      {@const pos = getPosition(p.progress, p.offset)}
      <circle cx={pos.x} cy={pos.y} r={p.type === 'glucose' ? 3 : 4.5} fill={p.type === 'glucose' ? '#a855f7' : (p.type === 'insulin' ? '#2563eb' : '#f97316')} filter="url(#glow)" opacity="0.9" />
    {/each}

    <!-- 3. Organs (Top layer) -->
    <g class="organ-group" transform="translate(0, 85)">
      <g transform="translate(125, 0)">
        <text x="40" y="5" text-anchor="middle" font-weight="900" font-size="17" fill="#0d2b55">뇌</text>
        <image href="/blood-sugar/brain.svg" width="80" height="80" y="15" />
      </g>
      <g transform="translate(215, 0)">
        <text x="40" y="5" text-anchor="middle" font-weight="900" font-size="17" fill="#0d2b55">근육</text>
        <image href="/blood-sugar/muscle.svg" width="80" height="80" y="15" />
      </g>
      <g transform="translate(305, 0)">
        <text x="40" y="5" text-anchor="middle" font-weight="900" font-size="17" fill="#0d2b55">간</text>
        <image href="/blood-sugar/liver.svg" width="80" height="80" y="15" />
      </g>
      <g transform="translate(395, 0)">
        <text x="40" y="5" text-anchor="middle" font-weight="900" font-size="17" fill="#0d2b55">지방 세포</text>
        <image href="/blood-sugar/fat-tissue.svg" width="80" height="80" y="15" />
      </g>
    </g>

    <g transform="translate({LOOP_X}, {LOOP_Y + LOOP_HEIGHT/2})">
      <image href="/blood-sugar/heart.svg" width="91" height="91" x="-45.5" y="-45.5" />
      <text x="35" y="8" text-anchor="start" font-weight="900" font-size="17" fill="#0d2b55">심장</text>
    </g>
    <g transform="translate({LOOP_X + LOOP_WIDTH}, {LOOP_Y + LOOP_HEIGHT/2})">
      <image href="/blood-sugar/small-intestine.svg" width="77" height="77" x="-38.5" y="-38.5" />
      <text x="-45" y="8" text-anchor="end" font-weight="900" font-size="17" fill="#0d2b55">소장</text>
    </g>
    <g transform="translate(590, {LOOP_Y + LOOP_HEIGHT/2})" data-mouth-target>
      <image href="/blood-sugar/mouth.svg" width="85" height="85" x="-42.5" y="-42.5" />
      <text y="60" text-anchor="middle" font-weight="900" font-size="17" fill="#0d2b55">입</text>
    </g>

    <g transform="translate(245, {LOOP_Y + 40})">
      <rect width="25" height={BAR_H} fill="#f1f5f9" stroke="#e2e8f0" stroke-width="1" />
      <rect y="0" width="25" height={Y_NORMAL_TOP} fill="#ef4444" opacity="0.65" />
      <rect y={Y_NORMAL_TOP} width="25" height={Y_NORMAL_BOTTOM - Y_NORMAL_TOP} fill="#86efac" opacity="0.75" />
      <rect y={Y_NORMAL_BOTTOM} width="25" height={BAR_H - Y_NORMAL_BOTTOM} fill="#ef4444" opacity="0.65" />

      <!-- 현재 혈당량 바늘 인디케이터 -->
      <g transform="translate(0, {BAR_H - barH})" style="transition: transform 0.3s ease-out;">
        <line x1="-6" y1="0" x2="31" y2="0" stroke="#0d2b55" stroke-width="2.2" stroke-linecap="round" />
        <polygon points="-12,-5 -4,0 -12,5" fill="#0d2b55" />
        <polygon points="37,-5 29,0 37,5" fill="#0d2b55" />
      </g>
      <text x="40" y="30" font-size="28" font-weight="900" fill={statusColor}>{statusLabel}</text>
      <text x="40" y="65" font-size="38" font-weight="900" fill={statusColor}>{Math.round($bloodSugar)}</text>
      <text x="40" y="85" font-size="11" font-weight="700" fill="#64748b">혈당량 수치 mg/dL</text>
    </g>

    <g transform="translate(300, 480)">
      <image href="/blood-sugar/pancreas.svg" width="120" height="72" x="-60" y="-36" />
      <text y="50" text-anchor="middle" font-weight="900" font-size="18" fill="#0d2b55">이자</text>
      <g transform="translate(-173, -18)" class="hormone-btn" class:active={$insulinLevel > 0} class:insulin={true} class:disabled={$gameStatus !== 'playing'} onclick={handleInsulin} role="button" tabindex="0">
        <rect width="99" height="36" rx="18" fill={$insulinLevel > 0 ? '#2563eb' : '#dbeafe'} stroke="#2563eb" stroke-width="1.5" />
        <text x="49.5" y="23" text-anchor="middle" fill={$insulinLevel > 0 ? 'white' : '#2563eb'} font-size="15" font-weight="bold">인슐린</text>
      </g>
      <g transform="translate(74, -18)" class="hormone-btn" class:active={$glucagonLevel > 0} class:glucagon={true} class:disabled={$gameStatus !== 'playing'} onclick={handleGlucagon} role="button" tabindex="0">
        <rect width="99" height="36" rx="18" fill={$glucagonLevel > 0 ? '#f97316' : '#ffedd5'} stroke="#f97316" stroke-width="1.5" />
        <text x="49.5" y="23" text-anchor="middle" fill={$glucagonLevel > 0 ? 'white' : '#c2410c'} font-size="15" font-weight="bold">글루카곤</text>
      </g>
    </g>
  </svg>
</div>

<style>
  .simulation-container {
    background: #ffffff;
    border-radius: 24px;
    width: 100%;
    height: 100%;
    max-width: 100%;
    margin: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
    padding: 4px;
  }
  .svg-canvas { width: 100%; height: 100%; display: block; }

  .hormone-btn { cursor: pointer; }
  .hormone-btn rect { transition: fill 0.2s ease, filter 0.2s ease; }
  .hormone-btn text { transition: fill 0.2s ease; }
  .hormone-btn:hover rect { filter: drop-shadow(0 4px 10px rgba(13, 43, 85, 0.3)); }
  .hormone-btn:active rect { filter: brightness(0.9); }
  .hormone-btn.disabled { cursor: not-allowed; opacity: 0.5; pointer-events: none; }
  .hormone-btn.insulin:hover rect { fill: #2563eb; }
  .hormone-btn.insulin:hover text { fill: white; }
  .hormone-btn.glucagon:hover rect { fill: #f97316; }
  .hormone-btn.glucagon:hover text { fill: white; }
</style>
