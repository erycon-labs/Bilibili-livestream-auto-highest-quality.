// ==UserScript==
// @name         B站直播自动选择最高清晰度
// @namespace    http://tampermonkey.net/
// @version      1.3.0
// @description  鼠标放在清晰度按钮上后，自动选择B站直播最高清晰度
// @author       none
// @match        *://live.bilibili.com/*
// @icon         https://www.bilibili.com/favicon.ico
// @grant        none
// @run-at       document-idle
// @license      MIT
// @downloadURL https://update.greasyfork.org/scripts/537861/B%E7%AB%99%E7%9B%B4%E6%92%AD%E8%87%AA%E5%8A%A8%E9%80%89%E6%8B%A9%E6%9C%80%E9%AB%98%E6%B8%85%E6%99%B0%E5%BA%A6.user.js
// @updateURL https://update.greasyfork.org/scripts/537861/B%E7%AB%99%E7%9B%B4%E6%92%AD%E8%87%AA%E5%8A%A8%E9%80%89%E6%8B%A9%E6%9C%80%E9%AB%98%E6%B8%85%E6%99%B0%E5%BA%A6.meta.js
// ==/UserScript==

(function() {
    'use strict';

    // 配置对象
    const CONFIG = {
        MAX_ATTEMPTS: 60,
        INTERVAL: 1000,
        INITIAL_DELAY: 2000,
        QUALITY_PREFERENCES: [
            '原画',// 最高优先级
            '蓝光',// 蓝光
            '超清',// 超清
            '高清',// 高清
            '流畅',// 流畅
            '1080P',// 1080P
            '720P',// 720P
            '480P'// 480P
        ],
        SELECTOR_CANDIDATES: [
            '.list-it.svelte-1n48lz1',
            '[class*="list-it"][class*="quality"]',
            '[class*="list-it"]',
            '[class*="quality-item"]',
            '[class*="resolution"]',
            '[data-quality]',
            '.bilibili-live-player-video-quality-item',
            '.quality-option'
        ]
    };

    class QualitySelector {
        constructor() {
            this.attempts = 0;
            this.isRunning = false;
            this.observer = null;
        }

        /**
         * 按优先级查找最佳清晰度选项
         */
        findBestQualityOption() {
            // 遍历所有候选选择器
            for (const selector of CONFIG.SELECTOR_CANDIDATES) {
                const elements = document.querySelectorAll(selector);

                if (elements.length > 0) {
                    // 按优先级查找
                    for (const qualityText of CONFIG.QUALITY_PREFERENCES) {
                        for (const element of elements) {
                            if (element.textContent.includes(qualityText)) {
                                console.log(`✅ 找到清晰度选项: ${element.textContent.trim()}`);
                                return element;
                            }
                        }
                    }

                    // 如果按优先级没找到，返回第一个匹配的元素
                    console.log(`🔍 找到候选元素，但未按优先级匹配`);
                    return elements[0];
                }
            }

            return null;
        }

        /**
         * 点击清晰度选项
         */
        clickQualityOption(option) {
            if (!option) return false;

            try {
                // 模拟真实点击事件
                const clickEvent = new MouseEvent('click', {
                    bubbles: true,
                    cancelable: true,
                    view: window
                });

                option.dispatchEvent(clickEvent);
                console.log(`✅ 成功选择清晰度: ${option.textContent.trim()}`);
                return true;
            } catch (error) {
                console.error('❌ 点击清晰度选项失败:', error);
                return false;
            }
        }

        /**
         * 检查并选择清晰度
         */
        async checkAndSelectQuality() {
            if (this.attempts++ > CONFIG.MAX_ATTEMPTS) {
                console.log('⚠️ 达到最大尝试次数，停止检测');
                this.stop();
                return;
            }

            try {
                const qualityOption = this.findBestQualityOption();

                if (qualityOption) {
                    if (this.clickQualityOption(qualityOption)) {
                        console.log('🎉 清晰度选择完成');
                        this.stop();
                        return true;
                    }
                } else {
                    console.log(`⏳ 第${this.attempts}次检测未找到清晰度选项`);
                }
            } catch (error) {
                console.error('❌ 检测过程中出错:', error);
            }

            // 继续下一次检测
            setTimeout(() => this.checkAndSelectQuality(), CONFIG.INTERVAL);
            return false;
        }

        /**
         * 监听DOM变化
         */
        setupDOMObserver() {
            if (this.observer) {
                this.observer.disconnect();
            }

            this.observer = new MutationObserver((mutations) => {
                let shouldCheck = false;

                for (const mutation of mutations) {
                    if (mutation.type === 'childList') {
                        for (const addedNode of mutation.addedNodes) {
                            if (addedNode.nodeType === Node.ELEMENT_NODE) {
                                // 检查新增节点是否包含清晰度相关的类名
                                const hasQualityRelatedClass = CONFIG.SELECTOR_CANDIDATES.some(
                                    selector => addedNode.matches?.(selector) || 
                                    addedNode.querySelector?.(selector)
                                );

                                if (hasQualityRelatedClass) {
                                    shouldCheck = true;
                                    break;
                                }
                            }
                        }
                    }

                    if (shouldCheck) break;
                }

                if (shouldCheck) {
                    console.log('🔍 DOM变化检测到，准备重新检查清晰度选项...');
                    // 延迟一下再检查，确保DOM完全渲染
                    setTimeout(() => {
                        if (this.isRunning) {
                            this.checkAndSelectQuality();
                        }
                    }, 500);
                }
            });

            this.observer.observe(document.body, {
                childList: true,
                subtree: true
            });
        }

        /**
         * 启动脚本
         */
        start() {
            if (this.isRunning) return;

            this.isRunning = true;
            this.attempts = 0;

            console.log('🚀 B站直播清晰度自动选择脚本启动');
            console.log(`📋 配置: 最大尝试${CONFIG.MAX_ATTEMPTS}次, 间隔${CONFIG.INTERVAL}ms`);

            // 设置DOM观察器
            this.setupDOMObserver();

            // 开始检测
            setTimeout(() => {
                if (this.isRunning) {
                    this.checkAndSelectQuality();
                }
            }, CONFIG.INITIAL_DELAY);
        }

        /**
         * 停止脚本
         */
        stop() {
            this.isRunning = false;
            if (this.observer) {
                this.observer.disconnect();
                this.observer = null;
            }
            console.log('🛑 B站直播清晰度自动选择脚本已停止');
        }

        /**
         * 重启脚本
         */
        restart() {
            this.stop();
            this.start();
        }
    }

    // 创建全局实例
    const qualitySelector = new QualitySelector();

    // 页面可见性变化时重新启动检测
    document.addEventListener('visibilitychange', () => {
        if (!document.hidden && !qualitySelector.isRunning) {
            console.log('🔄 页面重新可见，重启清晰度检测');
            qualitySelector.restart();
        }
    });

    // 页面加载完成后启动
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            setTimeout(() => qualitySelector.start(), CONFIG.INITIAL_DELAY);
        });
    } else {
        setTimeout(() => qualitySelector.start(), CONFIG.INITIAL_DELAY);
    }

    // 暴露实例到全局作用域，方便调试
    window.BilibiliLiveQualitySelector = qualitySelector;

    // 添加清理函数
    window.cleanupBilibiliLiveQualityScript = () => {
        qualitySelector.stop();
        console.log('🧹 B站直播清晰度脚本已清理');
    };
})();
