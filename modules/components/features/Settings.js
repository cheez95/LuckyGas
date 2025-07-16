/**
 * Settings Component for LuckyGas
 * Comprehensive settings management with tabbed interface
 * @module components/features/Settings
 */

import { ReactiveComponent } from '../../../src/main/python/web/modules/components/ReactiveComponent.js';
import store from '../../../src/main/js/state/store.js';
import { dom } from '../../../src/main/python/web/modules/utils/index.js';

/**
 * Settings Component - Manage application preferences
 */
export class Settings extends ReactiveComponent {
    constructor(options = {}) {
        super({
            ...options,
            name: 'Settings',
            
            // Reactive data
            data: {
                activeTab: 'general',
                unsavedChanges: false,
                saveInProgress: false,
                importExportProgress: false,
                
                // Settings data structure
                settings: {
                    general: {
                        language: 'zh-TW',
                        timezone: 'Asia/Taipei',
                        dateFormat: 'YYYY-MM-DD',
                        timeFormat: '24h',
                        startOfWeek: 'monday',
                        numberFormat: 'comma'
                    },
                    notifications: {
                        email: {
                            enabled: true,
                            frequency: 'instant',
                            types: {
                                deliveryAssigned: true,
                                deliveryCompleted: true,
                                deliveryFailed: true,
                                systemAlerts: true
                            }
                        },
                        sms: {
                            enabled: false,
                            phoneNumber: '',
                            types: {
                                urgentDeliveries: true,
                                systemAlerts: false
                            }
                        },
                        push: {
                            enabled: true,
                            sound: true,
                            vibration: true,
                            types: {
                                all: true
                            }
                        }
                    },
                    display: {
                        theme: 'light',
                        density: 'comfortable',
                        animations: true,
                        reducedMotion: false,
                        fontSize: 'medium',
                        highContrast: false
                    },
                    api: {
                        endpoints: {
                            primary: window.APP_CONFIG?.API?.BASE_URL || 'http://localhost:8000/api',
                            backup: ''
                        },
                        timeout: 30000,
                        retryAttempts: 3,
                        retryDelay: 1000,
                        compressionEnabled: true,
                        cacheEnabled: true,
                        cacheDuration: 300 // 5 minutes
                    },
                    security: {
                        sessionTimeout: 30, // minutes
                        autoLock: false,
                        autoLockDelay: 5, // minutes
                        twoFactorAuth: false,
                        rememberDevice: true,
                        biometricAuth: false
                    },
                    data: {
                        autoExport: false,
                        exportFormat: 'json',
                        exportSchedule: 'weekly',
                        autoBackup: true,
                        backupRetention: 30, // days
                        dataCleanup: {
                            enabled: false,
                            olderThan: 365 // days
                        }
                    }
                },
                
                // Original settings for reset
                originalSettings: null,
                
                // Change history
                changeHistory: [],
                
                // Validation errors
                validationErrors: {}
            },
            
            // Computed properties
            computedState: {
                userPreferences: 'user.preferences',
                systemConfig: 'config'
            },
            
            // Watchers
            watch: {
                'settings': {
                    handler(newSettings) {
                        this.checkForChanges();
                    },
                    deep: true
                },
                'settings.display.theme': function(newTheme) {
                    this.applyTheme(newTheme);
                }
            },
            
            // Template filters
            filters: {
                formatBytes: (bytes) => {
                    if (bytes === 0) return '0 Bytes';
                    const k = 1024;
                    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
                    const i = Math.floor(Math.log(bytes) / Math.log(k));
                    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
                }
            }
        });
        
        // Initialize after construction
        this.tabs = [
            { id: 'general', label: '一般設定', icon: '⚙️' },
            { id: 'notifications', label: '通知設定', icon: '🔔' },
            { id: 'display', label: '顯示設定', icon: '🎨' },
            { id: 'api', label: 'API 設定', icon: '🔌' },
            { id: 'security', label: '安全設定', icon: '🔒' },
            { id: 'data', label: '資料管理', icon: '💾' }
        ];
    }

    /**
     * Component lifecycle - mounted
     */
    async mounted() {
        await super.mounted();
        
        // Load settings from localStorage
        this.loadSettings();
        
        // Store original settings for reset
        this.data.originalSettings = JSON.parse(JSON.stringify(this.data.settings));
        
        // Apply current theme
        this.applyTheme(this.data.settings.display.theme);
    }

    /**
     * Component template
     */
    template() {
        return `
            <div class="settings-container">
                <div class="settings-header">
                    <h2>系統設定</h2>
                    <div class="settings-actions">
                        ${this.data.unsavedChanges ? `
                            <span class="unsaved-indicator">有未儲存的變更</span>
                        ` : ''}
                        <button class="btn btn-secondary" onclick="this.exportSettings()" 
                                ${this.data.importExportProgress ? 'disabled' : ''}>
                            <i class="icon-export"></i> 匯出設定
                        </button>
                        <button class="btn btn-secondary" onclick="this.importSettings()" 
                                ${this.data.importExportProgress ? 'disabled' : ''}>
                            <i class="icon-import"></i> 匯入設定
                        </button>
                    </div>
                </div>
                
                <div class="settings-tabs">
                    ${this.tabs.map(tab => `
                        <button class="tab-button ${this.data.activeTab === tab.id ? 'active' : ''}"
                                onclick="this.switchTab('${tab.id}')">
                            <span class="tab-icon">${tab.icon}</span>
                            <span class="tab-label">${tab.label}</span>
                        </button>
                    `).join('')}
                </div>
                
                <div class="settings-content">
                    ${this.renderTabContent()}
                </div>
                
                <div class="settings-footer">
                    <button class="btn btn-secondary" onclick="this.resetSettings()">
                        <i class="icon-reset"></i> 重設為預設值
                    </button>
                    <div class="footer-actions">
                        <button class="btn btn-secondary" onclick="this.cancelChanges()" 
                                ${!this.data.unsavedChanges ? 'disabled' : ''}>
                            取消
                        </button>
                        <button class="btn btn-primary" onclick="this.saveSettings()" 
                                ${!this.data.unsavedChanges || this.data.saveInProgress ? 'disabled' : ''}>
                            ${this.data.saveInProgress ? '儲存中...' : '儲存變更'}
                        </button>
                    </div>
                </div>
                
                ${this.data.importExportProgress ? `
                    <div class="settings-overlay">
                        <div class="progress-modal">
                            <div class="spinner"></div>
                            <p>處理中...</p>
                        </div>
                    </div>
                ` : ''}
            </div>
        `;
    }

