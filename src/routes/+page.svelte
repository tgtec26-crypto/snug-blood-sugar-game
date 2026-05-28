<script lang="ts">
  import { onMount } from 'svelte';
  import { fade } from 'svelte/transition';
  import { gameStatus, score, gameTime, startGameLoop, stopGameLoop, comboStreak, comboMultiplier, lastMilestone, bloodSugar, bloodSugarHistory } from '$lib/stores/game';
  import HumanBody from '$lib/components/HumanBody.svelte';
  import ActionPanel from '$lib/components/ActionPanel.svelte';
  import { fly } from 'svelte/transition';
  import { toPng } from 'html-to-image';

  let modalEl = $state<HTMLDivElement | null>(null);
  let capturing = $state(false);

  async function takeScreenshot() {
    if (!modalEl || capturing) return;
    capturing = true;
    try {
      const dataUrl = await toPng(modalEl, { pixelRatio: 2, backgroundColor: '#ffffff' });
      const link = document.createElement('a');
      const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      link.download = `혈당량조절-결과-${ts}.png`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error('screenshot failed', err);
      alert('스크린샷 저장에 실패했습니다.');
    } finally {
      capturing = false;
    }
  }

  function formatMin(mins: number) {
    const t = mins % 1440;
    return `${Math.floor(t/60).toString().padStart(2,'0')}:${(t%60).toString().padStart(2,'0')}`;
  }

  const CHART_W = 520;
  const CHART_H = 220;
  const PAD_L = 12;
  const PAD_R = 12;
  const PAD_T = 12;
  const PAD_B = 12;
  const Y_MIN = 0;
  const Y_MAX = 360;

  const chart = $derived.by(() => {
    const hist = $bloodSugarHistory;
    if (hist.length < 2) return { path: '', normalBand: '', points: [], xTicks: [], yTicks: [], startTime: 540, endTime: 540 };
    const startTime = hist[0].time;
    const endTime = hist[hist.length - 1].time;
    const span = Math.max(1, endTime - startTime);
    const innerW = CHART_W - PAD_L - PAD_R;
    const innerH = CHART_H - PAD_T - PAD_B;
    const xOf = (t: number) => PAD_L + ((t - startTime) / span) * innerW;
    const yOf = (v: number) => PAD_T + innerH - ((v - Y_MIN) / (Y_MAX - Y_MIN)) * innerH;

    const path = hist.map((p, i) => `${i === 0 ? 'M' : 'L'}${xOf(p.time).toFixed(1)},${yOf(p.value).toFixed(1)}`).join(' ');
    const normalTop = yOf(140);
    const normalBottom = yOf(80);
    const normalBand = `M${PAD_L},${normalTop} L${PAD_L + innerW},${normalTop} L${PAD_L + innerW},${normalBottom} L${PAD_L},${normalBottom} Z`;

    const yTicks = [0, 80, 140, 250, 350].map(v => ({ v, y: yOf(v) }));
    const xTickCount = 6;
    const xTicks = Array.from({ length: xTickCount + 1 }, (_, i) => {
      const t = startTime + (span * i) / xTickCount;
      return { t, x: xOf(t) };
    });
    return { path, normalBand, xTicks, yTicks, startTime, endTime };
  });

  const isCompleted = $derived($gameTime >= 1980);

  let isNormalRange = $derived($bloodSugar >= 80 && $bloodSugar <= 140);
  let perTickScore = $derived.by(() => {
    if (isNormalRange) return Math.round(100 * $comboMultiplier);
    if ($bloodSugar < 80) return -Math.round((80 - $bloodSugar) * 3);
    if ($bloodSugar > 140) return -Math.round(($bloodSugar - 140) * 3);
    return 0;
  });

  let showMilestone = $state<{ streak: number; bonus: number } | null>(null);
  let milestoneTimer: ReturnType<typeof setTimeout>;
  $effect(() => {
    const m = $lastMilestone;
    if (!m) return;
    showMilestone = { streak: m.streak, bonus: m.bonus };
    if (milestoneTimer) clearTimeout(milestoneTimer);
    milestoneTimer = setTimeout(() => { showMilestone = null; }, 2200);
  });

  function goBack() { window.location.href = 'https://snug-online-office.vercel.app/smart'; }

  let isFullscreen = $state(false);
  let viewportH = $state<number>(1000);
  let viewportW = $state<number>(1920);
  const isCompact = $derived(viewportH <= 520);
  const isLandscapeCompact = $derived(isCompact && viewportW >= viewportH);

  function toggleFullscreen() {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen();
    }
  }

  const formattedTime = $derived.by(() => {
    const t = $gameTime % 1440;
    return `${Math.floor(t/60).toString().padStart(2,'0')}:${(t%60).toString().padStart(2,'0')}`;
  });

  onMount(() => {
    stopGameLoop();
    const onFsChange = () => { isFullscreen = !!document.fullscreenElement; };
    const onResize = () => {
      viewportH = window.innerHeight;
      viewportW = window.innerWidth;
    };
    onResize();
    document.addEventListener('fullscreenchange', onFsChange);
    window.addEventListener('resize', onResize);
    return () => {
      stopGameLoop();
      document.removeEventListener('fullscreenchange', onFsChange);
      window.removeEventListener('resize', onResize);
    };
  });
