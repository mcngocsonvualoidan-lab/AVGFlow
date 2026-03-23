/**
 * 🐺 Werewolf Game — Spooky Audio Engine
 * Uses Web Audio API to generate atmospheric sounds procedurally.
 * No external audio files needed.
 */

type PhaseType = 'waiting' | 'night' | 'day' | 'vote' | 'gameover' | 'silent';

class WerewolfAudioEngine {
    private ctx: AudioContext | null = null;
    private masterGain: GainNode | null = null;
    private ambientNodes: AudioNode[] = [];
    private muted = false;
    private currentPhase: PhaseType = 'silent';
    private volume = 0.3;
    private initialized = false;

    /** Must be called from a user gesture (click/tap) */
    init() {
        if (this.initialized) return;
        try {
            this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
            this.masterGain = this.ctx.createGain();
            this.masterGain.gain.value = this.volume;
            this.masterGain.connect(this.ctx.destination);
            this.initialized = true;
            // Immediately resume if suspended (user gesture required)
            this.resume();
        } catch (e) {
            console.warn('🐺 Audio: Web Audio API not supported', e);
        }
    }

    isInitialized() { return this.initialized; }

    /** Resume context if suspended (browser autoplay policy) */
    private resume() {
        if (this.ctx?.state === 'suspended') {
            this.ctx.resume().catch(() => {});
        }
    }

    // ==================== AMBIENT LAYERS ====================

    /** Stop all ambient sounds */
    private stopAmbient() {
        this.ambientNodes.forEach(node => {
            try {
                if (node instanceof OscillatorNode) node.stop();
                else if (node instanceof AudioBufferSourceNode) node.stop();
                node.disconnect();
            } catch { /* already stopped */ }
        });
        this.ambientNodes = [];
    }

    /** Create a low eerie drone (two detuned sine waves) */
    private createDrone(baseFreq: number, volume = 0.15): OscillatorNode[] {
        if (!this.ctx || !this.masterGain) return [];
        const nodes: OscillatorNode[] = [];

        // Oscillator 1
        const osc1 = this.ctx.createOscillator();
        const gain1 = this.ctx.createGain();
        osc1.type = 'sine';
        osc1.frequency.value = baseFreq;
        gain1.gain.value = volume;
        osc1.connect(gain1);
        gain1.connect(this.masterGain);
        osc1.start();
        nodes.push(osc1);
        this.ambientNodes.push(osc1);

        // Oscillator 2 — slightly detuned for eerie beating
        const osc2 = this.ctx.createOscillator();
        const gain2 = this.ctx.createGain();
        osc2.type = 'sine';
        osc2.frequency.value = baseFreq + 1.5; // slight detune = creepy beating
        gain2.gain.value = volume * 0.7;
        osc2.connect(gain2);
        gain2.connect(this.masterGain);
        osc2.start();
        nodes.push(osc2);
        this.ambientNodes.push(osc2);

        return nodes;
    }

    /** Create filtered white noise (wind sound) */
    private createWind(volume = 0.08): AudioBufferSourceNode | null {
        if (!this.ctx || !this.masterGain) return null;

        // Generate white noise buffer
        const bufferSize = this.ctx.sampleRate * 4; // 4 seconds loop
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = (Math.random() * 2 - 1) * 0.5;
        }

        const source = this.ctx.createBufferSource();
        source.buffer = buffer;
        source.loop = true;

        // Bandpass filter for wind-like sound
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.value = 400;
        filter.Q.value = 0.5;

        // LFO to modulate filter frequency (wind gusts)
        const lfo = this.ctx.createOscillator();
        const lfoGain = this.ctx.createGain();
        lfo.type = 'sine';
        lfo.frequency.value = 0.15; // very slow
        lfoGain.gain.value = 200; // frequency modulation range
        lfo.connect(lfoGain);
        lfoGain.connect(filter.frequency);
        lfo.start();

        const gain = this.ctx.createGain();
        gain.gain.value = volume;

        source.connect(filter);
        filter.connect(gain);
        gain.connect(this.masterGain);
        source.start();

