// ==UserScript==
// @name         B站直播自动选择最高清晰度
// @namespace    http://tampermonkey.net/
// @version      1.4.1
// @description  鼠标放在清晰度按钮上后，自动选择B站直播的最高清晰度(原画>蓝光>超清)
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
        // 清晰度权重映射：数值越大优先级越高
        // 可以根据实际需求调整顺序或添加新的关键字 (如 "4K", "HDR")
        QUALITY_WEIGHTS: {
            '原画': 100,
            '蓝光': 90,
            '超清': 80,
            '高清': 70,
            '流畅': 60,
            '1080P': 50,
            '720P': 40,
            '480P': 30,
            '4K': 110,// 如果有4K选项，优先级最高
            'HDR': 105// 如果有HDR选项，优先级次高
        },
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
         * 计算单个元素的清晰度权重分数
         * @param {Element} element - 清晰度选项元素
         * @returns {number} - 权重分数，未匹配到关键字返回 -1
         */
        calculateQualityScore(element) {
            const text = element.textContent.trim();
            let maxScore = -1;

            // 遍历所有定义的关键字，找出文本中包含的权重最高的那个
            for (const [keyword, weight] of Object.entries(CONFIG.QUALITY_WEIGHTS)) {
                if (text.includes(keyword)) {
                    if (weight > maxScore) {
                        maxScore = weight;
                    }
                }
            }

            return maxScore;
        }

        /**
         * 查找并排序所有可用的清晰度选项，返回最佳选项
         */
        findBestQualityOption() {
            let bestOption = null;
            let highestScore = -1;

            // 遍历所有候选选择器
            for (const selector of CONFIG.SELECTOR_CANDIDATES) {
                const elements = document.querySelectorAll(selector);

                if (elements.length === 0) continue;

                for (const element of elements) {
                    const score = this.calculateQualityScore(element);

                    // 如果当前元素分数更高，更新最佳选项
                    if (score > highestScore) {
                        highestScore = score;
                        bestOption = element;
                    }
                }
            }

            if (bestOption) {
                console.log(`✅ 找到最佳清晰度选项: "${bestOption.textContent.trim()}" (权重: ${highestScore})`);
            } else {
                // 如果没有匹配到任何关键字，尝试返回第一个找到的候选元素作为备选
                for (const selector of CONFIG.SELECTOR_CANDIDATES) {
                    const firstElement = document.querySelector(selector);
                    if (firstElement) {
                        console.log(`⚠️ 未匹配到已知清晰度关键字，默认选择: "${firstElement.textContent.trim()}"`);
                        return firstElement;
                    }
                }
            }

            return bestOption;
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
            console.log(`📊 清晰度优先级: ${Object.keys(CONFIG.QUALITY_WEIGHTS).sort((a,b) => CONFIG.QUALITY_WEIGHTS[b] - CONFIG.QUALITY_WEIGHTS[a]).join(' > ')}`);

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
