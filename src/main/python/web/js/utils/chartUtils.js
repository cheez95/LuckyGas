/**
 * Chart Utility Module
 * Provides reusable chart creation functions with consistent styling
 */

(function() {
    'use strict';

    // Chart color presets using APP_CONSTANTS
    const getChartColors = () => {
        const colors = window.APP_CONSTANTS?.CHART_COLORS || {};
        return {
            primary: colors.PRIMARY || 'rgb(59, 130, 246)',
            primaryAlpha: colors.PRIMARY_ALPHA || 'rgba(59, 130, 246, 0.1)',
            success: colors.SUCCESS || 'rgb(34, 197, 94)',
            successAlpha: colors.SUCCESS_ALPHA || 'rgba(34, 197, 94, 0.1)',
            warning: colors.WARNING || 'rgba(251, 191, 36, 0.8)',
            danger: colors.DANGER || 'rgba(239, 68, 68, 0.8)',
            info: colors.INFO || 'rgba(59, 130, 246, 0.8)',
            purple: colors.PURPLE || 'rgba(139, 92, 246, 0.8)'
        };
    };

    // Default chart options
    const defaultOptions = {
        line: {
            responsive: true,
            plugins: {
                legend: {
                    display: true
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        stepSize: 1
                    }
                }
            }
        },
        doughnut: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        padding: 10,
                        font: {
                            size: 12
                        }
                    }
                }
            }
        },
        bar: {
            responsive: true,
            plugins: {
                legend: {
                    display: true
                }
            },
            scales: {
                y: {
                    beginAtZero: true
                }
            }
        }
    };

    /**
     * Destroy existing chart if it exists
     * @param {Chart} chart - Chart instance to destroy
     */
    const destroyChart = (chart) => {
        if (chart && typeof chart.destroy === 'function') {
            chart.destroy();
        }
    };

    /**
     * Get canvas context with error handling
     * @param {string} canvasId - Canvas element ID
     * @returns {CanvasRenderingContext2D|null} Canvas context or null if not found
     */
    const getCanvasContext = (canvasId) => {
        const canvas = document.getElementById(canvasId);
        if (!canvas) {
            console.error(`Canvas element '${canvasId}' not found`);
            return null;
        }
        return canvas.getContext('2d');
    };

    /**
     * Create a line chart
     * @param {Object} config - Chart configuration
     * @param {string} config.canvasId - Canvas element ID
     * @param {Array} config.labels - X-axis labels
     * @param {Array} config.datasets - Dataset configurations
     * @param {Object} config.options - Additional chart options
     * @param {Chart} config.existingChart - Existing chart instance to destroy
     * @returns {Chart|null} Chart instance or null if creation failed
     */
    const createLineChart = (config) => {
        const ctx = getCanvasContext(config.canvasId);
        if (!ctx) return null;

        // Destroy existing chart
        destroyChart(config.existingChart);

        const colors = getChartColors();
        const tension = window.APP_CONFIG?.UI?.CHARTS?.LINE_TENSION || 0.1;

        // Apply default colors and tension to datasets
        const datasets = config.datasets.map((dataset, index) => {
            const colorKey = index === 0 ? 'primary' : 'success';
            return {
                ...dataset,
                borderColor: dataset.borderColor || colors[colorKey],
                backgroundColor: dataset.backgroundColor || colors[`${colorKey}Alpha`],
                tension: dataset.tension !== undefined ? dataset.tension : tension
            };
        });

        try {
            return new Chart(ctx, {
                type: 'line',
                data: {
                    labels: config.labels,
                    datasets: datasets
                },
                options: {
                    ...defaultOptions.line,
                    ...config.options
                }
            });
        } catch (error) {
            console.error('Error creating line chart:', error);
            return null;
        }
    };

    /**
     * Create a doughnut chart
     * @param {Object} config - Chart configuration
     * @param {string} config.canvasId - Canvas element ID
     * @param {Array} config.labels - Chart labels
     * @param {Array} config.data - Chart data values
     * @param {Array} config.backgroundColor - Background colors (optional)
     * @param {Object} config.options - Additional chart options
     * @param {Chart} config.existingChart - Existing chart instance to destroy
     * @returns {Chart|null} Chart instance or null if creation failed
     */
    const createDoughnutChart = (config) => {
        const ctx = getCanvasContext(config.canvasId);
        if (!ctx) return null;

        // Destroy existing chart
        destroyChart(config.existingChart);

        const colors = getChartColors();
        const defaultBackgroundColors = [
            colors.success,
            colors.warning,
            colors.info,
            colors.danger
        ];

        try {
            return new Chart(ctx, {
                type: 'doughnut',
                data: {
                    labels: config.labels,
                    datasets: [{
                        data: config.data,
                        backgroundColor: config.backgroundColor || defaultBackgroundColors,
                        borderWidth: 0
                    }]
                },
                options: {
                    ...defaultOptions.doughnut,
                    ...config.options
                }
            });
        } catch (error) {
            console.error('Error creating doughnut chart:', error);
            return null;
        }
    };

    /**
     * Create a bar chart
     * @param {Object} config - Chart configuration
     * @param {string} config.canvasId - Canvas element ID
     * @param {Array} config.labels - X-axis labels
     * @param {Array} config.datasets - Dataset configurations
     * @param {Object} config.options - Additional chart options
     * @param {Chart} config.existingChart - Existing chart instance to destroy
     * @returns {Chart|null} Chart instance or null if creation failed
     */
    const createBarChart = (config) => {
        const ctx = getCanvasContext(config.canvasId);
        if (!ctx) return null;

        // Destroy existing chart
        destroyChart(config.existingChart);

        const colors = getChartColors();

        // Apply default colors to datasets
        const datasets = config.datasets.map((dataset, index) => {
            const colorKeys = ['primary', 'success', 'warning', 'info', 'danger', 'purple'];
            const colorKey = colorKeys[index % colorKeys.length];
            return {
                ...dataset,
                backgroundColor: dataset.backgroundColor || colors[colorKey],
                borderColor: dataset.borderColor || colors[colorKey],
                borderWidth: dataset.borderWidth !== undefined ? dataset.borderWidth : 1
            };
        });

        try {
            return new Chart(ctx, {
                type: 'bar',
                data: {
                    labels: config.labels,
                    datasets: datasets
                },
                options: {
                    ...defaultOptions.bar,
                    ...config.options
                }
            });
        } catch (error) {
            console.error('Error creating bar chart:', error);
            return null;
        }
    };

    /**
     * Update chart data without recreating the entire chart
     * @param {Chart} chart - Chart instance to update
     * @param {Array} labels - New labels (optional)
     * @param {Array} datasets - New datasets
     */
    const updateChartData = (chart, labels, datasets) => {
        if (!chart) return;

        if (labels) {
            chart.data.labels = labels;
        }

        if (datasets) {
            chart.data.datasets = datasets;
        }

        chart.update();
    };

    /**
     * Get status chart colors based on delivery status
     * @returns {Array} Array of colors for status chart
     */
    const getStatusChartColors = () => {
        const colors = getChartColors();
        return [
            colors.success,    // Completed
            colors.warning,    // Pending
            colors.info,       // In Progress
            colors.danger      // Cancelled
        ];
    };

    // Export utilities
    window.chartUtils = {
        createLineChart,
        createDoughnutChart,
        createBarChart,
        updateChartData,
        destroyChart,
        getChartColors,
        getStatusChartColors,
        // Export default options for customization
        defaultOptions
    };

})();