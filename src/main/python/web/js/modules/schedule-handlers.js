/**
 * Schedule Handlers Module
 * Contains all schedule management functions
 * Functions: loadSchedule, viewScheduleDetails, applySchedule, etc.
 */

(function() {
    'use strict';
    
    // Show scheduling modal
    async function showSchedulingModal() {
        const modal = document.getElementById('schedulingModal');
        if (!modal) return;
        
        // Reset form
        document.getElementById('scheduling-form').reset();
        document.getElementById('scheduling-results').classList.add('hidden');
        
        // Set default date to tomorrow
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        document.querySelector('#scheduling-form input[name="start_date"]').value = tomorrow.toISOString().split('T')[0];
        
        modal.classList.remove('hidden');
        modal.classList.add('flex');
    }
    
    // View schedule details
    async function viewScheduleDetails(date) {
        // Get the scheduling result for this date
        try {
            const response = await fetch(`${API_BASE}/scheduling/metrics/${date}`);
            const metrics = await response.json();
            
            let modalContent = `
                <div class="space-y-4">
            `;
            
            if (metrics.metrics) {
                modalContent += `
                    <div class="grid grid-cols-2 gap-4">
                        <div>
                            <p class="text-sm text-gray-600">總特殊客戶數</p>
                            <p class="font-semibold">${metrics.metrics.total_special_clients}</p>
                        </div>
                        <div>
                            <p class="text-sm text-gray-600">排程成功數</p>
                            <p class="font-semibold">${metrics.metrics.scheduled_special_clients}</p>
                        </div>
                        <div>
                            <p class="text-sm text-gray-600">總路線數</p>
                            <p class="font-semibold">${metrics.metrics.total_routes}</p>
                        </div>
                        <div>
                            <p class="text-sm text-gray-600">總距離</p>
                            <p class="font-semibold">${metrics.metrics.total_distance?.toFixed(1) || 0} km</p>
                        </div>
                    </div>
                `;
            }
            
            modalContent += `</div>`;
            
            const modal = createModal('排程詳情 - ' + formatDate(date), modalContent);
            modal.classList.remove('hidden');
            modal.classList.add('flex');
            
        } catch (error) {
            console.error('Error viewing schedule details:', error);
            showNotification('載入排程詳情失敗', 'error');
        }
    }
    
    // Apply schedule to create actual routes
    async function applySchedule(date) {
        if (!confirm(`確定要套用 ${formatDate(date)} 的排程嗎？這將建立實際的配送路線。`)) {
            return;
        }
        
        // Get the cached schedule data
        if (!window.schedulingResultsCache || !window.schedulingResultsCache.has(date)) {
            showNotification('找不到排程資料，請重新生成排程', 'error');
            return;
        }
        
        const scheduleData = window.schedulingResultsCache.get(date);
        
        try {
            const response = await fetch(`${API_BASE}/scheduling/apply/${date}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(scheduleData)
            });
            
            if (!response.ok) {
                throw new Error('套用排程失敗');
            }
            
            const result = await response.json();
            showNotification(`成功建立 ${result.routes_created} 條路線`, 'success');
            
            // Reload routes if on routes page
            if (window.location.hash === '#routes' && typeof loadRoutes === 'function') {
                await loadRoutes();
            }
            
        } catch (error) {
            console.error('Error applying schedule:', error);
            showNotification('套用排程失敗', 'error');
        }
    }
    
    // Generate weekly schedule placeholder
    async function generateWeeklySchedule() {
        console.log('Generate weekly schedule - to be implemented');
    }
    
    // Export schedule handlers
    window.scheduleHandlers = {
        showSchedulingModal,
        viewScheduleDetails,
        applySchedule,
        generateWeeklySchedule
    };
    
    // Also export individually for backward compatibility
    window.showSchedulingModal = showSchedulingModal;
    window.viewScheduleDetails = viewScheduleDetails;
    window.applySchedule = applySchedule;
    window.generateWeeklySchedule = generateWeeklySchedule;
    
    console.log('✅ Schedule Handlers module loaded');
})();