    /**
     * Render content for active tab
     */
    renderTabContent() {
        switch (this.data.activeTab) {
            case 'general':
                return this.renderGeneralSettings();
            case 'notifications':
                return this.renderNotificationSettings();
            case 'display':
                return this.renderDisplaySettings();
            case 'api':
                return this.renderApiSettings();
            case 'security':
                return this.renderSecuritySettings();
            case 'data':
                return this.renderDataSettings();
            default:
                return '';
        }
    }

    /**
     * Render general settings tab
     */
    renderGeneralSettings() {
        const { general } = this.data.settings;
        return `
            <div class="tab-content general-settings">
                <h3>一般設定</h3>
                
                <div class="setting-group">
                    <label for="language">語言</label>
                    <select id="language" v-model="settings.general.language" 
                            onchange="this.updateSetting('general.language', event.target.value)">
                        <option value="zh-TW">繁體中文</option>
                        <option value="zh-CN">简体中文</option>
                        <option value="en">English</option>
                        <option value="ja">日本語</option>
                    </select>
                </div>
                
                <div class="setting-group">
                    <label for="timezone">時區</label>
                    <select id="timezone" v-model="settings.general.timezone"
                            onchange="this.updateSetting('general.timezone', event.target.value)">
                        <option value="Asia/Taipei">台北 (UTC+8)</option>
                        <option value="Asia/Shanghai">上海 (UTC+8)</option>
                        <option value="Asia/Tokyo">東京 (UTC+9)</option>
                        <option value="UTC">UTC</option>
                    </select>
                </div>
                
                <div class="setting-group">
                    <label for="dateFormat">日期格式</label>
                    <select id="dateFormat" v-model="settings.general.dateFormat"
                            onchange="this.updateSetting('general.dateFormat', event.target.value)">
                        <option value="YYYY-MM-DD">2024-01-15</option>
                        <option value="DD/MM/YYYY">15/01/2024</option>
                        <option value="MM/DD/YYYY">01/15/2024</option>
                        <option value="YYYY年MM月DD日">2024年01月15日</option>
                    </select>
                    <small class="setting-preview">預覽: ${this.formatDate(new Date(), general.dateFormat)}</small>
                </div>
                
                <div class="setting-group">
                    <label for="timeFormat">時間格式</label>
                    <div class="radio-group">
                        <label>
                            <input type="radio" name="timeFormat" value="24h" 
                                   ${general.timeFormat === '24h' ? 'checked' : ''}
                                   onchange="this.updateSetting('general.timeFormat', '24h')">
                            24 小時制 (14:30)
                        </label>
                        <label>
                            <input type="radio" name="timeFormat" value="12h" 
                                   ${general.timeFormat === '12h' ? 'checked' : ''}
                                   onchange="this.updateSetting('general.timeFormat', '12h')">
                            12 小時制 (2:30 PM)
                        </label>
                    </div>
                </div>
                
                <div class="setting-group">
                    <label for="startOfWeek">週起始日</label>
                    <select id="startOfWeek" v-model="settings.general.startOfWeek"
                            onchange="this.updateSetting('general.startOfWeek', event.target.value)">
                        <option value="sunday">星期日</option>
                        <option value="monday">星期一</option>
                    </select>
                </div>
                
                <div class="setting-group">
                    <label for="numberFormat">數字格式</label>
                    <select id="numberFormat" v-model="settings.general.numberFormat"
                            onchange="this.updateSetting('general.numberFormat', event.target.value)">
                        <option value="comma">1,234.56</option>
                        <option value="space">1 234.56</option>
                        <option value="period">1.234,56</option>
                    </select>
                </div>
            </div>
        `;
    }

    /**
     * Render notification settings tab
     */
    renderNotificationSettings() {
        const { notifications } = this.data.settings;
        return `
            <div class="tab-content notification-settings">
                <h3>通知設定</h3>
                
                <!-- Email Notifications -->
                <div class="notification-section">
                    <h4>電子郵件通知</h4>
                    <div class="setting-group">
                        <label class="toggle-label">
                            <input type="checkbox" class="toggle-switch" 
                                   ${notifications.email.enabled ? 'checked' : ''}
                                   onchange="this.updateSetting('notifications.email.enabled', event.target.checked)">
                            <span class="toggle-slider"></span>
                            啟用電子郵件通知
                        </label>
                    </div>
                    
                    ${notifications.email.enabled ? `
                        <div class="setting-group indent">
                            <label for="emailFrequency">通知頻率</label>
                            <select id="emailFrequency" 
                                    onchange="this.updateSetting('notifications.email.frequency', event.target.value)">
                                <option value="instant" ${notifications.email.frequency === 'instant' ? 'selected' : ''}>即時</option>
                                <option value="hourly" ${notifications.email.frequency === 'hourly' ? 'selected' : ''}>每小時</option>
                                <option value="daily" ${notifications.email.frequency === 'daily' ? 'selected' : ''}>每日摘要</option>
                            </select>
                        </div>
                        
                        <div class="setting-group indent">
                            <label>通知類型</label>
                            <div class="checkbox-group">
                                ${Object.entries(notifications.email.types).map(([type, enabled]) => `
                                    <label>
                                        <input type="checkbox" ${enabled ? 'checked' : ''}
                                               onchange="this.updateSetting('notifications.email.types.${type}', event.target.checked)">
                                        ${this.getNotificationTypeLabel(type)}
                                    </label>
                                `).join('')}
                            </div>
                        </div>
                    ` : ''}
                </div>
                
                <!-- SMS Notifications -->
                <div class="notification-section">
                    <h4>簡訊通知</h4>
                    <div class="setting-group">
                        <label class="toggle-label">
                            <input type="checkbox" class="toggle-switch" 
                                   ${notifications.sms.enabled ? 'checked' : ''}
                                   onchange="this.updateSetting('notifications.sms.enabled', event.target.checked)">
                            <span class="toggle-slider"></span>
                            啟用簡訊通知
                        </label>
                    </div>
                    
                    ${notifications.sms.enabled ? `
                        <div class="setting-group indent">
                            <label for="smsPhone">手機號碼</label>
                            <input type="tel" id="smsPhone" 
                                   value="${notifications.sms.phoneNumber}"
                                   placeholder="+886 912345678"
                                   onchange="this.updateSetting('notifications.sms.phoneNumber', event.target.value)">
                        </div>
                        
                        <div class="setting-group indent">
                            <label>通知類型</label>
                            <div class="checkbox-group">
                                ${Object.entries(notifications.sms.types).map(([type, enabled]) => `
                                    <label>
                                        <input type="checkbox" ${enabled ? 'checked' : ''}
                                               onchange="this.updateSetting('notifications.sms.types.${type}', event.target.checked)">
                                        ${this.getNotificationTypeLabel(type)}
                                    </label>
                                `).join('')}
                            </div>
                        </div>
                    ` : ''}
                </div>
                
                <!-- Push Notifications -->
                <div class="notification-section">
                    <h4>推播通知</h4>
                    <div class="setting-group">
                        <label class="toggle-label">
                            <input type="checkbox" class="toggle-switch" 
                                   ${notifications.push.enabled ? 'checked' : ''}
                                   onchange="this.updateSetting('notifications.push.enabled', event.target.checked)">
                            <span class="toggle-slider"></span>
                            啟用推播通知
                        </label>
                    </div>
                    
                    ${notifications.push.enabled ? `
                        <div class="setting-group indent">
                            <label class="toggle-label">
                                <input type="checkbox" ${notifications.push.sound ? 'checked' : ''}
                                       onchange="this.updateSetting('notifications.push.sound', event.target.checked)">
                                通知音效
                            </label>
                        </div>
                        
                        <div class="setting-group indent">
                            <label class="toggle-label">
                                <input type="checkbox" ${notifications.push.vibration ? 'checked' : ''}
                                       onchange="this.updateSetting('notifications.push.vibration', event.target.checked)">
                                震動提醒
                            </label>
                        </div>
                    ` : ''}
                </div>
            </div>
        `;
    }

