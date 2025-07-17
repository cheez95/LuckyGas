/**
 * Vehicle Handlers Module
 * Contains all vehicle-related functions
 * Functions: loadVehicles, editVehicle, addVehicle, updateVehicle, deleteVehicle
 */

(function() {
    'use strict';
    
    // Load vehicles
    async function loadVehicles() {
        const data = await api.get('/vehicles');
        allVehicles = data.items || [];
        renderVehiclesTable(allVehicles);
    }
    
    async function editVehicle(vehicleId) {
        const vehicle = await api.get(`/vehicles/${vehicleId}`, {
            errorMessage: '載入車輛資料失敗'
        }).catch(() => null);
        
        if (!vehicle) return;
            
        const modal = createEditModal('編輯車輛', `
            <form id="edit-vehicle-form">
                <div class="grid grid-cols-2 gap-4">
                    ${html.formField('車牌號碼', 'plate_number', 'text', vehicle.plate_number, { required: true, containerClass: 'div' })}
                    ${html.formField('車輛類型', 'vehicle_type', 'select', vehicle.vehicle_type, {
                        containerClass: 'div',
                        selectOptions: [
                            { value: '1', text: '汽車' },
                            { value: '2', text: '機車' }
                        ]
                    })}
                    ${html.formField('狀態', 'is_active', 'select', vehicle.is_active ? 'true' : 'false', {
                        containerClass: 'div',
                        selectOptions: [
                            { value: 'true', text: '可用' },
                            { value: 'false', text: '停用' }
                        ]
                    })}
                    ${html.formField('上次保養日期', 'last_maintenance', 'date', vehicle.last_maintenance || '', { containerClass: 'div' })}
                </div>
            </form>
        `);
        
        modal.querySelector('#confirm-btn').addEventListener('click', async () => {
            const form = modal.querySelector('#edit-vehicle-form');
            const formData = new FormData(form);
            const updateData = {};
            
            for (let [key, value] of formData.entries()) {
                if (key === 'is_active') {
                    updateData[key] = value === 'true';
                } else if (key === 'vehicle_type') {
                    updateData[key] = parseInt(value);
                } else {
                    updateData[key] = value;
                }
            }
            
            const result = await api.put(`/vehicles/${vehicleId}`, updateData, {
                successMessage: '車輛資料已更新'
            });
            if (result !== null) {
                closeModal(modal);
                loadVehicles();
            }
        });
    }
    
    function showAddVehicleModal() {
        // Will be moved from app.js
    }
    
    async function addVehicle() {
        // Will be moved from app.js
    }
    
    async function updateVehicle(vehicleId) {
        // Will be moved from app.js
    }
    
    // Toggle vehicle status
    async function toggleVehicleStatus(vehicleId, currentStatus) {
        if (!confirm(`確定要${currentStatus ? '停用' : '啟用'}此車輛嗎？`)) return;
        
        await api.put(`/vehicles/${vehicleId}`, { is_active: !currentStatus });
        await loadVehicles();
    }
    
    // Delete vehicle
    async function deleteVehicle(vehicleId) {
        if (!confirm('確定要刪除此車輛嗎？\n\n⚠️ 警告：此操作無法復原！')) return;
        
        await api.delete(`/vehicles/${vehicleId}`);
        await loadVehicles();
    }
    
    // Export vehicle handlers
    window.vehicleHandlers = {
        loadVehicles,
        editVehicle,
        toggleVehicleStatus,
        deleteVehicle
    };
    
    // Also export individually for backward compatibility
    window.loadVehicles = loadVehicles;
    window.editVehicle = editVehicle;
    window.toggleVehicleStatus = toggleVehicleStatus;
    window.deleteVehicle = deleteVehicle;
    
    console.log('✅ Vehicle Handlers module loaded');
})();