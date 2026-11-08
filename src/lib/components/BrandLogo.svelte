<script lang="ts">
  import { onMount } from 'svelte';
  import { SvelteSet } from 'svelte/reactivity';
  import { resolve } from '$app/paths';
  import {
    birdPath,
    cardPath,
    wordmarkPath,
    symbolViewBox,
    wordmarkViewBox,
    eye,
  } from '#lib/brand/logo-y.ts';

  let link: HTMLAnchorElement | undefined;
  let character: HTMLSpanElement | undefined;
  let card: HTMLSpanElement | undefined;
  let eyeFollow: SVGGElement | undefined;
  let eyeBlink: SVGGElement | undefined;
  let reducedMotion: MediaQueryList | undefined;
  let hovered = false;
  let focused = false;
  let active = false;
  let state = $state('idle');
  let pointerFrame = 0;
  let pointer = { x: 0, y: 0 };
  let finishTimer: ReturnType<typeof setTimeout> | undefined;
  const animations = new SvelteSet<Animation>();

  function animate(
    target: Element | undefined,
    frames: Array<{ transform: string; offset?: number }>,
    duration: number,
    delay = 0,
    easing = 'cubic-bezier(0.22, 0.75, 0.25, 1)',
  ) {
    if (!target || reducedMotion?.matches) return;
    const animation = target.animate(
      frames.map((frame) => ({ ...frame, easing })),
      {
        duration,
        delay,
        easing: 'linear',
      },
    );
    animations.add(animation);
    animation.finished.then(
      () => animations.delete(animation),
      () => animations.delete(animation),
    );
  }

  function cancelAnimations() {
    clearTimeout(finishTimer);
    for (const animation of animations) animation.cancel();
    animations.clear();
  }

  function greet() {
    if (reducedMotion?.matches || !character?.isConnected) return;
    cancelAnimations();
    state = 'playing';
    animate(
      character,
      [
        { transform: 'none' },
        { transform: 'translateY(-1px) rotate(-4deg)', offset: 0.35 },
        { transform: 'none' },
      ],
      740,
    );
    animate(
      card,
      [
        { transform: 'none' },
        { transform: 'translate(3px, -1px) rotate(10deg)', offset: 0.4 },
        { transform: 'translate(1.3px, 0) rotate(-3deg)', offset: 0.73 },
        { transform: 'none' },
      ],
      820,
    );
    animate(
      eyeBlink,
      [
        { transform: 'scaleY(1)' },
        { transform: 'scaleY(0.12)', offset: 0.45 },
        { transform: 'scaleY(1)' },
      ],
      210,
      190,
      'ease-in-out',
    );
    finishTimer = setTimeout(() => {
      state = active ? 'watching' : 'idle';
    }, 860);
  }

  function settle() {
    const targets = [character, card].filter((target): target is HTMLSpanElement => !!target);
    const transforms = targets.map((target) => getComputedStyle(target).transform);
    cancelAnimations();
    targets.forEach((target, index) => {
      if (transforms[index] !== 'none')
        animate(
          target,
          [{ transform: transforms[index] }, { transform: 'none' }],
          150,
          0,
          'ease-out',
        );
    });
    if (eyeFollow) eyeFollow.style.transform = 'translate(0, 0)';
    state = 'idle';
  }

  function updateActive() {
    const next = hovered || focused;
    if (next === active) return;
    active = next;
    if (active) greet();
    else settle();
  }

  function enter(event: PointerEvent) {
    if (event.pointerType === 'touch') return;
    hovered = true;
    updateActive();
  }

  function leave() {
    hovered = false;
    updateActive();
  }
  function focus() {
    focused = true;
    updateActive();
  }
  function blur() {
    focused = false;
    updateActive();
  }

  function followPointer(event: PointerEvent) {
    if (!active || reducedMotion?.matches || event.pointerType === 'touch') return;
    pointer = { x: event.clientX, y: event.clientY };
    if (pointerFrame) return;
    pointerFrame = requestAnimationFrame(() => {
      pointerFrame = 0;
      if (!active || reducedMotion?.matches || !link || !eyeFollow) return;
      const rect = link.getBoundingClientRect();
      const x = Math.max(-1, Math.min(1, ((pointer.x - rect.left) / rect.width) * 2 - 1));
      const y = Math.max(-1, Math.min(1, ((pointer.y - rect.top) / rect.height) * 2 - 1));
      eyeFollow.style.transform = `translate(${x * 8}px, ${y * 7}px)`;
    });
  }

  onMount(() => {
    reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
    const stop = () => {
      cancelAnimations();
      cancelAnimationFrame(pointerFrame);
      pointerFrame = 0;
      if (eyeFollow) eyeFollow.style.transform = 'translate(0, 0)';
      state = 'idle';
    };
    const visibilityChanged = () => {
      if (document.hidden) stop();
    };
    reducedMotion.addEventListener('change', stop);
    document.addEventListener('visibilitychange', visibilityChanged);
    return () => {
      stop();
      reducedMotion?.removeEventListener('change', stop);
      document.removeEventListener('visibilitychange', visibilityChanged);
    };
  });