    /**
     * Render display settings tab
     */
    renderDisplaySettings() {
        const { display } = this.data.settings;
        return `
            <div class="tab-content display-settings">
                <h3>顯示設定</h3>
                
                <div class="setting-group">
                    <label for="theme">主題</label>
                    <div class="theme-selector">
                        <label class="theme-option ${display.theme === 'light' ? 'selected' : ''}">
                            <input type="radio" name="theme" value="light" 
                                   ${display.theme === 'light' ? 'checked' : ''}
                                   onchange="this.updateSetting('display.theme', 'light')">
                            <span class="theme-preview light">
                                <i class="icon-sun"></i>
                                淺色
                            </span>
                        </label>
                        <label class="theme-option ${display.theme === 'dark' ? 'selected' : ''}">
                            <input type="radio" name="theme" value="dark" 
                                   ${display.theme === 'dark' ? 'checked' : ''}
                                   onchange="this.updateSetting('display.theme', 'dark')">
                            <span class="theme-preview dark">
                                <i class="icon-moon"></i>
                                深色
                            </span>
                        </label>
                        <label class="theme-option ${display.theme === 'auto' ? 'selected' : ''}">
                            <input type="radio" name="theme" value="auto" 
                                   ${display.theme === 'auto' ? 'checked' : ''}
                                   onchange="this.updateSetting('display.theme', 'auto')">
                            <span class="theme-preview auto">
                                <i class="icon-auto"></i>
                                自動
                            </span>
                        </label>
                    </div>
                </div>
                
                <div class="setting-group">
                    <label for="density">顯示密度</label>
                    <select id="density" 
                            onchange="this.updateSetting('display.density', event.target.value)">
                        <option value="compact" ${display.density === 'compact' ? 'selected' : ''}>緊湊</option>
                        <option value="comfortable" ${display.density === 'comfortable' ? 'selected' : ''}>舒適</option>
                        <option value="spacious" ${display.density === 'spacious' ? 'selected' : ''}>寬鬆</option>
                    </select>
                </div>
                
                <div class="setting-group">
                    <label for="fontSize">字體大小</label>
                    <div class="font-size-selector">
                        <button class="size-option ${display.fontSize === 'small' ? 'selected' : ''}"
                                onclick="this.updateSetting('display.fontSize', 'small')">
                            <span style="font-size: 12px;">A</span>
                            <small>小</small>
                        </button>
                        <button class="size-option ${display.fontSize === 'medium' ? 'selected' : ''}"
                                onclick="this.updateSetting('display.fontSize', 'medium')">
                            <span style="font-size: 14px;">A</span>
                            <small>中</small>
                        </button>
                        <button class="size-option ${display.fontSize === 'large' ? 'selected' : ''}"
                                onclick="this.updateSetting('display.fontSize', 'large')">
                            <span style="font-size: 16px;">A</span>
                            <small>大</small>
                        </button>
                    </div>
                </div>
                
                <div class="setting-group">
                    <label class="toggle-label">
                        <input type="checkbox" class="toggle-switch" 
                               ${display.animations ? 'checked' : ''}
                               onchange="this.updateSetting('display.animations', event.target.checked)">
                        <span class="toggle-slider"></span>
                        啟用動畫效果
                    </label>
                </div>
                
                <div class="setting-group">
                    <label class="toggle-label">
                        <input type="checkbox" class="toggle-switch" 
                               ${display.reducedMotion ? 'checked' : ''}
                               onchange="this.updateSetting('display.reducedMotion', event.target.checked)">
                        <span class="toggle-slider"></span>
                        減少動態效果
                    </label>
                    <small class="setting-hint">為視覺敏感使用者減少動畫</small>
                </div>
                
                <div class="setting-group">
                    <label class="toggle-label">
                        <input type="checkbox" class="toggle-switch" 
                               ${display.highContrast ? 'checked' : ''}
                               onchange="this.updateSetting('display.highContrast', event.target.checked)">
                        <span class="toggle-slider"></span>
                        高對比模式
                    </label>
                    <small class="setting-hint">提高文字和背景的對比度</small>
                </div>
            </div>
        `;
    }

