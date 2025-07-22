'use strict';

/**
 * @file entities.js
 * @description Module for the Entity Management Platform (EMP), handling core brand entities.
 * @version 2.0.0 - Enhanced UX Edition
 */

var getEntity; // Declare globally to be accessible by schema-architect.js

const initializeEmp = (function() {

    const EMP_STORAGE_KEY = 'schemaArchitect_emp';
    let empModalInstance = null; // To hold the Bootstrap Modal instance

    // --- DOM Elements ---
    const empBtn = document.getElementById('empBtn');
    const empModalEl = document.getElementById('empModal');
    const saveEmpBtn = document.getElementById('saveEmpBtn');
    const addEmpFieldBtn = document.getElementById('addEmpFieldBtn');
    const empFormContainer = document.getElementById('emp-form-container');

    /**
     * Predefined fields for the EMP form.
     * @type {Object.<string, string>}
     */
    const predefinedEmpFields = {
        organizationName: 'اسم المنظمة الرسمي',
        logo: 'رابط الشعار الرسمي (URL)',
        telephone: 'رقم الهاتف الرئيسي',
        mainAuthor: 'اسم المؤلف الرئيسي للمقالات/المراجعات',
    };

    /**
     * Retrieves all saved entity data from localStorage.
     * @returns {Object} The saved entity data object.
     */
    function getSavedData() {
        return JSON.parse(localStorage.getItem(EMP_STORAGE_KEY) || '{}');
    }

    /**
     * Renders the form inside the EMP modal based on predefined and custom fields.
     */
    function renderEmpForm() {
        empFormContainer.innerHTML = ''; // Clear previous form
        const savedData = getSavedData();

        const allFields = { ...predefinedEmpFields };
        // Ensure custom fields from storage are included for rendering
        for (const key in savedData) {
            if (!allFields[key]) {
                // For custom fields, the key itself is used as the label for consistency
                allFields[key] = key;
            }
        }

        for (const key in allFields) {
            const label = allFields[key];
            const value = savedData[key] || '';
            const isPredefined = !!predefinedEmpFields[key];

            const fieldHtml = `
                <div class="input-group mb-2" data-field-key="${key}">
                    <label class="input-group-text" style="width: 200px;">${label}</label>
                    <input type="text" class="form-control" value="${value}" placeholder="${isPredefined ? label+'...' : 'قيمة الحقل...'}">
                    ${!isPredefined ? `<button class="btn btn-outline-danger btn-sm emp-delete-field-btn" type="button" title="حذف هذا الحقل المخصص"><i class="bi bi-trash"></i></button>` : ''}
                </div>
            `;
            empFormContainer.insertAdjacentHTML('beforeend', fieldHtml);
        }

        // Add event listeners for the delete buttons on existing custom fields
        empFormContainer.querySelectorAll('.emp-delete-field-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const group = e.currentTarget.closest('.input-group');
                // If it's a new, unsaved field, just remove it from the DOM.
                if (group.dataset.isNew) {
                    group.remove();
                    return;
                }
                // If it's a saved field, remove it from storage and re-render.
                const fieldKey = group.dataset.fieldKey;
                const currentData = getSavedData();
                delete currentData[fieldKey];
                localStorage.setItem(EMP_STORAGE_KEY, JSON.stringify(currentData));
                renderEmpForm(); // Re-render to reflect the deletion
                showToast(`تم حذف الحقل "${fieldKey}".`, 'info');
            });
        });
    }

    /**
     * Saves all data from the EMP form to localStorage.
     * Handles both existing fields and newly added custom fields with validation.
     */
    function saveEmpData() {
        const newData = {};
        let isValid = true;
        const seenKeys = new Set(Object.keys(predefinedEmpFields));

        empFormContainer.querySelectorAll('.input-group').forEach(group => {
            if (group.dataset.isNew) {
                // --- Logic for NEWLY ADDED custom fields ---
                const keyInput = group.querySelectorAll('input')[0];
                const valueInput = group.querySelectorAll('input')[1];
                const key = keyInput.value.trim();
                const value = valueInput.value.trim();

                // Reset validation visuals
                keyInput.classList.remove('is-invalid');
                valueInput.classList.remove('is-invalid');

                if (!key && !value) return; // Ignore empty new rows

                if (!key || !value || !/^[a-zA-Z0-9_]+$/.test(key) || seenKeys.has(key)) {
                    showToast(`المفتاح "${key || 'الفارغ'}" غير صالح أو مستخدم بالفعل.`, 'danger');
                    if (!key || !/^[a-zA-Z0-9_]+$/.test(key) || seenKeys.has(key)) keyInput.classList.add('is-invalid');
                    if (!value) valueInput.classList.add('is-invalid');
                    isValid = false;
                } else {
                    newData[key] = value;
                    seenKeys.add(key);
                }

            } else {
                // --- Logic for PRE-EXISTING fields ---
                const key = group.dataset.fieldKey;
                const input = group.querySelector('input');
                if (key && input && input.value.trim()) {
                    newData[key] = input.value.trim();
                    seenKeys.add(key);
                }
            }
        });

        if (!isValid) {
            showToast('يرجى تصحيح الأخطاء قبل الحفظ.', 'warning');
            return; // Stop the save process if there are validation errors
        }

        localStorage.setItem(EMP_STORAGE_KEY, JSON.stringify(newData));
        showToast('تم حفظ بيانات الكيان بنجاح.', 'success');
        if (empModalInstance) {
            empModalInstance.hide();
        }
    }

    /**
     * Dynamically adds a new, empty field row to the form UI for the user to fill out.
     * Replaces the old `prompt()` method entirely.
     */
    function addCustomEmpField() {
        // Create a unique temporary key to identify the new row before it's saved
        const tempKey = `new_field_${Date.now()}`;
        
        const fieldHtml = `
            <div class="input-group mb-2" data-is-new="true" data-temp-key="${tempKey}">
                <input type="text" class="form-control" style="flex-basis: 150px; flex-grow: 0.5;" placeholder="المفتاح (e.g., ceoName)">
                <input type="text" class="form-control" style="flex-basis: 250px; flex-grow: 1;" placeholder="القيمة...">
                <button class="btn btn-outline-danger btn-sm emp-delete-field-btn" type="button" title="إزالة هذا الحقل"><i class="bi bi-trash"></i></button>
            </div>
        `;
        empFormContainer.insertAdjacentHTML('beforeend', fieldHtml);

        // Find the newly added element in the DOM
        const newFieldElement = empFormContainer.querySelector(`[data-temp-key="${tempKey}"]`);
        
        // Immediately add a listener to its delete button
        newFieldElement.querySelector('.emp-delete-field-btn').addEventListener('click', (e) => {
            e.currentTarget.closest('.input-group').remove();
        });

        // Focus on the first input of the new row for a better user experience
        newFieldElement.querySelector('input').focus();
    }

    /**
     * Main initialization function for the EMP module.
     */
    function init() {
        if (!empBtn || !empModalEl) return;

        empModalInstance = new bootstrap.Modal(empModalEl);

        empBtn.addEventListener('click', () => {
            empModalInstance.show();
        });

        empModalEl.addEventListener('show.bs.modal', () => {
            renderEmpForm();
        });

        saveEmpBtn.addEventListener('click', saveEmpData);
        addEmpFieldBtn.addEventListener('click', addCustomEmpField);
    }
   
    /**
     * Globally accessible function to retrieve a single entity value.
     * @param {string} key - The key of the entity to retrieve.
     * @returns {string|null} The value of the entity or null if not found.
     */
    getEntity = function(key) {
        const data = JSON.parse(localStorage.getItem(EMP_STORAGE_KEY) || '{}');
        return data[key] || null;
    };

    // Run the initializer
    init();

    // Return a reference to the init function
    return init;

})();