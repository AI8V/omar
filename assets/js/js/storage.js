window.StorageManager = (function() {
    'use strict';
    const DB_NAME = 'Ai8V_ProjectsDB';
    const STORE_NAME = 'projects';
    let db;

    function openDB() {
        return new Promise((resolve, reject) => {
            if (db) return resolve(db);
            const request = indexedDB.open(DB_NAME, 1);
            request.onerror = (event) => reject(`IndexedDB error: ${event.target.errorCode}`);
            request.onsuccess = (event) => {
                db = event.target.result;
                resolve(db);
            };
            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                if (!db.objectStoreNames.contains(STORE_NAME)) {
                    db.createObjectStore(STORE_NAME, { keyPath: 'name' });
                }
            };
        });
    }

    async function saveProjectData(project) {
        const db = await openDB();
        const transaction = db.transaction(STORE_NAME, 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        return new Promise((resolve, reject) => {
            const request = store.put(project);
            request.onsuccess = () => resolve();
            request.onerror = (event) => reject(`Failed to save project: ${event.target.error}`);
        });
    }
    
    async function loadProjectData(projectName) {
        const db = await openDB();
        const transaction = db.transaction(STORE_NAME, 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        return new Promise((resolve, reject) => {
            const request = store.get(projectName);
            request.onsuccess = () => resolve(request.result);
            request.onerror = (event) => reject(`Failed to load project: ${event.target.error}`);
        });
    }
    
    async function deleteProjectData(projectName) {
        const db = await openDB();
        const transaction = db.transaction(STORE_NAME, 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        return new Promise((resolve, reject) => {
            const request = store.delete(projectName);
            request.onsuccess = () => resolve();
            request.onerror = (event) => reject(`Failed to delete project: ${event.target.error}`);
        });
    }

    async function getProjectList() {
        const db = await openDB();
        const transaction = db.transaction(STORE_NAME, 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        return new Promise((resolve, reject) => {
            const request = store.getAllKeys();
            request.onsuccess = () => resolve(request.result);
            request.onerror = (event) => reject(`Failed to get project list: ${event.target.error}`);
        });
    }

    return { 
        saveProjectData, 
        loadProjectData,
        deleteProjectData,
        getProjectList 
    };
})();