    /**
     * Render API settings tab
     */
    renderApiSettings() {
        const { api } = this.data.settings;
        return `
            <div class="tab-content api-settings">
                <h3>API 設定</h3>
                
                <div class="setting-group">
                    <label for="primaryEndpoint">主要端點</label>
                    <input type="url" id="primaryEndpoint" 
                           value="${api.endpoints.primary}"
                           placeholder="https://api.luckygas.com"
                           onchange="this.updateSetting('api.endpoints.primary', event.target.value)">
                    <button class="btn btn-small" onclick="this.testEndpoint('primary')">
                        測試連線
                    </button>
                </div>
                
                <div class="setting-group">
                    <label for="backupEndpoint">備用端點</label>
                    <input type="url" id="backupEndpoint" 
                           value="${api.endpoints.backup}"
                           placeholder="https://backup.luckygas.com"
                           onchange="this.updateSetting('api.endpoints.backup', event.target.value)">
                    ${api.endpoints.backup ? `
                        <button class="btn btn-small" onclick="this.testEndpoint('backup')">
                            測試連線
                        </button>
                    ` : ''}
                </div>
                
                <div class="setting-group">
                    <label for="timeout">請求超時 (毫秒)</label>
                    <input type="number" id="timeout" 
                           value="${api.timeout}"
                           min="5000" max="120000" step="1000"
                           onchange="this.updateSetting('api.timeout', parseInt(event.target.value))">
                    <small class="setting-hint">建議值: 30000 (30秒)</small>
                </div>
                
                <div class="setting-group">
                    <label for="retryAttempts">重試次數</label>
                    <input type="number" id="retryAttempts" 
                           value="${api.retryAttempts}"
                           min="0" max="10"
                           onchange="this.updateSetting('api.retryAttempts', parseInt(event.target.value))">
                </div>
                
                <div class="setting-group">
                    <label for="retryDelay">重試延遲 (毫秒)</label>
                    <input type="number" id="retryDelay" 
                           value="${api.retryDelay}"
                           min="100" max="10000" step="100"
                           onchange="this.updateSetting('api.retryDelay', parseInt(event.target.value))">
                </div>
                
                <div class="setting-group">
                    <label class="toggle-label">
                        <input type="checkbox" class="toggle-switch" 
                               ${api.compressionEnabled ? 'checked' : ''}
                               onchange="this.updateSetting('api.compressionEnabled', event.target.checked)">
                        <span class="toggle-slider"></span>
                        啟用資料壓縮
                    </label>
                    <small class="setting-hint">減少網路流量，但可能增加處理時間</small>
                </div>
                
                <div class="setting-group">
                    <label class="toggle-label">
                        <input type="checkbox" class="toggle-switch" 
                               ${api.cacheEnabled ? 'checked' : ''}
                               onchange="this.updateSetting('api.cacheEnabled', event.target.checked)">
                        <span class="toggle-slider"></span>
                        啟用快取
                    </label>
                </div>
                
                ${api.cacheEnabled ? `
                    <div class="setting-group indent">
                        <label for="cacheDuration">快取持續時間 (秒)</label>
                        <input type="number" id="cacheDuration" 
                               value="${api.cacheDuration}"
                               min="60" max="3600" step="60"
                               onchange="this.updateSetting('api.cacheDuration', parseInt(event.target.value))">
                        <button class="btn btn-small" onclick="this.clearCache()">
                            清除快取
                        </button>
                    </div>
                ` : ''}
            </div>
        `;
    }

    /**
     * Render security settings tab
     */
    renderSecuritySettings() {
        const { security } = this.data.settings;
        return `
            <div class="tab-content security-settings">
                <h3>安全設定</h3>
                
                <div class="setting-group">
                    <label for="sessionTimeout">閒置登出時間 (分鐘)</label>
                    <input type="number" id="sessionTimeout" 
                           value="${security.sessionTimeout}"
                           min="5" max="120" step="5"
                           onchange="this.updateSetting('security.sessionTimeout', parseInt(event.target.value))">
                    <small class="setting-hint">閒置超過此時間將自動登出</small>
                </div>
                
                <div class="setting-group">
                    <label class="toggle-label">
                        <input type="checkbox" class="toggle-switch" 
                               ${security.autoLock ? 'checked' : ''}
                               onchange="this.updateSetting('security.autoLock', event.target.checked)">
                        <span class="toggle-slider"></span>
                        自動鎖定
                    </label>
                    <small class="setting-hint">閒置時自動鎖定畫面</small>
                </div>
                
                ${security.autoLock ? `
                    <div class="setting-group indent">
                        <label for="autoLockDelay">自動鎖定延遲 (分鐘)</label>
                        <input type="number" id="autoLockDelay" 
                               value="${security.autoLockDelay}"
                               min="1" max="30"
                               onchange="this.updateSetting('security.autoLockDelay', parseInt(event.target.value))">
                    </div>
                ` : ''}
                
                <div class="setting-group">
                    <label class="toggle-label">
                        <input type="checkbox" class="toggle-switch" 
                               ${security.twoFactorAuth ? 'checked' : ''}
                               onchange="this.toggleTwoFactorAuth(event.target.checked)">
                        <span class="toggle-slider"></span>
                        雙重驗證
                    </label>
                    <small class="setting-hint">提供額外的帳戶保護</small>
                </div>
                
                <div class="setting-group">
                    <label class="toggle-label">
                        <input type="checkbox" class="toggle-switch" 
                               ${security.rememberDevice ? 'checked' : ''}
                               onchange="this.updateSetting('security.rememberDevice', event.target.checked)">
                        <span class="toggle-slider"></span>
                        記住此裝置
                    </label>
                    <small class="setting-hint">在此裝置上保持登入狀態</small>
                </div>
                
                <div class="setting-group">
                    <label class="toggle-label">
                        <input type="checkbox" class="toggle-switch" 
                               ${security.biometricAuth ? 'checked' : ''}
                               ${!this.isBiometricAvailable() ? 'disabled' : ''}
                               onchange="this.toggleBiometricAuth(event.target.checked)">
                        <span class="toggle-slider"></span>
                        生物識別驗證
                    </label>
                    <small class="setting-hint">
                        ${this.isBiometricAvailable() ? '使用指紋或臉部識別' : '此裝置不支援生物識別'}
                    </small>
                </div>
                
                <div class="setting-section">
                    <h4>登入記錄</h4>
                    <button class="btn btn-secondary" onclick="this.viewLoginHistory()">
                        檢視登入記錄
                    </button>
                    <button class="btn btn-secondary" onclick="this.manageDevices()">
                        管理裝置
                    </button>
                </div>
            </div>
        `;
    }