        this.ambientNodes.push(source, lfo);
        return source;
    }

    /** Create a sub-bass rumble */
    private createSubBass(volume = 0.06) {
        if (!this.ctx || !this.masterGain) return;

        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.value = 35; // sub-bass

        // Very slow vibrato
        const lfo = this.ctx.createOscillator();
        const lfoGain = this.ctx.createGain();
        lfo.type = 'sine';
        lfo.frequency.value = 0.08;
        lfoGain.gain.value = 5;
        lfo.connect(lfoGain);
        lfoGain.connect(osc.frequency);
        lfo.start();

        gain.gain.value = volume;
        osc.connect(gain);
        gain.connect(this.masterGain);
        osc.start();

        this.ambientNodes.push(osc, lfo);
    }

    // ==================== ONE-SHOT EFFECTS ====================

    /** 🐺 Wolf howl — frequency sweep */
    playWolfHowl() {
        if (!this.ctx || !this.masterGain || this.muted) return;
        this.resume();

        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'sawtooth';
        // Rising howl
        osc.frequency.setValueAtTime(200, now);
        osc.frequency.exponentialRampToValueAtTime(600, now + 0.8);
        osc.frequency.exponentialRampToValueAtTime(500, now + 1.5);
        osc.frequency.exponentialRampToValueAtTime(350, now + 2.5);
        osc.frequency.exponentialRampToValueAtTime(150, now + 3.5);

        // Volume envelope
        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(0.12, now + 0.3);
        gain.gain.linearRampToValueAtTime(0.15, now + 1);
        gain.gain.linearRampToValueAtTime(0.08, now + 2.5);
        gain.gain.linearRampToValueAtTime(0, now + 3.5);

        // Filter for more natural sound
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 1200;
        filter.Q.value = 2;

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(this.masterGain);
        osc.start(now);
        osc.stop(now + 3.6);
    }

    /** 🔔 Church bell toll */
    playBellToll() {
        if (!this.ctx || !this.masterGain || this.muted) return;
        this.resume();

        const now = this.ctx.currentTime;
        const freqs = [523, 659, 784]; // C5, E5, G5

        freqs.forEach((freq, i) => {
            const osc = this.ctx!.createOscillator();
            const gain = this.ctx!.createGain();

            osc.type = 'sine';
            osc.frequency.value = freq;

            gain.gain.setValueAtTime(0.1, now + i * 0.05);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 2.5 + i * 0.1);

            osc.connect(gain);
            gain.connect(this.masterGain!);
            osc.start(now + i * 0.05);
            osc.stop(now + 3);
        });
    }

    /** 💓 Heartbeat pulse */
    playHeartbeat(duration = 8) {
        if (!this.ctx || !this.masterGain || this.muted) return;
        this.resume();

        const now = this.ctx.currentTime;
        const bpm = 72; // heartbeat speed
        const interval = 60 / bpm;
        const beats = Math.floor(duration / interval);

        for (let i = 0; i < beats; i++) {
            const t = now + i * interval;

            // Lub
            const osc1 = this.ctx.createOscillator();
            const gain1 = this.ctx.createGain();
            osc1.type = 'sine';
            osc1.frequency.value = 50;
            gain1.gain.setValueAtTime(0, t);
            gain1.gain.linearRampToValueAtTime(0.2, t + 0.05);
            gain1.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
            osc1.connect(gain1);
            gain1.connect(this.masterGain);
            osc1.start(t);
            osc1.stop(t + 0.2);

            // Dub (slightly delayed, higher)
            const osc2 = this.ctx.createOscillator();
            const gain2 = this.ctx.createGain();
            osc2.type = 'sine';
            osc2.frequency.value = 65;
            gain2.gain.setValueAtTime(0, t + 0.12);
            gain2.gain.linearRampToValueAtTime(0.15, t + 0.17);
            gain2.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
            osc2.connect(gain2);
            gain2.connect(this.masterGain);
            osc2.start(t + 0.12);
            osc2.stop(t + 0.35);
        }
    }

    /** 💀 Death stinger — dissonant chord */
    playDeathStinger() {
        if (!this.ctx || !this.masterGain || this.muted) return;
        this.resume();

        const now = this.ctx.currentTime;
        // Tritone / diminished — the "devil's interval"
        const freqs = [220, 311, 370, 466]; // A3, Eb4, F#4, Bb4

        freqs.forEach((freq, i) => {
            const osc = this.ctx!.createOscillator();
            const gain = this.ctx!.createGain();

            osc.type = i < 2 ? 'sawtooth' : 'sine';
            osc.frequency.value = freq;

            gain.gain.setValueAtTime(0, now);
            gain.gain.linearRampToValueAtTime(0.08, now + 0.1);
            gain.gain.linearRampToValueAtTime(0.1, now + 0.4);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 3);

            const filter = this.ctx!.createBiquadFilter();
            filter.type = 'lowpass';
            filter.frequency.value = 800;

            osc.connect(filter);
            filter.connect(gain);
            gain.connect(this.masterGain!);
            osc.start(now);
            osc.stop(now + 3.1);
        });
    }

    /** 🎲 Vote tick — short percussive sound */
    playVoteTick() {
        if (!this.ctx || !this.masterGain || this.muted) return;
        this.resume();

        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'square';
        osc.frequency.setValueAtTime(800, now);
        osc.frequency.exponentialRampToValueAtTime(200, now + 0.1);

        gain.gain.setValueAtTime(0.1, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);

        osc.connect(gain);
        gain.connect(this.masterGain);
        osc.start(now);
        osc.stop(now + 0.2);
    }

    /** 🏆 Victory fanfare */
    playVictory() {
        if (!this.ctx || !this.masterGain || this.muted) return;
        this.resume();

        const now = this.ctx.currentTime;
        const notes = [523, 659, 784, 1047]; // C5 E5 G5 C6

        notes.forEach((freq, i) => {
            const osc = this.ctx!.createOscillator();
            const gain = this.ctx!.createGain();

            osc.type = 'triangle';
            osc.frequency.value = freq;

            const t = now + i * 0.2;
            gain.gain.setValueAtTime(0, t);
            gain.gain.linearRampToValueAtTime(0.12, t + 0.05);
            gain.gain.linearRampToValueAtTime(0.08, t + 0.3);
            gain.gain.exponentialRampToValueAtTime(0.001, t + 1.5);

            osc.connect(gain);
            gain.connect(this.masterGain!);
            osc.start(t);
            osc.stop(t + 1.6);
        });
    }

    // ==================== PHASE-BASED AMBIENT ====================

    /** Set the ambient sound based on game phase */
    setPhase(phase: PhaseType) {
        if (!this.ctx || !this.masterGain || this.currentPhase === phase) return;
        this.resume();

        this.stopAmbient();
        this.currentPhase = phase;

        if (this.muted) return;

        switch (phase) {
            case 'waiting':
                // Subtle eerie drone
                this.createDrone(55, 0.06);  // very low A
                this.createWind(0.04);
                break;

            case 'night':
                // Full horror ambience
                this.createDrone(40, 0.1);   // deep D
                this.createDrone(60, 0.05);  // detuned
                this.createWind(0.1);
                this.createSubBass(0.08);
                break;

            case 'day':
                // Lighter but still tense
                this.createDrone(80, 0.04);
                this.createWind(0.03);
                break;

            case 'vote':
                // Tense atmosphere
                this.createDrone(50, 0.08);
                this.createSubBass(0.1);
                break;

            case 'gameover':
                // Silence with just wind
                this.createWind(0.05);
                break;

            case 'silent':
            default:
                // No ambient
                break;
        }
    }

    // ==================== CONTROLS ====================

    setVolume(v: number) {
        this.volume = Math.max(0, Math.min(1, v));
        if (this.masterGain) {
            this.masterGain.gain.value = this.muted ? 0 : this.volume;
        }
    }

    getVolume() { return this.volume; }

    toggleMute(): boolean {
        this.muted = !this.muted;
        if (this.masterGain) {
            this.masterGain.gain.value = this.muted ? 0 : this.volume;
        }
        if (this.muted) {
            this.stopAmbient();
        } else {
            // Re-activate ambient for current phase
            const phase = this.currentPhase;
            this.currentPhase = 'silent'; // force refresh
            this.setPhase(phase);
        }
        return this.muted;
    }

    isMuted() { return this.muted; }

    /** Clean up all audio resources */
    destroy() {
        this.stopAmbient();
        if (this.ctx) {
            this.ctx.close().catch(() => {});
            this.ctx = null;
        }
        this.masterGain = null;
        this.initialized = false;
    }
}

// Singleton instance
export const werewolfAudio = new WerewolfAudioEngine();
export type { PhaseType };
