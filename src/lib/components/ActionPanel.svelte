<script lang="ts">
  import { eatFood, exercise, gameStatus, gameTime } from '$lib/stores/game';
  import { fade } from 'svelte/transition';

  const isNight = $derived.by(() => {
    const hour = Math.floor(($gameTime % 1440) / 60);
    return hour >= 21 || hour < 9;
  });
  const actionsLocked = $derived($gameStatus !== 'playing' || isNight);

  const foods = [
    { id: 'maratang', label: '마라탕 & 꿔바로우', desc: '고당분 (지속시간 김)', icon: '🍜', handler: () => eatFood(120, 10) },
    { id: 'tanghulu', label: '딸기 탕후루', desc: '빠른 혈당량 상승', icon: '🍭', handler: () => eatFood(60, 3) },
    { id: 'energy', label: '편의점 에너지 드링크', desc: '카페인과 당분', icon: '🥤', handler: () => eatFood(40, 2) },
    { id: 'lunch', label: '균형 잡힌 학교 급식', desc: '건강한 표준 식단', icon: '🍱', handler: () => eatFood(30, 8) }
  ];

  const activities = [
    { id: 'reading', label: '도서관에서 독서', desc: '아주 적은 소비', icon: '📚', handler: () => exercise(10) },
    { id: 'walking', label: '공원 산책하기', desc: '완만한 감소', icon: '🚶', handler: () => exercise(30) },
    { id: 'running', label: '운동장 달리기', desc: '빠른 감소', icon: '🏃', handler: () => exercise(60) },
    { id: 'dodgeball', label: '방과 후 피구 시합', desc: '대폭 감소', icon: '🏐', handler: () => exercise(100) }
  ];

  let lastAction = $state<string | null>(null);
  let lastBonus = $state<number>(0);
  let timeout: ReturnType<typeof setTimeout>;

  function showScorePopup(e: MouseEvent, bonus: number) {
    const btn = e.currentTarget as HTMLElement;
    if (!btn) return;
    const rect = btn.getBoundingClientRect();

    const pop = document.createElement('div');
    pop.textContent = `+${bonus.toLocaleString()}점`;
    Object.assign(pop.style, {
      position: 'fixed',
      left: `${rect.left + rect.width / 2}px`,
      top: `${rect.top}px`,
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

  function flyIconToMouth(e: MouseEvent, icon: string) {
    const btn = e.currentTarget as HTMLElement;
    const mouth = document.querySelector('[data-mouth-target]') as SVGGElement | null;
    if (!btn || !mouth) return;

    const btnRect = btn.getBoundingClientRect();
    const mouthRect = mouth.getBoundingClientRect();

    const fly = document.createElement('div');
    fly.textContent = icon;
    Object.assign(fly.style, {
      position: 'fixed',
      left: `${btnRect.left + btnRect.width / 2}px`,
      top: `${btnRect.top + btnRect.height / 2}px`,
      transform: 'translate(-50%, -50%) scale(1)',
      fontSize: '32px',
      lineHeight: '1',
      pointerEvents: 'none',
      zIndex: '9999',
      opacity: '1',
      transition: 'transform 0.9s cubic-bezier(0.2, 0.7, 0.2, 1), opacity 0.9s ease-out',
      willChange: 'transform, opacity'
    });
    document.body.appendChild(fly);

    const dx = mouthRect.left + mouthRect.width / 2 - (btnRect.left + btnRect.width / 2);
    const dy = mouthRect.top + mouthRect.height / 2 - (btnRect.top + btnRect.height / 2);

    requestAnimationFrame(() => {
      fly.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) scale(1.4) rotate(-15deg)`;
      fly.style.opacity = '0';
    });

    setTimeout(() => fly.remove(), 1000);
  }

  function handleAction(item: {label: string, handler: () => number, icon: string}, e: MouseEvent, flyToMouth = false) {
    if (actionsLocked) return;
    if (flyToMouth) flyIconToMouth(e, item.icon);
    const bonus = item.handler();
    showScorePopup(e, bonus);
    lastAction = item.label;
    lastBonus = bonus;
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(() => { lastAction = null; lastBonus = 0; }, 4000);
  }
</script>

<div class="action-card">
  <!-- Feedback Area: Floating at top to avoid pushing content down -->
  <div class="feedback-area">
    {#if lastAction}
      <div class="active-badge" transition:fade>
        {lastAction} 반영 중!
        {#if lastBonus > 0}<span class="bonus-chip">+{lastBonus.toLocaleString()}점</span>{/if}
      </div>
    {/if}
  </div>

  <div class="main-content-wrapper">
    {#if isNight && $gameStatus === 'playing'}
      <div class="night-banner" transition:fade>
        🌙 밤에는 식사·활동을 할 수 없어요. 호르몬으로 혈당을 조절해 보세요.
      </div>
    {/if}

    <div class="section-label" class:dim={isNight}>🍽️ 식사 및 간식</div>
    <div class="action-list">
      {#each foods as food}
        <div class="action-item" class:locked={isNight}>
          <button
            onclick={(e) => handleAction(food, e, true)}
            disabled={actionsLocked}
            class="icon-btn food"
          >
            {food.icon}
          </button>
          <div class="label">{food.label}</div>
        </div>
      {/each}
    </div>

    <div class="section-label mt-4" class:dim={isNight}>🏃 신체 활동</div>
    <div class="action-list">
      {#each activities as act}
        <div class="action-item" class:locked={isNight}>
          <button
            onclick={(e) => handleAction(act, e, false)}
            disabled={actionsLocked}
            class="icon-btn activity"
          >
            {act.icon}
          </button>
          <div class="label">{act.label}</div>
        </div>
      {/each}
    </div>
  </div>
</div>

<style>
  .action-card {
    background: #fffbbd;
    padding: 12px 16px;
    border-radius: 20px;
    box-shadow: 0 8px 24px rgba(13, 43, 85, 0.05);
    border: 1.5px solid #fef08a;
    height: 100%;
    display: flex;
    flex-direction: column;
    position: relative;
    overflow: hidden;
  }

  .main-content-wrapper {
    display: flex;
    flex-direction: column;
    flex: 1;
    min-height: 0;
    gap: 8px;
  }

  .section-label {
    font-size: 15px;
    font-weight: 900;
    color: #0d2b55;
    margin: 4px 0 4px;
    padding-bottom: 4px;
    border-bottom: 1px solid rgba(13, 43, 85, 0.1);
    display: flex;
    align-items: center;
    gap: 4px;
    flex-shrink: 0;
  }

  .action-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
    flex: 1;
    min-height: 0;
  }

  .action-item {
    display: flex;
    align-items: center;
    gap: 12px;
    background: #ffffff;
    padding: 8px 14px;
    border-radius: 12px;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.02);
    border: 1px solid rgba(13, 43, 85, 0.05);
    flex: 1;
    min-height: 0;
  }

  .icon-btn {
    width: 44px;
    height: 44px;
    min-width: 44px;
    border-radius: 10px;
    border: none;
    background: #0d2b55;
    font-size: 22px;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    flex-shrink: 0;
    transition: opacity 0.2s, filter 0.2s;
  }
  .icon-btn:disabled {
    cursor: not-allowed;
    opacity: 0.4;
    filter: grayscale(0.6);
  }

  .action-item.locked { opacity: 0.55; background: #f1f5f9; }
  .action-item.locked .label { color: #64748b; }
  .section-label.dim { color: #64748b; }

  .night-banner {
    background: linear-gradient(135deg, #1e3a8a, #312e81);
    color: #fef9c3;
    padding: 8px 12px;
    border-radius: 10px;
    font-size: 12.5px;
    font-weight: 800;
    text-align: center;
    box-shadow: 0 4px 12px rgba(30, 58, 138, 0.25);
    letter-spacing: -0.3px;
    flex-shrink: 0;
  }

  .label {
    font-size: 15px;
    font-weight: 800;
    color: #0d2b55;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    flex: 1;
  }

  .mt-4 { margin-top: 4px; }

  .feedback-area {
    position: absolute;
    top: 8px;
    left: 50%;
    transform: translateX(-50%);
    z-index: 10;
    pointer-events: none;
  }

  .active-badge {
    background: #0d2b55;
    color: white;
    padding: 6px 14px;
    border-radius: 999px;
    font-size: 13px;
    font-weight: 800;
    white-space: nowrap;
    box-shadow: 0 6px 16px rgba(13, 43, 85, 0.25);
    display: inline-flex;
    align-items: center;
    gap: 8px;
  }

  .bonus-chip {
    background: #22c55e;
    color: white;
    padding: 2px 10px;
    border-radius: 999px;
    font-size: 12px;
    font-weight: 900;
    letter-spacing: -0.3px;
  }

</style>
