// ============================================
// AUDIO PLAYER MODULE - COMPLETE VERSION
// ============================================

class AudioPlayer {
    constructor() {
        // Core properties
        this.currentAudio = null;
        this.currentCard = null;
        this.isPlaying = false;
        this.audioElements = new Map();
        this.playlist = [];
        this.currentIndex = -1;
        this.volume = 0.8;
        this.isMuted = false;
        this.progressInterval = null;
        this.currentTime = 0;
        this.duration = 0;
        
        // UI elements
        this.globalPlayer = null;
        this.playBtn = null;
        this.prevBtn = null;
        this.nextBtn = null;
        this.repeatBtn = null;
        this.muteBtn = null;
        this.progressBarContainer = null;
        this.progressFill = null;
        this.volumeSliderContainer = null;
        this.volumeFill = null;
        this.timeCurrent = null;
        this.timeDuration = null;
        this.playerTitle = null;
        
        // Event callbacks
        this.onPlayCallbacks = [];
        this.onPauseCallbacks = [];
        this.onEndCallbacks = [];
        
        // Settings
        this.autoPlayNext = false;
        this.repeatMode = 'none';
        
        // Load saved settings
        this.loadSettings();
    }
    
    // ============================================
    // INITIALIZATION
    // ============================================
    
    init() {
        this.createGlobalPlayerUI();
        this.loadSettings();
        this.setupGlobalEventListeners();
        console.log('🎵 Audio Player initialized');
    }
    