</script>

<a
  class="wordmark brand-logo"
  href={resolve('/')}
  aria-label="LogoDock 首页"
  data-sveltekit-reload
  data-brand-motion={state}
  bind:this={link}
  onpointerenter={enter}
  onpointerleave={leave}
  onpointermove={followPointer}
  onfocus={focus}
  onblur={blur}
>
  <span class="brand-mark" aria-hidden="true">
    <span class="brand-character" bind:this={character}>
      <svg viewBox={symbolViewBox} focusable="false">
        <path d={birdPath} fill="currentColor" />
        <g class="brand-eye-follow" bind:this={eyeFollow}>
          <g class="brand-eye-blink" bind:this={eyeBlink}>
            <circle class="brand-eye" cx={eye.cx} cy={eye.cy} r={eye.r} />
          </g>
        </g>
      </svg>
      <span class="brand-card" bind:this={card}>
        <svg viewBox={symbolViewBox} focusable="false"><path d={cardPath} /></svg>
      </span>
    </span>
    <svg class="brand-wordmark" viewBox={wordmarkViewBox} focusable="false">
      <path d={wordmarkPath} fill="currentColor" fill-rule="evenodd" />
    </svg>
  </span>
  <span class="wordmark-description">品牌 Logo 库</span>
</a>

<style>
  .brand-logo {
    min-height: 44px;
  }
  .brand-mark {
    --brand-cap-size: 20px;
    --brand-symbol-size: 32px;
    display: inline-flex;
    align-items: center;
    gap: 9px;
    line-height: 0;
  }
  .brand-character {
    position: relative;
    display: block;
    flex: none;
    width: calc(var(--brand-symbol-size) * 427 / 272);
    height: var(--brand-symbol-size);
    transform-origin: 50% 80%;
  }
  .brand-character svg {
    display: block;
    width: 100%;
    height: 100%;
    overflow: visible;
  }
  .brand-card {
    position: absolute;
    inset: 0;
    transform-origin: 84.5% 41.2%;
  }
  .brand-card path {
    fill: var(--accent);
  }
  .brand-eye {
    fill: var(--paper);
  }
  .brand-eye-follow {
    transition: transform 140ms ease-out;
  }
  .brand-eye-blink {
    transform-box: fill-box;
    transform-origin: center;
  }
  .brand-wordmark {
    display: block;
    flex: none;
    width: calc(var(--brand-cap-size) * 962 / 161);
    height: calc(var(--brand-cap-size) * 210 / 161);
    transform: translateY(calc(var(--brand-cap-size) * 45 / 322));
  }
  @media (max-width: 720px) {
    .brand-mark {
      --brand-cap-size: 18px;
      --brand-symbol-size: 28px;
      gap: 7px;
    }
  }
  @media (max-width: 360px) {
    .brand-mark {
      --brand-cap-size: 16px;
      --brand-symbol-size: 24px;
      gap: 6px;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .brand-eye-follow {
      transition: none;
    }
  }
</style>