    /**
     * Render data management settings tab
     */
    renderDataSettings() {
        const { data } = this.data.settings;
        return `
            <div class="tab-content data-settings">
                <h3>資料管理</h3>
                
                <div class="setting-section">
                    <h4>自動匯出</h4>
                    <div class="setting-group">
                        <label class="toggle-label">
                            <input type="checkbox" class="toggle-switch" 
                                   ${data.autoExport ? 'checked' : ''}
                                   onchange="this.updateSetting('data.autoExport', event.target.checked)">
                            <span class="toggle-slider"></span>
                            啟用自動匯出
                        </label>
                    </div>
                    
                    ${data.autoExport ? `
                        <div class="setting-group indent">
                            <label for="exportFormat">匯出格式</label>
                            <select id="exportFormat" 
                                    onchange="this.updateSetting('data.exportFormat', event.target.value)">
                                <option value="json" ${data.exportFormat === 'json' ? 'selected' : ''}>JSON</option>
                                <option value="csv" ${data.exportFormat === 'csv' ? 'selected' : ''}>CSV</option>
                                <option value="excel" ${data.exportFormat === 'excel' ? 'selected' : ''}>Excel</option>
                            </select>
                        </div>
                        
                        <div class="setting-group indent">
                            <label for="exportSchedule">匯出頻率</label>
                            <select id="exportSchedule" 
                                    onchange="this.updateSetting('data.exportSchedule', event.target.value)">
                                <option value="daily" ${data.exportSchedule === 'daily' ? 'selected' : ''}>每日</option>
                                <option value="weekly" ${data.exportSchedule === 'weekly' ? 'selected' : ''}>每週</option>
                                <option value="monthly" ${data.exportSchedule === 'monthly' ? 'selected' : ''}>每月</option>
                            </select>
                        </div>
                    ` : ''}
                </div>
                
                <div class="setting-section">
                    <h4>備份設定</h4>
                    <div class="setting-group">
                        <label class="toggle-label">
                            <input type="checkbox" class="toggle-switch" 
                                   ${data.autoBackup ? 'checked' : ''}
                                   onchange="this.updateSetting('data.autoBackup', event.target.checked)">
                            <span class="toggle-slider"></span>
                            自動備份
                        </label>
                    </div>
                    
                    ${data.autoBackup ? `
                        <div class="setting-group indent">
                            <label for="backupRetention">備份保留天數</label>
                            <input type="number" id="backupRetention" 
                                   value="${data.backupRetention}"
                                   min="7" max="365" step="7"
                                   onchange="this.updateSetting('data.backupRetention', parseInt(event.target.value))">
                        </div>
                    ` : ''}
                    
                    <div class="setting-group">
                        <button class="btn btn-secondary" onclick="this.backupNow()">
                            立即備份
                        </button>
                        <button class="btn btn-secondary" onclick="this.restoreBackup()">
                            還原備份
                        </button>
                    </div>
                </div>
                
                <div class="setting-section">
                    <h4>資料清理</h4>
                    <div class="setting-group">
                        <label class="toggle-label">
                            <input type="checkbox" class="toggle-switch" 
                                   ${data.dataCleanup.enabled ? 'checked' : ''}
                                   onchange="this.updateSetting('data.dataCleanup.enabled', event.target.checked)">
                            <span class="toggle-slider"></span>
                            自動清理舊資料
                        </label>
                    </div>
                    
                    ${data.dataCleanup.enabled ? `
                        <div class="setting-group indent">
                            <label for="cleanupAge">清理超過天數的資料</label>
                            <input type="number" id="cleanupAge" 
                                   value="${data.dataCleanup.olderThan}"
                                   min="30" max="730" step="30"
                                   onchange="this.updateSetting('data.dataCleanup.olderThan', parseInt(event.target.value))">
                        </div>
                    ` : ''}
                    
                    <div class="setting-group">
                        <button class="btn btn-warning" onclick="this.cleanupData()">
                            手動清理資料
                        </button>
                        <button class="btn btn-danger" onclick="this.clearAllData()">
                            清除所有資料
                        </button>
                    </div>
                </div>
                
                <div class="setting-section">
                    <h4>儲存空間</h4>
                    <div class="storage-info">
                        <div class="storage-item">
                            <span>應用程式資料:</span>
                            <span>${this.filters.formatBytes(this.getStorageSize('app'))}</span>
                        </div>
                        <div class="storage-item">
                            <span>快取資料:</span>
                            <span>${this.filters.formatBytes(this.getStorageSize('cache'))}</span>
                        </div>
                        <div class="storage-item">
                            <span>總使用空間:</span>
                            <span>${this.filters.formatBytes(this.getStorageSize('total'))}</span>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Switch active tab
     */
    switchTab(tabId) {
        this.data.activeTab = tabId;
    }

    /**
     * Update a setting value
     */
    updateSetting(path, value) {
        const keys = path.split('.');
        let target = this.data.settings;
        
        for (let i = 0; i < keys.length - 1; i++) {
            target = target[keys[i]];
        }
        
        const oldValue = target[keys[keys.length - 1]];
        target[keys[keys.length - 1]] = value;
        
        // Add to change history
        this.data.changeHistory.push({
            path,
            oldValue,
            newValue: value,
            timestamp: new Date().toISOString()
        });
        
        // Mark as having unsaved changes
        this.data.unsavedChanges = true;
    }

    /**
     * Check if settings have changed
     */
    checkForChanges() {
        const current = JSON.stringify(this.data.settings);
        const original = JSON.stringify(this.data.originalSettings);
        this.data.unsavedChanges = current !== original;
    }

    /**
     * Save settings
     */
    async saveSettings() {
        if (!this.data.unsavedChanges || this.data.saveInProgress) return;
        
        this.data.saveInProgress = true;
        
        try {
            // Validate settings
            const errors = this.validateSettings();
            if (Object.keys(errors).length > 0) {
                this.data.validationErrors = errors;
                this.showValidationErrors();
                return;
            }
            
            // Save to localStorage
            localStorage.setItem(
                window.APP_CONFIG?.STORAGE_KEYS?.USER_PREFERENCES || 'user_preferences',
                JSON.stringify(this.data.settings)
            );
            
            // Update global state
            store.dispatch('settings.update', this.data.settings);
            
            // Apply settings globally
            this.applySettings();
            
            // Update original settings
            this.data.originalSettings = JSON.parse(JSON.stringify(this.data.settings));
            this.data.unsavedChanges = false;
            
            // Show success message
            this.showNotification('設定已儲存', 'success');
            
        } catch (error) {
            console.error('Error saving settings:', error);
            this.showNotification('儲存設定時發生錯誤', 'error');
        } finally {
            this.data.saveInProgress = false;
        }
    }

    /**
     * Cancel unsaved changes
     */
    cancelChanges() {
        if (!this.data.unsavedChanges) return;
        
        if (confirm('確定要取消所有未儲存的變更嗎？')) {
            this.data.settings = JSON.parse(JSON.stringify(this.data.originalSettings));
            this.data.unsavedChanges = false;
            this.data.changeHistory = [];
        }
    }

    /**
     * Reset to default settings
     */
    resetSettings() {
        if (confirm('確定要將所有設定重設為預設值嗎？這將清除所有自訂設定。')) {
            // Reset to defaults
            this.data.settings = this.getDefaultSettings();
            this.data.unsavedChanges = true;
            
            this.showNotification('設定已重設為預設值', 'info');
        }
    }

    /**
     * Get default settings
     */
    getDefaultSettings() {
        return {
            general: {
                language: 'zh-TW',
                timezone: 'Asia/Taipei',
                dateFormat: 'YYYY-MM-DD',
                timeFormat: '24h',
                startOfWeek: 'monday',
                numberFormat: 'comma'
            },
            notifications: {
                email: {
                    enabled: true,
                    frequency: 'instant',
                    types: {
                        deliveryAssigned: true,
                        deliveryCompleted: true,
                        deliveryFailed: true,
                        systemAlerts: true
                    }
                },
                sms: {
                    enabled: false,
                    phoneNumber: '',
                    types: {
                        urgentDeliveries: true,
                        systemAlerts: false
                    }
                },
                push: {
                    enabled: true,
                    sound: true,
                    vibration: true,
                    types: {
                        all: true
                    }
                }
            },
            display: {
                theme: 'light',
                density: 'comfortable',
                animations: true,
                reducedMotion: false,
                fontSize: 'medium',
                highContrast: false
            },
            api: {
                endpoints: {
                    primary: window.APP_CONFIG?.API?.BASE_URL || 'http://localhost:8000/api',
                    backup: ''
                },
                timeout: 30000,
                retryAttempts: 3,
                retryDelay: 1000,
                compressionEnabled: true,
                cacheEnabled: true,
                cacheDuration: 300
            },
            security: {
                sessionTimeout: 30,
                autoLock: false,
                autoLockDelay: 5,
                twoFactorAuth: false,
                rememberDevice: true,
                biometricAuth: false
            },
            data: {
                autoExport: false,
                exportFormat: 'json',
                exportSchedule: 'weekly',
                autoBackup: true,
                backupRetention: 30,
                dataCleanup: {
                    enabled: false,
                    olderThan: 365
                }
            }
        };
    }

    /**
     * Export settings to JSON
     */
    async exportSettings() {
        this.data.importExportProgress = true;
        
        try {
            const exportData = {
                version: '1.0',
                timestamp: new Date().toISOString(),
                settings: this.data.settings
            };
            
            const blob = new Blob([JSON.stringify(exportData, null, 2)], {
                type: 'application/json'
            });
            
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `luckygas-settings-${new Date().toISOString().split('T')[0]}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            
            this.showNotification('設定已匯出', 'success');
        } catch (error) {
            console.error('Error exporting settings:', error);
            this.showNotification('匯出設定時發生錯誤', 'error');
        } finally {
            this.data.importExportProgress = false;
        }
    }

    /**
     * Import settings from JSON
     */
    async importSettings() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        
        input.onchange = async (event) => {
            const file = event.target.files[0];
            if (!file) return;
            
            this.data.importExportProgress = true;
            
            try {
                const text = await file.text();
                const importData = JSON.parse(text);
                
                // Validate import data
                if (!importData.version || !importData.settings) {
                    throw new Error('Invalid settings file format');
                }
                
                // Confirm import
                if (confirm('確定要匯入這些設定嗎？這將覆蓋您目前的設定。')) {
                    this.data.settings = importData.settings;
                    this.data.unsavedChanges = true;
                    
                    this.showNotification('設定已匯入', 'success');
                }
            } catch (error) {
                console.error('Error importing settings:', error);
                this.showNotification('匯入設定時發生錯誤', 'error');
            } finally {
                this.data.importExportProgress = false;
            }
        };
        
        input.click();
    }

    /**
     * Load settings from localStorage
     */
    loadSettings() {
        try {
            const stored = localStorage.getItem(
                window.APP_CONFIG?.STORAGE_KEYS?.USER_PREFERENCES || 'user_preferences'
            );
            
            if (stored) {
                const settings = JSON.parse(stored);
                // Deep merge with defaults to ensure all properties exist
                this.data.settings = this.mergeSettings(this.getDefaultSettings(), settings);
            }
        } catch (error) {
            console.error('Error loading settings:', error);
        }
    }

    /**
     * Deep merge settings objects
     */
    mergeSettings(defaults, overrides) {
        const merged = { ...defaults };
        
        for (const key in overrides) {
            if (typeof overrides[key] === 'object' && !Array.isArray(overrides[key])) {
                merged[key] = this.mergeSettings(defaults[key] || {}, overrides[key]);
            } else {
                merged[key] = overrides[key];
            }
        }
        
        return merged;
    }

    /**
     * Apply settings globally
     */
    applySettings() {
        // Apply theme
        this.applyTheme(this.data.settings.display.theme);
        
        // Apply density
        document.body.setAttribute('data-density', this.data.settings.display.density);
        
        // Apply font size
        document.body.setAttribute('data-font-size', this.data.settings.display.fontSize);
        
        // Apply animations
        document.body.classList.toggle('no-animations', !this.data.settings.display.animations);
        
        // Apply reduced motion
        document.body.classList.toggle('reduced-motion', this.data.settings.display.reducedMotion);
        
        // Apply high contrast
        document.body.classList.toggle('high-contrast', this.data.settings.display.highContrast);
        
        // Update locale
        this.updateLocale(this.data.settings.general.language);
    }

    /**
     * Apply theme
     */
    applyTheme(theme) {
        if (theme === 'auto') {
            // Check system preference
            const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
            theme = prefersDark ? 'dark' : 'light';
        }
        
        document.body.setAttribute('data-theme', theme);
    }

    /**
     * Validate settings
     */
    validateSettings() {
        const errors = {};
        const { settings } = this.data;
        
        // Validate phone number if SMS is enabled
        if (settings.notifications.sms.enabled && !settings.notifications.sms.phoneNumber) {
            errors['notifications.sms.phoneNumber'] = '請輸入手機號碼';
        }
        
        // Validate API endpoints
        if (!settings.api.endpoints.primary) {
            errors['api.endpoints.primary'] = '請輸入主要 API 端點';
        } else if (!this.isValidUrl(settings.api.endpoints.primary)) {
            errors['api.endpoints.primary'] = '請輸入有效的網址';
        }
        
        if (settings.api.endpoints.backup && !this.isValidUrl(settings.api.endpoints.backup)) {
            errors['api.endpoints.backup'] = '請輸入有效的網址';
        }
        
        return errors;
    }

    /**
     * Helper methods
     */
    formatDate(date, format) {
        // Simple date formatting
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        
        return format
            .replace('YYYY', year)
            .replace('MM', month)
            .replace('DD', day)
            .replace('年', '年')
            .replace('月', '月')
            .replace('日', '日');
    }

    getNotificationTypeLabel(type) {
        const labels = {
            deliveryAssigned: '配送指派通知',
            deliveryCompleted: '配送完成通知',
            deliveryFailed: '配送失敗通知',
            systemAlerts: '系統警示',
            urgentDeliveries: '緊急配送'
        };
        return labels[type] || type;
    }

    isValidUrl(url) {
        try {
            new URL(url);
            return true;
        } catch {
            return false;
        }
    }

    isBiometricAvailable() {
        // Check for WebAuthn support
        return window.PublicKeyCredential !== undefined;
    }

    getStorageSize(type) {
        // Placeholder for storage calculation
        const sizes = {
            app: 15728640,    // 15 MB
            cache: 5242880,   // 5 MB
            total: 20971520   // 20 MB
        };
        return sizes[type] || 0;
    }

    updateLocale(language) {
        // Update global locale
        if (window.i18n) {
            window.i18n.setLocale(language);
        }
    }

    showNotification(message, type = 'info') {
        // Use global notification system if available
        if (window.showNotification) {
            window.showNotification(message, type);
        } else {
            console.log(`[${type}] ${message}`);
        }
    }

    showValidationErrors() {
        // Show validation errors
        const errorMessages = Object.entries(this.data.validationErrors)
            .map(([field, message]) => `${field}: ${message}`)
            .join('\n');
        
        alert('請修正以下錯誤：\n' + errorMessages);
    }

    // Additional action methods
    async testEndpoint(type) {
        const endpoint = this.data.settings.api.endpoints[type];
        if (!endpoint) return;
        
        try {
            const response = await fetch(endpoint + '/health', {
                method: 'GET',
                timeout: 5000
            });
            
            if (response.ok) {
                this.showNotification(`${type === 'primary' ? '主要' : '備用'}端點連線成功`, 'success');
            } else {
                this.showNotification(`${type === 'primary' ? '主要' : '備用'}端點連線失敗`, 'error');
            }
        } catch (error) {
            this.showNotification(`無法連接到${type === 'primary' ? '主要' : '備用'}端點`, 'error');
        }
    }

    toggleTwoFactorAuth(enabled) {
        if (enabled) {
            // Show 2FA setup modal
            this.show2FASetup();
        } else {
            // Confirm disable
            if (confirm('確定要停用雙重驗證嗎？這會降低帳戶安全性。')) {
                this.updateSetting('security.twoFactorAuth', false);
            }
        }
    }

    toggleBiometricAuth(enabled) {
        if (enabled && this.isBiometricAvailable()) {
            // Setup biometric auth
            this.setupBiometricAuth();
        } else {
            this.updateSetting('security.biometricAuth', false);
        }
    }

    show2FASetup() {
        // Placeholder for 2FA setup modal
        alert('雙重驗證設定功能開發中');
    }

    setupBiometricAuth() {
        // Placeholder for biometric setup
        alert('生物識別設定功能開發中');
    }

    viewLoginHistory() {
        // Placeholder
        alert('登入記錄功能開發中');
    }

    manageDevices() {
        // Placeholder
        alert('裝置管理功能開發中');
    }

    clearCache() {
        if (confirm('確定要清除所有快取資料嗎？')) {
            // Clear cache implementation
            this.showNotification('快取已清除', 'success');
        }
    }

    backupNow() {
        // Placeholder
        alert('立即備份功能開發中');
    }

    restoreBackup() {
        // Placeholder
        alert('還原備份功能開發中');
    }

    cleanupData() {
        if (confirm('確定要清理舊資料嗎？這個操作無法復原。')) {
            // Cleanup implementation
            this.showNotification('資料清理完成', 'success');
        }
    }

    clearAllData() {
        if (confirm('確定要清除所有資料嗎？這個操作無法復原！')) {
            if (confirm('這將刪除所有應用程式資料。請再次確認。')) {
                // Clear all data
                localStorage.clear();
                sessionStorage.clear();
                this.showNotification('所有資料已清除', 'success');
                
                // Reload app
                setTimeout(() => {
                    window.location.reload();
                }, 1000);
            }
        }
    }

    /**
     * Component styles
     */
    static get styles() {
        return `
            .settings-container {
                display: flex;
                flex-direction: column;
                height: 100%;
                background: var(--bg-primary);
            }
            
            .settings-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 1.5rem;
                border-bottom: 1px solid var(--border-color);
            }
            
            .settings-header h2 {
                margin: 0;
                font-size: 1.5rem;
                color: var(--text-primary);
            }
            
            .settings-actions {
                display: flex;
                gap: 1rem;
                align-items: center;
            }
            
            .unsaved-indicator {
                color: var(--color-warning);
                font-size: 0.875rem;
                font-weight: 500;
            }
            
            .settings-tabs {
                display: flex;
                background: var(--bg-secondary);
                border-bottom: 1px solid var(--border-color);
                overflow-x: auto;
            }
            
            .tab-button {
                display: flex;
                align-items: center;
                gap: 0.5rem;
                padding: 1rem 1.5rem;
                background: none;
                border: none;
                cursor: pointer;
                font-size: 0.875rem;
                color: var(--text-secondary);
                white-space: nowrap;
                transition: all 0.2s;
                border-bottom: 2px solid transparent;
            }
            
            .tab-button:hover {
                background: var(--bg-hover);
                color: var(--text-primary);
            }
            
            .tab-button.active {
                color: var(--color-primary);
                border-bottom-color: var(--color-primary);
            }
            
            .tab-icon {
                font-size: 1.25rem;
            }
            
            .settings-content {
                flex: 1;
                overflow-y: auto;
                padding: 2rem;
            }
            
            .tab-content {
                max-width: 800px;
                margin: 0 auto;
            }
            
            .tab-content h3 {
                margin: 0 0 2rem 0;
                font-size: 1.25rem;
                color: var(--text-primary);
            }
            
            .tab-content h4 {
                margin: 2rem 0 1rem 0;
                font-size: 1.1rem;
                color: var(--text-primary);
            }
            
            .setting-group {
                margin-bottom: 1.5rem;
            }
            
            .setting-group.indent {
                margin-left: 2rem;
            }
            
            .setting-group label {
                display: block;
                margin-bottom: 0.5rem;
                font-size: 0.875rem;
                font-weight: 500;
                color: var(--text-primary);
            }
            
            .setting-group input[type="text"],
            .setting-group input[type="url"],
            .setting-group input[type="tel"],
            .setting-group input[type="number"],
            .setting-group select {
                width: 100%;
                padding: 0.5rem 0.75rem;
                border: 1px solid var(--border-color);
                border-radius: 4px;
                font-size: 0.875rem;
                background: var(--bg-primary);
                color: var(--text-primary);
            }
            
            .setting-group input[type="number"] {
                max-width: 150px;
            }
            
            .setting-hint {
                display: block;
                margin-top: 0.25rem;
                font-size: 0.75rem;
                color: var(--text-tertiary);
            }
            
            .setting-preview {
                margin-top: 0.5rem;
                font-size: 0.75rem;
                color: var(--text-secondary);
            }
            
            .toggle-label {
                display: flex;
                align-items: center;
                cursor: pointer;
                user-select: none;
            }
            
            .toggle-switch {
                position: relative;
                width: 0;
                height: 0;
                opacity: 0;
            }
            
            .toggle-slider {
                position: relative;
                display: inline-block;
                width: 44px;
                height: 24px;
                background: var(--bg-tertiary);
                border-radius: 12px;
                margin-right: 0.75rem;
                transition: background 0.2s;
            }
            
            .toggle-slider::after {
                content: '';
                position: absolute;
                top: 2px;
                left: 2px;
                width: 20px;
                height: 20px;
                background: white;
                border-radius: 50%;
                transition: transform 0.2s;
            }
            
            .toggle-switch:checked + .toggle-slider {
                background: var(--color-primary);
            }
            
            .toggle-switch:checked + .toggle-slider::after {
                transform: translateX(20px);
            }
            
            .radio-group {
                display: flex;
                flex-direction: column;
                gap: 0.75rem;
            }
            
            .radio-group label {
                display: flex;
                align-items: center;
                cursor: pointer;
                font-weight: normal;
            }
            
            .radio-group input[type="radio"] {
                margin-right: 0.5rem;
            }
            
            .checkbox-group {
                display: flex;
                flex-direction: column;
                gap: 0.75rem;
            }
            
            .checkbox-group label {
                display: flex;
                align-items: center;
                cursor: pointer;
                font-weight: normal;
            }
            
            .checkbox-group input[type="checkbox"] {
                margin-right: 0.5rem;
            }
            
            .theme-selector {
                display: flex;
                gap: 1rem;
                margin-top: 0.5rem;
            }
            
            .theme-option {
                position: relative;
                cursor: pointer;
            }
            
            .theme-option input {
                position: absolute;
                opacity: 0;
            }
            
            .theme-preview {
                display: flex;
                flex-direction: column;
                align-items: center;
                gap: 0.5rem;
                padding: 1rem;
                border: 2px solid var(--border-color);
                border-radius: 8px;
                transition: all 0.2s;
            }
            
            .theme-preview i {
                font-size: 2rem;
            }
            
            .theme-option.selected .theme-preview,
            .theme-option input:checked + .theme-preview {
                border-color: var(--color-primary);
                background: var(--color-primary-light);
            }
            
            .theme-preview.light {
                background: #ffffff;
                color: #333333;
            }
            
            .theme-preview.dark {
                background: #1a1a1a;
                color: #ffffff;
            }
            
            .theme-preview.auto {
                background: linear-gradient(135deg, #ffffff 50%, #1a1a1a 50%);
                color: #666666;
            }
            
            .font-size-selector {
                display: flex;
                gap: 0.5rem;
                margin-top: 0.5rem;
            }
            
            .size-option {
                display: flex;
                flex-direction: column;
                align-items: center;
                gap: 0.25rem;
                padding: 0.75rem 1.5rem;
                border: 2px solid var(--border-color);
                border-radius: 4px;
                background: none;
                cursor: pointer;
                transition: all 0.2s;
            }
            
            .size-option:hover {
                border-color: var(--color-primary);
            }
            
            .size-option.selected {
                border-color: var(--color-primary);
                background: var(--color-primary-light);
            }
            
            .notification-section {
                margin-bottom: 2rem;
                padding-bottom: 2rem;
                border-bottom: 1px solid var(--border-divider);
            }
            
            .notification-section:last-child {
                border-bottom: none;
            }
            
            .setting-section {
                margin-top: 2rem;
                padding-top: 2rem;
                border-top: 1px solid var(--border-divider);
            }
            
            .setting-section:first-child {
                margin-top: 0;
                padding-top: 0;
                border-top: none;
            }
            
            .storage-info {
                background: var(--bg-secondary);
                padding: 1rem;
                border-radius: 4px;
                margin-top: 1rem;
            }
            
            .storage-item {
                display: flex;
                justify-content: space-between;
                padding: 0.5rem 0;
            }
            
            .storage-item:not(:last-child) {
                border-bottom: 1px solid var(--border-divider);
            }
            
            .settings-footer {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 1.5rem;
                border-top: 1px solid var(--border-color);
                background: var(--bg-secondary);
            }
            
            .footer-actions {
                display: flex;
                gap: 1rem;
            }
            
            .settings-overlay {
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: rgba(0, 0, 0, 0.5);
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 1000;
            }
            
            .progress-modal {
                background: var(--bg-primary);
                padding: 2rem;
                border-radius: 8px;
                text-align: center;
                box-shadow: 0 4px 20px rgba(0, 0, 0, 0.2);
            }
            
            .spinner {
                width: 40px;
                height: 40px;
                border: 3px solid var(--border-color);
                border-top-color: var(--color-primary);
                border-radius: 50%;
                animation: spin 1s linear infinite;
                margin: 0 auto 1rem;
            }
            
            @keyframes spin {
                to { transform: rotate(360deg); }
            }
            
            /* Button styles */
            .btn {
                padding: 0.5rem 1rem;
                border: 1px solid transparent;
                border-radius: 4px;
                font-size: 0.875rem;
                font-weight: 500;
                cursor: pointer;
                transition: all 0.2s;
                text-decoration: none;
                display: inline-flex;
                align-items: center;
                gap: 0.5rem;
            }
            
            .btn:disabled {
                opacity: 0.5;
                cursor: not-allowed;
            }
            
            .btn-primary {
                background: var(--color-primary);
                color: white;
            }
            
            .btn-primary:hover:not(:disabled) {
                background: var(--color-primary-dark);
            }
            
            .btn-secondary {
                background: var(--bg-secondary);
                color: var(--text-primary);
                border-color: var(--border-color);
            }
            
            .btn-secondary:hover:not(:disabled) {
                background: var(--bg-tertiary);
            }
            
            .btn-warning {
                background: var(--color-warning);
                color: white;
            }
            
            .btn-warning:hover:not(:disabled) {
                background: var(--color-warning-dark);
            }
            
            .btn-danger {
                background: var(--color-danger);
                color: white;
            }
            
            .btn-danger:hover:not(:disabled) {
                background: var(--color-danger-dark);
            }
            
            .btn-small {
                padding: 0.25rem 0.75rem;
                font-size: 0.75rem;
            }
            
            /* Dark theme adjustments */
            [data-theme="dark"] .settings-container {
                background: #0a0a0a;
            }
            
            [data-theme="dark"] .settings-header,
            [data-theme="dark"] .settings-footer {
                background: #1a1a1a;
                border-color: #333;
            }
            
            [data-theme="dark"] .settings-tabs {
                background: #1a1a1a;
                border-color: #333;
            }
            
            [data-theme="dark"] .tab-button:hover {
                background: #2a2a2a;
            }
            
            [data-theme="dark"] input,
            [data-theme="dark"] select {
                background: #1a1a1a;
                border-color: #333;
                color: #e0e0e0;
            }
            
            [data-theme="dark"] .storage-info {
                background: #1a1a1a;
            }
            
            /* Responsive design */
            @media (max-width: 768px) {
                .settings-content {
                    padding: 1rem;
                }
                
                .settings-tabs {
                    overflow-x: auto;
                    -webkit-overflow-scrolling: touch;
                }
                
                .tab-button {
                    padding: 0.75rem 1rem;
                }
                
                .tab-label {
                    display: none;
                }
                
                .theme-selector {
                    flex-direction: column;
                }
                
                .font-size-selector {
                    flex-wrap: wrap;
                }
                
                .settings-footer {
                    flex-direction: column;
                    gap: 1rem;
                }
                
                .footer-actions {
                    width: 100%;
                    justify-content: flex-end;
                }
            }
        `;
    }
}

// Export the component
export default Settings;