</script>

<svelte:head>
  <title>혈당량 조절 시뮬레이션 | SNUG 지능형 수업실</title>
</svelte:head>

<div
  class="blood-sugar-page"
  class:playing={$gameStatus !== 'ready'}
  class:compact={isCompact}
  class:landscape-compact={isLandscapeCompact}
>
  {#if $gameStatus === 'ready'}
    <!-- READY STATE -->
    <header transition:fade>
      <div class="header-inner">
        <div class="header-text">
          <h1><span class="highlight">SNUG</span> 혈당량 조절 시뮬레이션</h1>
          <p class="header-desc">항상성 유지를 위한 우리 몸의 놀라운 상호작용</p>
        </div>
        <img src="/school-logo.svg" class="header-logo" alt="학교 로고" />
      </div>
    </header>

    <main>
      <div class="top-bar">
        <button onclick={goBack} class="back-link-btn">← 돌아가기</button>
        <button onclick={toggleFullscreen} class="fullscreen-btn" title="전체화면 토글">
          {isFullscreen ? '⛶ 전체화면 해제' : '⛶ 전체화면'}
        </button>
      </div>

      <div class="intro-section" transition:fade>
        <div class="intro-header">
          <h2 class="title">우리 몸의 혈당량 조절 원리</h2>
          <p class="desc">24시간 동안 우리 몸의 혈당량 변화를 관찰해 보세요.</p>
        </div>
        <div class="info-grid">
          <div class="info-card"><div class="emoji-box">🍱</div><strong>식단 조절</strong><span>음식에 따라 혈당량 속도가 달라요.</span></div>
          <div class="info-card"><div class="emoji-box">🏃</div><strong>신체 활동</strong><span>운동은 혈당량을 낮추는 핵심입니다.</span></div>
          <div class="info-card"><div class="emoji-box">⚖️</div><strong>항상성</strong><span>호르몬이 균형을 맞춥니다.</span></div>
        </div>
        <button onclick={startGameLoop} class="primary-btn large">시뮬레이션 시작하기</button>
      </div>
    </main>
  {:else}
    <!-- PLAYING STATE -->
    <main class="no-header">
      <div class="top-bar">
        <button onclick={stopGameLoop} class="back-link-btn">← 중단하고 돌아가기</button>
        <div class="game-info-chips">
          <div class="info-chip time">🕒 {formattedTime}</div>
          <div class="info-chip score">
            점수: {$score.toLocaleString()}
            <span class="tick-rate" class:plus={perTickScore > 0} class:minus={perTickScore < 0}>
              {perTickScore > 0 ? '+' : ''}{perTickScore}/틱
            </span>
          </div>
          {#if isNormalRange && $comboStreak > 0}
            <div class="info-chip combo" class:boost={$comboMultiplier > 1}>
              🔥 {$comboStreak}연속{#if $comboMultiplier > 1} · ×{$comboMultiplier}{/if}
            </div>
          {/if}
          <button onclick={toggleFullscreen} class="fullscreen-btn compact" title="전체화면 토글">
            {isFullscreen ? '⛶' : '⛶'}
          </button>
        </div>
      </div>

      <div class="game-layout">
        <div class="game-main">
          <HumanBody />
        </div>
        <div class="game-sidebar">
          <ActionPanel />
        </div>

        {#if showMilestone}
          <div class="milestone-popup" transition:fly={{ y: -20, duration: 300 }}>
            <div class="milestone-title">🎉 {showMilestone.streak}연속 달성!</div>
            <div class="milestone-bonus">+{showMilestone.bonus.toLocaleString()}점 보너스</div>
          </div>
        {/if}

        {#if $gameStatus === 'gameover'}
          <div class="modal-overlay" transition:fade>
            <div class="modal-content result" bind:this={modalEl}>
              <div class="result-header">
                <h3>{isCompleted ? '🏁 시뮬레이션 종료' : '📊 혈당량 변화 기록'}</h3>
              </div>

              <div class="chart-wrap">
                <svg viewBox="0 0 {CHART_W} {CHART_H}" class="chart-svg" xmlns="http://www.w3.org/2000/svg">
                  <!-- Normal range band -->
                  <path d={chart.normalBand} fill="#dcfce7" opacity="0.7" />

                  <!-- Y axis grid -->
                  {#each chart.yTicks as tk}
                    <line x1={PAD_L} y1={tk.y} x2={CHART_W - PAD_R} y2={tk.y} stroke="#e2e8f0" stroke-width="1" stroke-dasharray="3 3" />
                  {/each}

                  <!-- Axes -->
                  <line x1={PAD_L} y1={PAD_T} x2={PAD_L} y2={CHART_H - PAD_B} stroke="#94a3b8" stroke-width="1.2" />
                  <line x1={PAD_L} y1={CHART_H - PAD_B} x2={CHART_W - PAD_R} y2={CHART_H - PAD_B} stroke="#94a3b8" stroke-width="1.2" />

                  <!-- Line -->
                  <path d={chart.path} fill="none" stroke="#dc2626" stroke-width="4.4" stroke-linejoin="round" stroke-linecap="round" />
                </svg>
              </div>

              <div class="final-score">최종 점수: <strong>{$score.toLocaleString()}</strong></div>

              <div class="result-actions">
                <button onclick={startGameLoop} class="result-btn primary">다시 도전하기</button>
                <button onclick={takeScreenshot} class="result-btn secondary" disabled={capturing}>
                  {capturing ? '저장 중...' : '📸 스크린샷 찍기'}
                </button>
              </div>
            </div>
          </div>
        {/if}
      </div>
    </main>
  {/if}
</div>

<style>
  .blood-sugar-page { background-color: #f0f4f9; color: #0d2b55; height: 100vh; font-family: 'Noto Sans KR', sans-serif; display: flex; flex-direction: column; overflow: hidden; }
  .blood-sugar-page.playing { max-height: 100vh; overflow: hidden; }

  header { background: #13183D; color: white; padding: clamp(6px, 2.6vh, 22px) clamp(14px, 2vw, 24px); text-align: center; flex-shrink: 0; display: flex; flex-direction: row; align-items: center; justify-content: center; min-height: 0; }
  .header-inner { margin: 0 auto; display: flex; align-items: center; justify-content: center; gap: clamp(10px, 2.4vw, 22px); }
  .header-text { display: flex; flex-direction: column; justify-content: center; align-items: center; line-height: 1; }
  .header-text h1 { font-size: clamp(20px, 7vh, 44px); font-weight: 900; margin: 0; letter-spacing: -0.5px; line-height: 1.1; }
  .header-desc { font-size: clamp(12px, 3vh, 20px); margin: clamp(2px, 0.6vh, 6px) 0 0; opacity: 0.9; line-height: 1.2; }
  .highlight { color: #9cff9e; }
  .header-logo { width: clamp(36px, 9vh, 70px); height: clamp(36px, 9vh, 70px); flex-shrink: 0; display: block; }

  main { max-width: 1200px; margin: 0 auto; padding: 8px 24px 12px; flex: 1; display: flex; flex-direction: column; width: 100%; min-height: 0; }
  main.no-header { padding-top: 40px; height: 100vh; }
  
  .top-bar { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; min-height: 40px; flex-shrink: 0; }
  .back-link-btn { background: #0d2b55; border: 1px solid #0d2b55; color: white; font-size: 14px; cursor: pointer; font-weight: 700; padding: 6px 16px; border-radius: 10px; transition: all 0.2s; }
  .back-link-btn:hover { background: #1a4480; transform: translateY(-1px); box-shadow: 0 4px 12px rgba(13, 43, 85, 0.25); }

  .fullscreen-btn { background: #0d2b55; border: 1px solid #0d2b55; color: white; font-size: 14px; cursor: pointer; font-weight: 700; padding: 6px 16px; border-radius: 10px; transition: all 0.2s; display: inline-flex; align-items: center; gap: 6px; }
  .fullscreen-btn:hover { background: #1a4480; transform: translateY(-1px); box-shadow: 0 4px 12px rgba(13, 43, 85, 0.25); }
  .fullscreen-btn.compact { padding: 6px 12px; font-size: 16px; }
  
  .game-info-chips { display: flex; gap: 12px; align-items: center; }
  .info-chip { 
    background: white; 
    padding: 8px 16px; 
    border-radius: 14px; 
    font-size: 16px; 
    font-weight: 800; 
    color: #0d2b55; 
    display: flex; 
    align-items: center; 
    gap: 8px; 
    box-shadow: 0 4px 12px rgba(13, 43, 85, 0.08);
    border: 1.5px solid #e2e8f0;
  }
  .info-chip.time { border-left: 4px solid #3b82f6; color: #1e40af; }
  .info-chip.score { border-left: 4px solid #22c55e; color: #166534; }
  .info-chip.combo { border-left: 4px solid #f97316; color: #c2410c; background: #fff7ed; }
  .info-chip.combo.boost {
    background: linear-gradient(90deg, #f97316, #ef4444);
    color: white;
    border-left-color: transparent;
    box-shadow: 0 4px 14px rgba(249, 115, 22, 0.35);
  }

  .tick-rate {
    margin-left: 6px;
    padding: 2px 8px;
    border-radius: 999px;
    font-size: 11px;
    font-weight: 900;
    background: #f1f5f9;
    color: #64748b;
  }
  .tick-rate.plus { background: #dcfce7; color: #166534; }
  .tick-rate.minus { background: #fee2e2; color: #b91c1c; }

  .milestone-popup {
    position: absolute;
    top: 24px;
    left: 50%;
    transform: translateX(-50%);
    background: linear-gradient(135deg, #f59e0b, #ef4444);
    color: white;
    padding: 16px 28px;
    border-radius: 20px;
    box-shadow: 0 14px 36px rgba(239, 68, 68, 0.4);
    z-index: 50;
    text-align: center;
    pointer-events: none;
  }
  .milestone-title { font-size: 20px; font-weight: 900; letter-spacing: -0.5px; }
  .milestone-bonus { font-size: 15px; font-weight: 800; margin-top: 4px; opacity: 0.95; }
  .intro-section { background: white; border-radius: 24px; padding: 36px 40px; text-align: center; box-shadow: 0 4px 20px rgba(13, 43, 85, 0.05); flex: 1; min-height: 0; display: flex; flex-direction: column; justify-content: space-evenly; gap: 20px; border: 1.5px solid #e2e8f0; }
  .intro-header { display: flex; flex-direction: column; align-items: center; gap: 4px; }
  .title { font-size: 50px; font-weight: 900; margin: 0; color: #0d2b55; letter-spacing: -1.5px; line-height: 1.15; }
  .desc { color: #4a6a8f; margin: 0; line-height: 1.4; font-size: 17px; font-weight: 500; }

  .info-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 18px; max-width: 1000px; margin: 0 auto; width: 100%; }
  .info-card { background: #f8fafc; padding: 24px 18px; border-radius: 20px; display: flex; flex-direction: column; align-items: center; gap: 8px; border: 1.5px solid #e2e8f0; transition: transform 0.2s; }
  .info-card:hover { transform: translateY(-4px); background: #f1f5f9; }
  .emoji-box { font-size: 52px !important; line-height: 1; }
  .info-card strong { font-size: 20px; color: #0d2b55; font-weight: 800; }
  .info-card span { font-size: 14px; color: #64748b; line-height: 1.4; word-break: keep-all; font-weight: 500; }

  .primary-btn { background: #0d2b55; color: white; border: none; padding: 14px 40px; border-radius: 14px; font-size: 18px; font-weight: 800; cursor: pointer; transition: all 0.2s; width: fit-content; margin: 0 auto; display: block; flex-shrink: 0; box-shadow: 0 4px 12px rgba(13, 43, 85, 0.2); }
  .primary-btn.large { padding: 16px 56px; font-size: 19px; min-width: 340px; letter-spacing: -0.5px; }
  .primary-btn:hover { background: #1a4480; transform: translateY(-2px); box-shadow: 0 8px 20px rgba(13, 43, 85, 0.3); }

  main.no-header { padding: 8px 20px; height: 100vh; max-height: 100vh; overflow: hidden; display: flex; flex-direction: column; }

  .game-layout { 
    display: grid; 
    grid-template-columns: 1fr 340px; 
    gap: 12px; 
    align-items: stretch; 
    flex-grow: 1; 
    min-height: 0; 
    width: 100%; 
  }
  .game-main { 
    min-width: 0;
    display: flex; 
    align-items: center; 
    justify-content: center; 
    background: white; 
    border-radius: 24px; 
    border: 1.5px solid #e2e8f0; 
    position: relative; 
    overflow: hidden;
    height: 100%;
  }
  .game-sidebar { 
    display: flex; 
    flex-direction: column; 
    min-height: 0; 
    height: 100%;
  }

  /* 스크롤바 디자인 */
  .game-sidebar::-webkit-scrollbar { width: 6px; }
  .game-sidebar::-webkit-scrollbar-track { background: transparent; }
  .game-sidebar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 10px; }
  .game-sidebar::-webkit-scrollbar-thumb:hover { background: #94a3b8; }

  .modal-overlay { position: absolute; inset: 0; background: rgba(13, 43, 85, 0.6); backdrop-filter: blur(4px); display: flex; align-items: center; justify-content: center; z-index: 100; border-radius: 24px; }
  .modal-content { background: white; padding: 32px; border-radius: 28px; text-align: center; max-width: 380px; width: 90%; box-shadow: 0 20px 40px rgba(0,0,0,0.2); }
  .modal-content.result { max-width: 620px; padding: 24px 28px; }
  .modal-content h3 { font-size: 22px; font-weight: 900; margin-bottom: 8px; }
  .result-header { margin-bottom: 12px; }
  .result-header h3 { color: #0d2b55; }
  .chart-wrap { background: #f8fafc; border: 1.5px solid #e2e8f0; border-radius: 16px; padding: 8px; margin-bottom: 16px; }
  .chart-svg { width: 100%; height: auto; display: block; }
  .final-score { background: #f0f4f9; padding: 14px; border-radius: 12px; margin-bottom: 16px; }
  .final-score strong { color: #0d2b55; font-size: 22px; }
  .result-actions {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
    max-width: 480px;
    margin: 0 auto;
  }
  .result-btn {
    padding: 14px 20px;
    border-radius: 14px;
    font-size: 16px;
    font-weight: 800;
    cursor: pointer;
    transition: all 0.2s;
    width: 100%;
    letter-spacing: -0.3px;
  }
  .result-btn.primary {
    background: #0d2b55;
    color: white;
    border: 1.5px solid #0d2b55;
    box-shadow: 0 4px 12px rgba(13, 43, 85, 0.2);
  }
  .result-btn.primary:hover { background: #1a4480; transform: translateY(-2px); box-shadow: 0 8px 20px rgba(13, 43, 85, 0.3); }
  .result-btn.secondary {
    background: white;
    color: #0d2b55;
    border: 1.5px solid #0d2b55;
  }
  .result-btn.secondary:hover:not(:disabled) { background: #0d2b55; color: white; transform: translateY(-2px); box-shadow: 0 6px 14px rgba(13, 43, 85, 0.25); }
  .result-btn.secondary:disabled { opacity: 0.6; cursor: wait; }

  /* 고해상도/대화면 최적화 */
  @media (min-width: 1600px) {
    main { max-width: 1400px; }
    .game-layout { grid-template-columns: 1fr 450px; gap: 24px; }
  }

  /* 중간 해상도 최적화 (일반적인 노트북) */
  @media (max-width: 1280px) {
    .game-layout { grid-template-columns: 1fr 340px; gap: 12px; }
    .title { font-size: 44px; }
    .intro-section { padding: 30px; }
  }

  /* 세로 높이가 낮은 화면 (보조 모니터 1280x720 등) - 헤더는 clamp()로 자동 스케일 */
  @media (max-height: 760px) {
    main { padding: 6px 20px 10px; }
    .top-bar { margin-bottom: 8px; min-height: 34px; }
    .intro-section { padding: 20px 28px; border-radius: 20px; gap: 14px; }
    .title { font-size: 32px; letter-spacing: -1px; }
    .desc { font-size: 14px; }
    .info-grid { gap: 12px; }
    .info-card { padding: 14px 12px; border-radius: 16px; gap: 4px; }
    .emoji-box { font-size: 36px !important; }
    .info-card strong { font-size: 16px; }
    .info-card span { font-size: 12px; }
    .primary-btn.large { padding: 12px 44px; font-size: 17px; min-width: 300px; }
  }

  /* 태블릿/모바일 세로 모드 - 단일 컬럼 + 스크롤 허용 */
  @media (max-width: 1024px) and (orientation: portrait) {
    .game-layout { grid-template-columns: 1fr; grid-template-rows: auto 1fr; overflow-y: auto; }
    .game-main { aspect-ratio: auto; height: 500px; max-height: none; }
    .game-sidebar { height: auto; overflow: visible; }
    .blood-sugar-page.playing { max-height: none; overflow-y: auto; }
    main.no-header { height: auto; max-height: none; overflow: visible; }
  }

  /* 가로형 짧은 화면(800x400 등) - 2컬럼 유지 + 사이드바 축소 + 본문 압축 */
  @media (max-width: 1024px) and (orientation: landscape) {
    .game-layout { grid-template-columns: 1fr 220px; gap: 8px; }
    main.no-header { padding: 4px 10px; }
    .top-bar { margin-bottom: 4px; min-height: 28px; }
    .back-link-btn { font-size: 12px; padding: 4px 10px; border-radius: 8px; }
    .fullscreen-btn { font-size: 12px; padding: 4px 8px; border-radius: 8px; }
    .fullscreen-btn.compact { padding: 4px 8px; font-size: 13px; }
    .game-info-chips { gap: 6px; }
    .info-chip { padding: 4px 10px; font-size: 12px; border-radius: 10px; gap: 4px; }
    .info-chip.combo { padding: 4px 8px; }
    .tick-rate { font-size: 10px; padding: 1px 6px; }
    .game-main { border-radius: 14px; }
    .game-sidebar { gap: 6px; }

    /* 사이드바(ActionPanel) 내부 압축 - 라벨 잘림 방지 */
    .game-sidebar :global(.action-card) { padding: 6px 8px; border-radius: 12px; }
    .game-sidebar :global(.section-label) { font-size: 11px; margin: 2px 0; padding-bottom: 2px; }
    .game-sidebar :global(.main-content-wrapper) { gap: 4px; }
    .game-sidebar :global(.action-list) { gap: 3px; }
    .game-sidebar :global(.action-item) { padding: 3px 6px; gap: 6px; border-radius: 8px; }
    .game-sidebar :global(.icon-btn) { width: 26px; height: 26px; min-width: 26px; font-size: 13px; border-radius: 6px; }
    .game-sidebar :global(.label) { font-size: 10.5px; }
    .game-sidebar :global(.night-banner) { padding: 3px 6px; font-size: 9.5px; border-radius: 6px; }
    .game-sidebar :global(.active-badge) { padding: 3px 8px; font-size: 10px; }
    .game-sidebar :global(.bonus-chip) { padding: 1px 5px; font-size: 9.5px; }

    /* 결과 모달 압축 - 400px 높이에 들어가도록 */
    .modal-content.result {
      max-width: 92vw;
      max-height: 94vh;
      padding: 10px 14px;
      border-radius: 14px;
    }
    .result-header { margin-bottom: 4px; }
    .modal-content h3 { font-size: 15px; margin-bottom: 2px; }
    .chart-wrap { padding: 4px; margin-bottom: 6px; max-height: 180px; display: flex; align-items: center; justify-content: center; }
    .chart-svg { width: auto; max-width: 100%; max-height: 170px; }
    .final-score { padding: 6px 10px; margin-bottom: 6px; font-size: 12px; border-radius: 8px; }
    .final-score strong { font-size: 16px; }
    .result-actions { gap: 8px; max-width: none; }
    .result-btn { padding: 7px 12px; font-size: 12px; border-radius: 9px; }

    /* 마일스톤 팝업 압축 */
    .milestone-popup { padding: 8px 16px; border-radius: 12px; top: 12px; }
    .milestone-title { font-size: 13px; }
    .milestone-bonus { font-size: 11px; margin-top: 2px; }
  }

  @media (max-width: 640px) {
    .title { font-size: 32px; letter-spacing: -1px; }
    .info-grid { grid-template-columns: 1fr; }
    .intro-section { padding: 24px 20px; }
    .header-inner { flex-direction: column; text-align: center; }
    .header-text h1 { font-size: 24px; }
    .header-logo { display: none; }
  }

  /* 스마트폰 가로 모드 전용 (짧은 세로 높이) - JS 측정 기반
     주의: height/flex 기본 레이아웃은 base 규칙(height: 100vh, intro-section flex: 1)을
     유지해야 흰 박스가 화면 전체를 채운다. 여기선 본문 압축만 담당. */
  .blood-sugar-page.compact main { padding: 4px 14px 8px; }
  .blood-sugar-page.compact main.no-header { padding: 4px 14px; height: 100vh; }
  .blood-sugar-page.compact .top-bar { margin-bottom: 4px; min-height: 28px; }
  .blood-sugar-page.compact .back-link-btn,
  .blood-sugar-page.compact .fullscreen-btn { font-size: 12px; padding: 4px 10px; border-radius: 8px; }
  .blood-sugar-page.compact .intro-section { padding: 12px 14px; border-radius: 14px; gap: 8px; }
  .blood-sugar-page.compact .intro-header { gap: 2px; }
  .blood-sugar-page.compact .title { font-size: 20px; letter-spacing: -0.5px; line-height: 1.1; }
  .blood-sugar-page.compact .desc { font-size: 11px; }
  .blood-sugar-page.compact .info-grid { gap: 8px; max-width: 100%; }
  .blood-sugar-page.compact .info-card { padding: 16px 8px; border-radius: 12px; gap: 4px; }
  .blood-sugar-page.compact .emoji-box { font-size: 28px !important; }
  .blood-sugar-page.compact .info-card strong { font-size: 13px; }
  .blood-sugar-page.compact .info-card span { font-size: 11px; line-height: 1.25; }
  .blood-sugar-page.compact .primary-btn.large { padding: 8px 28px; font-size: 13px; min-width: 180px; border-radius: 10px; }

  /* 짧은 세로 높이용 보조 - 헤더는 clamp() 자동 처리, 본문만 추가 압축 */
  @media (max-height: 500px) {
    .blood-sugar-page main { padding: 4px 14px 6px; }
    .blood-sugar-page .top-bar { margin-bottom: 4px; min-height: 28px; }
    .blood-sugar-page .back-link-btn,
    .blood-sugar-page .fullscreen-btn { font-size: 12px; padding: 4px 10px; border-radius: 8px; }
    .blood-sugar-page .intro-section { padding: 12px 14px; border-radius: 14px; gap: 8px; }
    .blood-sugar-page .intro-header { gap: 2px; }
    .blood-sugar-page .title { font-size: 20px; letter-spacing: -0.5px; line-height: 1.1; }
    .blood-sugar-page .desc { font-size: 11px; }
    .blood-sugar-page .info-grid { gap: 8px; max-width: 100%; }
    .blood-sugar-page .info-card { padding: 16px 8px; border-radius: 12px; gap: 4px; }
    .blood-sugar-page .emoji-box { font-size: 28px !important; }
    .blood-sugar-page .info-card strong { font-size: 13px; }
    .blood-sugar-page .info-card span { font-size: 11px; line-height: 1.25; }
    .blood-sugar-page .primary-btn.large { padding: 8px 28px; font-size: 13px; min-width: 180px; border-radius: 10px; }
  }
</style>