    createGlobalPlayerUI() {
        if (document.getElementById('globalPlayer')) return;
        
        const playerHTML = `
            <div id="globalPlayer" class="global-player" style="display: none;">
                <div class="player-container">
                    <div class="player-info">
                        <div class="player-thumbnail"></div>
                        <div class="player-track-info">
                            <div class="player-title">No track selected</div>
                            <div class="player-artist">Beats Market</div>
                        </div>
                    </div>
                    <div class="player-controls">
                        <button class="player-btn" id="playerPrevBtn">⏮</button>
                        <button class="player-btn" id="playerPlayBtn">▶</button>
                        <button class="player-btn" id="playerNextBtn">⏭</button>
                        <button class="player-btn" id="playerRepeatBtn">🔁</button>
                    </div>
                    <div class="player-progress">
                        <span class="player-time-current">0:00</span>
                        <div class="progress-bar-container">
                            <div class="progress-bar-fill"></div>
                        </div>
                        <span class="player-time-duration">0:00</span>
                    </div>
                    <div class="player-volume">
                        <button class="player-btn" id="playerMuteBtn">🔊</button>
                        <div class="volume-slider-container">
                            <div class="volume-slider-fill"></div>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        document.body.insertAdjacentHTML('beforeend', playerHTML);
        
        this.globalPlayer = document.getElementById('globalPlayer');
        this.playBtn = document.getElementById('playerPlayBtn');
        this.prevBtn = document.getElementById('playerPrevBtn');
        this.nextBtn = document.getElementById('playerNextBtn');
        this.repeatBtn = document.getElementById('playerRepeatBtn');
        this.muteBtn = document.getElementById('playerMuteBtn');
        this.progressBarContainer = document.querySelector('.progress-bar-container');
        this.progressFill = document.querySelector('.progress-bar-fill');
        this.volumeSliderContainer = document.querySelector('.volume-slider-container');
        this.volumeFill = document.querySelector('.volume-slider-fill');
        this.timeCurrent = document.querySelector('.player-time-current');
        this.timeDuration = document.querySelector('.player-time-duration');
        this.playerTitle = document.querySelector('.player-title');
        
        this.setupUIEventListeners();
    }
    
    setupUIEventListeners() {
        if (this.playBtn) this.playBtn.addEventListener('click', () => this.togglePlayGlobal());
        if (this.prevBtn) this.prevBtn.addEventListener('click', () => this.playPrevious());
        if (this.nextBtn) this.nextBtn.addEventListener('click', () => this.playNext());
        if (this.repeatBtn) this.repeatBtn.addEventListener('click', () => this.toggleRepeatMode());
        if (this.muteBtn) this.muteBtn.addEventListener('click', () => this.toggleMute());
        if (this.progressBarContainer) this.progressBarContainer.addEventListener('click', (e) => this.seek(e));
        if (this.volumeSliderContainer) this.volumeSliderContainer.addEventListener('click', (e) => this.setVolumeFromClick(e));
    }
    
    setupGlobalEventListeners() {
        document.addEventListener('keydown', (e) => {
            if (e.code === 'Space' && !e.target.matches('input, textarea')) {
                e.preventDefault();
                this.togglePlayGlobal();
            } else if (e.code === 'ArrowLeft') {
                this.seekBackward(5);
            } else if (e.code === 'ArrowRight') {
                this.seekForward(5);
            }
        });
    }
    
    // ============================================
    // PLAYLIST MANAGEMENT
    // ============================================
    
    addToPlaylist(beatCard, audioUrl, title) {
    // Проверяем, не добавлен ли уже
    const existing = this.playlist.find(item => item.card === beatCard);
    if (existing) return existing;
    
    // 🔥 НЕ СОЗДАЁМ НОВЫЙ AUDIO, а используем существующий из DOM
    const existingAudio = beatCard.querySelector('.beat-player');
    
    // 🔥 ВАЖНО: используем src из аудио-элемента, который уже указывает на превью
    const previewUrl = existingAudio ? existingAudio.src : `/api/beats/${beatCard.dataset.id}/preview`;
    
    const playlistItem = {
        id: beatCard.dataset.id,
        card: beatCard,
        audioUrl: previewUrl,
        fullUrl: audioUrl,  // сохраняем полный URL для скачивания
        title: title,
        audio: existingAudio  // ← используем существующий audio элемент
    };
    
    this.playlist.push(playlistItem);
    
    // Если по какой-то причине audio не найден, создаём новый
    if (!playlistItem.audio) {
        const audio = new Audio(previewUrl);
        audio.crossOrigin = 'use-credentials';
        audio.preload = 'metadata';
        audio.volume = this.volume;
        playlistItem.audio = audio;
        this.audioElements.set(beatCard, audio);
        
        audio.addEventListener('loadedmetadata', () => {
            if (this.currentAudio === audio) {
                this.duration = audio.duration;
                this.updateDurationDisplay();
            }
        });
        
        audio.addEventListener('timeupdate', () => {
            if (this.currentAudio === audio) {
                this.updateProgress();
            }
        });
    } else {
        // Убеждаемся, что у существующего audio правильный src
        if (playlistItem.audio.src !== previewUrl) {
            playlistItem.audio.src = previewUrl;
        }
        playlistItem.audio.volume = this.volume;
        this.audioElements.set(beatCard, playlistItem.audio);
        
        // Добавляем слушатели, если их нет
        if (!playlistItem.audio._hasListeners) {
            playlistItem.audio.addEventListener('loadedmetadata', () => {
                if (this.currentAudio === playlistItem.audio) {
                    this.duration = playlistItem.audio.duration;
                    this.updateDurationDisplay();
                }
            });
            
            playlistItem.audio.addEventListener('timeupdate', () => {
                if (this.currentAudio === playlistItem.audio) {
                    this.updateProgress();
                }
            });
            playlistItem.audio._hasListeners = true;
        }
    }
    
    // Добавляем обработчик клика на обложку
    const cover = beatCard.querySelector('.beat-cover');
    if (cover) {
        if (cover._clickHandler) {
            cover.removeEventListener('click', cover._clickHandler);
        }
        
        const clickHandler = () => {
            console.log('🎵 Cover clicked:', title);
            this.togglePlay(beatCard);
        };
        
        cover.addEventListener('click', clickHandler);
        cover._clickHandler = clickHandler;
        cover.style.cursor = 'pointer';
    }
    
    return playlistItem;
}
    
    // ============================================
    // CORE PLAYER METHODS
    // ============================================
    
    playFromCard(cardElement) {
        const playlistItem = this.playlist.find(item => item.card === cardElement);
        if (!playlistItem) return;
        
        const audio = playlistItem.audio;
        
        if (this.currentAudio && this.currentAudio !== audio) {
            this.stop(this.currentCard);
        }
        
        audio.play().catch(err => {
            console.error('Playback failed:', err);
        });
        
        this.currentAudio = audio;
        this.currentCard = cardElement;
        this.isPlaying = true;
        
        this.updatePlayingCard(cardElement);
        this.updateGlobalPlayerUI(playlistItem.title);
        this.showGlobalPlayer();
        
        if (this.playBtn) this.playBtn.textContent = '⏸';
        
        audio.onended = () => {
            cardElement.classList.remove('playing');
            if (this.currentAudio === audio) {
                this.currentAudio = null;
                this.currentCard = null;
                this.isPlaying = false;
                if (this.playBtn) this.playBtn.textContent = '▶';
            }
            this.handleTrackEnd();
        };
        
        this.currentIndex = this.playlist.indexOf(playlistItem);
        this.triggerCallbacks('play', playlistItem);
    }
    
    togglePlay(cardElement) {
        const playlistItem = this.playlist.find(item => item.card === cardElement);
        if (!playlistItem) return;
        
        const audio = playlistItem.audio;
        
        if (this.currentAudio === audio && this.isPlaying) {
            this.pause(cardElement);
        } else {
            this.playFromCard(cardElement);
        }
    }
    
    togglePlayGlobal() {
        if (this.currentAudio && this.isPlaying) {
            this.pause(this.currentCard);
        } else if (this.currentAudio && !this.isPlaying) {
            this.resume();
        } else if (this.playlist.length > 0 && this.currentIndex < 0) {
            this.currentIndex = 0;
            this.playFromCard(this.playlist[0].card);
        }
    }
    
    pause(cardElement) {
        const playlistItem = this.playlist.find(item => item.card === cardElement);
        if (!playlistItem) return;
        
        playlistItem.audio.pause();
        this.isPlaying = false;
        cardElement.classList.remove('playing');
        
        if (this.currentCard === cardElement) {
            this.currentAudio = null;
            this.currentCard = null;
            if (this.playBtn) this.playBtn.textContent = '▶';
        }
        
        this.triggerCallbacks('pause', playlistItem);
    }
    
    resume() {
        if (!this.currentAudio) return;
        
        this.currentAudio.play();
        this.isPlaying = true;
        if (this.currentCard) this.currentCard.classList.add('playing');
        if (this.playBtn) this.playBtn.textContent = '⏸';
        
        this.triggerCallbacks('play', this.playlist[this.currentIndex]);
    }
    
    stop(cardElement) {
        const playlistItem = this.playlist.find(item => item.card === cardElement);
        if (!playlistItem) return;
        
        playlistItem.audio.pause();
        playlistItem.audio.currentTime = 0;
        cardElement.classList.remove('playing');
        
        if (this.currentCard === cardElement) {
            this.currentAudio = null;
            this.currentCard = null;
            this.isPlaying = false;
            if (this.playBtn) this.playBtn.textContent = '▶';
            this.hideGlobalPlayer();
        }
    }
    
    playNext() {
        if (this.playlist.length === 0) return;
        
        let nextIndex = this.currentIndex + 1;
        if (nextIndex >= this.playlist.length) {
            if (this.repeatMode === 'all') nextIndex = 0;
            else return;
        }
        
        this.currentIndex = nextIndex;
        this.playFromCard(this.playlist[this.currentIndex].card);
    }
    
    playPrevious() {
        if (this.playlist.length === 0) return;
        
        let prevIndex = this.currentIndex - 1;
        if (prevIndex < 0) {
            if (this.repeatMode === 'all') prevIndex = this.playlist.length - 1;
            else return;
        }
        
        this.currentIndex = prevIndex;
        this.playFromCard(this.playlist[this.currentIndex].card);
    }
    
    handleTrackEnd() {
        if (this.repeatMode === 'one') {
            this.currentAudio.currentTime = 0;
            this.currentAudio.play();
        } else {
            this.playNext();
        }
        this.triggerCallbacks('end', this.playlist[this.currentIndex]);
    }
    
    // ============================================
    // UI UPDATE METHODS
    // ============================================
    
    updatePlayingCard(cardElement) {
        this.playlist.forEach(item => {
            if (item.card) item.card.classList.remove('playing');
        });
        if (cardElement) cardElement.classList.add('playing');
    }
    
    updateGlobalPlayerUI(title) {
        if (this.playerTitle) this.playerTitle.textContent = title || 'No track selected';
    }
    
    updateProgress() {
        if (!this.progressFill || !this.timeCurrent || !this.currentAudio) return;
        
        const percent = (this.currentAudio.currentTime / this.currentAudio.duration) * 100;
        this.progressFill.style.width = percent + '%';
        this.timeCurrent.textContent = this.formatTime(this.currentAudio.currentTime);
    }
    
    updateDurationDisplay() {
        if (this.timeDuration && this.duration) {
            this.timeDuration.textContent = this.formatTime(this.duration);
        }
    }
    
    showGlobalPlayer() {
        if (this.globalPlayer) this.globalPlayer.style.display = 'block';
    }
    
    hideGlobalPlayer() {
        if (this.globalPlayer && !this.isPlaying) this.globalPlayer.style.display = 'none';
    }
    
    // ============================================
    // VOLUME CONTROL
    // ============================================
    
    setVolume(volume) {
        this.volume = Math.max(0, Math.min(1, volume));
        this.playlist.forEach(item => {
            if (item.audio) item.audio.volume = this.volume;
        });
        this.updateVolumeUI();
        this.saveSettings();
    }
    
    setVolumeFromClick(e) {
        if (!this.volumeSliderContainer) return;
        const rect = this.volumeSliderContainer.getBoundingClientRect();
        const percent = (e.clientX - rect.left) / rect.width;
        this.setVolume(percent);
        if (this.isMuted) this.toggleMute();
    }
    
    toggleMute() {
        this.isMuted = !this.isMuted;
        this.playlist.forEach(item => {
            if (item.audio) item.audio.muted = this.isMuted;
        });
        if (this.muteBtn) this.muteBtn.textContent = this.isMuted ? '🔇' : '🔊';
        this.saveSettings();
    }
    
    updateVolumeUI() {
        if (this.volumeFill) this.volumeFill.style.width = (this.volume * 100) + '%';
    }
    
    // ============================================
    // REPEAT MODE
    // ============================================
    
    toggleRepeatMode() {
        const modes = ['none', 'one', 'all'];
        const currentIndex = modes.indexOf(this.repeatMode);
        this.repeatMode = modes[(currentIndex + 1) % modes.length];
        if (this.repeatBtn) {
            if (this.repeatMode === 'none') this.repeatBtn.textContent = '🔁';
            else if (this.repeatMode === 'one') this.repeatBtn.textContent = '🔂';
            else if (this.repeatMode === 'all') this.repeatBtn.textContent = '🔁 all';
        }
        this.saveSettings();
    }
    
    // ============================================
    // SEEK
    // ============================================
    
    seek(e) {
        if (!this.progressBarContainer || !this.currentAudio) return;
        const rect = this.progressBarContainer.getBoundingClientRect();
        const percent = (e.clientX - rect.left) / rect.width;
        const seekTime = percent * this.currentAudio.duration;
        this.currentAudio.currentTime = seekTime;
    }
    
    seekForward(seconds) {
        if (this.currentAudio) {
            this.currentAudio.currentTime = Math.min(this.currentAudio.currentTime + seconds, this.currentAudio.duration);
        }
    }
    
    seekBackward(seconds) {
        if (this.currentAudio) {
            this.currentAudio.currentTime = Math.max(this.currentAudio.currentTime - seconds, 0);
        }
    }
    
    // ============================================
    // UTILITIES
    // ============================================
    
    formatTime(seconds) {
        if (isNaN(seconds)) return '0:00';
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    }
    
    saveSettings() {
        const settings = { volume: this.volume, repeatMode: this.repeatMode, isMuted: this.isMuted };
        localStorage.setItem('audioPlayerSettings', JSON.stringify(settings));
    }
    
    loadSettings() {
        const saved = localStorage.getItem('audioPlayerSettings');
        if (saved) {
            try {
                const settings = JSON.parse(saved);
                this.volume = settings.volume || 0.8;
                this.repeatMode = settings.repeatMode || 'none';
                this.isMuted = settings.isMuted || false;
                this.updateVolumeUI();
                if (this.repeatBtn) {
                    if (this.repeatMode === 'none') this.repeatBtn.textContent = '🔁';
                    else if (this.repeatMode === 'one') this.repeatBtn.textContent = '🔂';
                    else if (this.repeatMode === 'all') this.repeatBtn.textContent = '🔁 all';
                }
            } catch (e) {}
        }
    }
    
    // ============================================
    // CALLBACKS
    // ============================================
    
    onPlay(callback) { this.onPlayCallbacks.push(callback); }
    onPause(callback) { this.onPauseCallbacks.push(callback); }
    onEnd(callback) { this.onEndCallbacks.push(callback); }
    
    triggerCallbacks(event, data) {
        if (event === 'play') this.onPlayCallbacks.forEach(cb => cb(data));
        else if (event === 'pause') this.onPauseCallbacks.forEach(cb => cb(data));
        else if (event === 'end') this.onEndCallbacks.forEach(cb => cb(data));
    }
    
    // ============================================
    // GETTERS
    // ============================================
    
    getCurrentTrack() {
        return this.currentIndex >= 0 ? this.playlist[this.currentIndex] : null;
    }
    
    getPlaylist() { return [...this.playlist]; }
    getPlaylistLength() { return this.playlist.length; }
    isTrackPlaying() { return this.isPlaying; }
    
    // ============================================
    // DESTROY
    // ============================================
    
    destroy() {
        this.stopAll();
        this.playlist = [];
        this.audioElements.clear();
        this.currentAudio = null;
        this.currentCard = null;
        this.isPlaying = false;
        if (this.globalPlayer) this.globalPlayer.remove();
    }
    
    stopAll() {
        this.playlist.forEach(item => {
            if (item.audio) {
                item.audio.pause();
                item.audio.currentTime = 0;
            }
            if (item.card) item.card.classList.remove('playing');
        });
        this.currentAudio = null;
        this.currentCard = null;
        this.isPlaying = false;
        this.hideGlobalPlayer();
        if (this.playBtn) this.playBtn.textContent = '▶';
    }
}

// Create global player instance
const player = new AudioPlayer();

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    player.init();
});

if (typeof module !== 'undefined' && module.exports) {
    module.exports = AudioPlayer;
}