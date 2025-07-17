/**
 * Driver Handlers Module
 * Contains all driver-related functions
 * Functions: loadDrivers, editDriver, addDriver, updateDriver, deleteDriver
 */

(function() {
    'use strict';
    
    // Load drivers
    async function loadDrivers() {
        const data = await api.get('/drivers');
        allDrivers = data.items || [];
        renderDriversTable(allDrivers);
        updateDriverOptions();
    }
    
    async function editDriver(driverId) {
        const driver = await api.get(`/drivers/${driverId}`, {
            errorMessage: '載入司機資料失敗'
        }).catch(() => null);
        
        if (!driver) return;
            
        const modal = createEditModal('編輯司機', `
            <form id="edit-driver-form">
                <div class="grid grid-cols-2 gap-4">
                    ${html.formField('姓名', 'name', 'text', driver.name, { required: true, containerClass: 'div' })}
                    ${html.formField('電話', 'phone', 'text', driver.phone || '', { containerClass: 'div' })}
                    ${html.formField('員工編號', 'employee_id', 'text', driver.employee_id || '', { containerClass: 'div' })}
                    ${html.formField('狀態', 'is_active', 'select', driver.is_active ? 'true' : 'false', {
                        containerClass: 'div',
                        selectOptions: [
                            { value: 'true', text: '在職' },
                            { value: 'false', text: '離職' }
                        ]
                    })}
                </div>
            </form>
        `);
        
        modal.querySelector('#confirm-btn').addEventListener('click', async () => {
            const form = modal.querySelector('#edit-driver-form');
            const formData = new FormData(form);
            const updateData = {};
            
            for (let [key, value] of formData.entries()) {
                if (key === 'is_active') {
                    updateData[key] = value === 'true';
                } else {
                    updateData[key] = value;
                }
            }
            
            const result = await api.put(`/drivers/${driverId}`, updateData, {
                successMessage: '司機資料已更新'
            });
            if (result !== null) {
                closeModal(modal);
                loadDrivers();
            }
        });
    }
    
    // Update driver options in select elements
    function updateDriverOptions() {
        const driverSelects = document.querySelectorAll('select[name="driver_id"], #delivery-driver');
        driverSelects.forEach(select => {
            const currentValue = select.value;
            select.innerHTML = '<option value="">全部司機</option>';
            allDrivers.filter(d => d.is_active).forEach(driver => {
                const option = document.createElement('option');
                option.value = driver.id;
                option.textContent = driver.name;
                select.appendChild(option);
            });
            select.value = currentValue;
        });
    }
    
    // Load drivers for filter dropdown
    async function loadDriversForFilter(selectId) {
        const data = await api.get('/drivers?is_active=true');
        const drivers = data.items || [];
        
        const select = document.getElementById(selectId);
        if (select) {
            const currentValue = select.value;
            select.innerHTML = '<option value="">所有司機</option>';
            drivers.forEach(driver => {
                const option = document.createElement('option');
                option.value = driver.id;
                option.textContent = `${driver.name} (${driver.employee_id})`;
                select.appendChild(option);
            });
            select.value = currentValue;
        }
    }
    
    // Load drivers and vehicles for manual route creation
    async function loadDriversAndVehiclesForRoute() {
        // Load drivers
        const driversData = await api.get('/drivers?is_active=true');
        const drivers = driversData.items || [];
        
        const driverSelect = document.querySelector('#add-route-form select[name="driver_id"]');
        if (driverSelect) {
            driverSelect.innerHTML = '<option value="">請選擇司機</option>' + 
                drivers.map(driver => `<option value="${driver.id}">${driver.name}</option>`).join('');
        }
        
        // Load vehicles
        const vehiclesData = await api.get('/vehicles?is_active=true');
        const vehicles = vehiclesData.items || [];
        
        const vehicleSelect = document.querySelector('#add-route-form select[name="vehicle_id"]');
        if (vehicleSelect) {
            vehicleSelect.innerHTML = '<option value="">請選擇車輛</option>' + 
                vehicles.map(vehicle => `<option value="${vehicle.id}">${vehicle.plate_number} - ${vehicle.vehicle_type}</option>`).join('');
        }
    }
    
    // Delete driver
    async function deleteDriver(driverId) {
        if (!confirm('確定要刪除此司機嗎？\n\n⚠️ 警告：此操作無法復原！')) return;
        
        await api.delete(`/drivers/${driverId}`);
        await loadDrivers();
    }
    
    // Export driver handlers
    window.driverHandlers = {
        loadDrivers,
        editDriver,
        deleteDriver,
        updateDriverOptions,
        loadDriversForFilter,
        loadDriversAndVehiclesForRoute
    };
    
    // Also export individually for backward compatibility
    window.loadDrivers = loadDrivers;
    window.editDriver = editDriver;
    window.deleteDriver = deleteDriver;
    window.updateDriverOptions = updateDriverOptions;
    window.loadDriversForFilter = loadDriversForFilter;
    window.loadDriversAndVehiclesForRoute = loadDriversAndVehiclesForRoute;
    
    console.log('✅ Driver Handlers module loaded');
})();